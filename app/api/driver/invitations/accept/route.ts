import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import {
  getFleetDriverInvitationReadiness,
  hashFleetDriverInvitationToken,
} from '../../../../../lib/server/fleetDriverInvitations';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const schema = z.object({ token: z.string().trim().min(32).max(256).optional() });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const bearer = getBearerToken(request);
  if (!bearer) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(bearer);
  if (authError || !authData.user?.email) return json(401, { error: 'Unauthorized.' });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: 'Invalid invitation token.' });

  const email = authData.user.email.trim().toLowerCase();
  let invitationQuery = supabaseAdmin
    .from('fleet_driver_invitations')
    .select('id, company_id, driver_id, user_id, invited_email, status, expires_at, accepted_at')
    .eq('user_id', authData.user.id)
    .eq('invited_email', email)
    .in('status', ['invited', 'accepted', 'approved'])
    .order('updated_at', { ascending: false })
    .limit(1);

  if (parsed.data.token) {
    invitationQuery = invitationQuery.eq(
      'token_hash',
      await hashFleetDriverInvitationToken(parsed.data.token),
    );
  }

  const { data: invitations, error: invitationError } = await invitationQuery;
  const invitation = invitations?.[0] ?? null;

  if (invitationError) return json(500, { error: invitationError.message });
  if (!invitation) return json(404, { error: 'Invitation not found.' });

  if (
    invitation.status === 'invited' &&
    new Date(String(invitation.expires_at)).getTime() < Date.now()
  ) {
    await supabaseAdmin
      .from('fleet_driver_invitations')
      .update({ status: 'expired', token_hash: null, updated_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .eq('status', 'invited');
    return json(410, { error: 'Invitation has expired.' });
  }

  if (invitation.status === 'invited') {
    const now = new Date().toISOString();
    const { error: acceptError } = await supabaseAdmin
      .from('fleet_driver_invitations')
      .update({ status: 'accepted', accepted_at: now, token_hash: null, updated_at: now })
      .eq('id', invitation.id)
      .eq('status', 'invited');
    if (acceptError) return json(500, { error: acceptError.message });

    await supabaseAdmin
      .from('drivers')
      .update({ status: 'onboarding', app_access: false, updated_at: now })
      .eq('id', invitation.driver_id)
      .eq('user_id', authData.user.id);

    await supabaseAdmin
      .from('company_memberships')
      .update({ status: 'invited', role_in_company: 'driver', updated_at: now })
      .eq('company_id', invitation.company_id)
      .eq('user_id', authData.user.id);
  }

  const { data: readiness, error: readinessError } = await getFleetDriverInvitationReadiness(
    supabaseAdmin,
    invitation.id,
  );
  if (readinessError || !readiness) return json(500, { error: readinessError ?? 'Readiness unavailable.' });

  return json(200, {
    accepted: true,
    invitationId: invitation.id,
    companyId: invitation.company_id,
    driverId: invitation.driver_id,
    appAccess: invitation.status === 'approved',
    membershipStatus: invitation.status === 'approved' ? 'active' : 'invited',
    readiness,
  });
}
