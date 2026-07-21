import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { getResetPasswordEmailRedirectTo } from '../../../../lib/authFlow';
import { normalizeFleetDriverEmail } from '../../../../lib/server/fleetDriverInvitations';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const ADMIN_ROLES = ['owner', 'admin', 'dispatcher'];

const schema = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid().nullable().optional(),
  displayName: z.string().trim().min(1).max(160),
  email: z.string().email(),
  phone: z.string().trim().max(50).nullable().optional(),
});

const findAuthUserByEmail = async (email: string) => {
  if (!supabaseAdmin) return null;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
};

const randomBootstrapPassword = () =>
  `XDrive-${crypto.randomUUID()}-${crypto.randomUUID()}-A1!`;

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid fleet driver invitation payload.' });

  const email = normalizeFleetDriverEmail(parsed.data.email);
  const companyId = parsed.data.companyId;

  let membershipQuery = supabaseAdmin
    .from('company_memberships')
    .select('id, company_id, role_in_company, status, companies!inner(status)')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .in('role_in_company', ADMIN_ROLES);
  if (parsed.data.membershipId) membershipQuery = membershipQuery.eq('id', parsed.data.membershipId);

  const { data: membership, error: membershipError } = await membershipQuery.maybeSingle();
  if (membershipError) return json(500, { error: membershipError.message });
  if (!membership) return json(403, { error: 'Owner, admin or dispatcher access is required.' });

  let authUser = await findAuthUserByEmail(email);
  let authUserCreated = false;
  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomBootstrapPassword(),
      email_confirm: false,
      user_metadata: {
        role: 'driver',
        requested_role: 'driver',
        fleet_driver_invitation: true,
      },
      app_metadata: { role: 'driver' },
    });
    if (error || !data.user) {
      return json(400, { error: error?.message ?? 'Failed to create invited driver identity.' });
    }
    authUser = data.user;
    authUserCreated = true;
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .upsert(
      {
        company_id: companyId,
        user_id: authUser.id,
        display_name: parsed.data.displayName,
        email,
        phone: parsed.data.phone || null,
        status: 'invited',
        app_access: false,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,user_id' },
    )
    .select('id, company_id, user_id, display_name, email, phone, status, app_access')
    .single();

  if (driverError || !driver) {
    return json(500, { error: driverError?.message ?? 'Failed to create pending driver record.' });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      user_id: authUser.id,
      full_name: parsed.data.displayName,
      phone: parsed.data.phone || null,
      role: 'driver',
      status: 'pending',
      company_id: companyId,
      is_driver: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (profileError) return json(500, { error: profileError.message });

  const { error: driverMembershipError } = await supabaseAdmin.from('company_memberships').upsert(
    {
      company_id: companyId,
      user_id: authUser.id,
      invited_email: email,
      role_in_company: 'driver',
      status: 'invited',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,user_id' },
  );
  if (driverMembershipError) return json(500, { error: driverMembershipError.message });

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from('fleet_driver_invitations')
    .upsert(
      {
        company_id: companyId,
        driver_id: driver.id,
        user_id: authUser.id,
        invited_email: email,
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        created_by: authData.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id' },
    )
    .select('id')
    .single();
  if (invitationError || !invitation) {
    return json(500, { error: invitationError?.message ?? 'Failed to create invitation record.' });
  }

  const { data: rotated, error: rotateError } = await supabaseAdmin.rpc(
    'rotate_fleet_driver_invitation_token',
    {
      p_invitation_id: invitation.id,
      p_actor_user_id: authData.user.id,
      p_force: true,
    },
  );
  const tokenResult = Array.isArray(rotated) ? rotated[0] : rotated;
  if (rotateError || !tokenResult?.raw_token) {
    return json(500, { error: rotateError?.message ?? 'Failed to issue invitation token.' });
  }

  const baseRedirect = getResetPasswordEmailRedirectTo().replace(/\?.*$/, '');
  const invitationUrl = `${baseRedirect}?type=fleet-driver-invite&invitation=${encodeURIComponent(
    tokenResult.raw_token,
  )}`;

  const { error: deliveryError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: invitationUrl,
  });

  return json(deliveryError ? 202 : 201, {
    invitationId: invitation.id,
    driver,
    status: 'invited',
    appAccess: false,
    membershipStatus: 'invited',
    expiresAt: tokenResult.expires_at,
    invitationSent: !deliveryError,
    deliveryWarning: deliveryError?.message ?? null,
    authUserCreated,
    ...(process.env.XDRIVE_EXPOSE_STAGING_INVITATION_TOKEN === 'true'
      ? { stagingInvitationToken: tokenResult.raw_token }
      : {}),
  });
}
