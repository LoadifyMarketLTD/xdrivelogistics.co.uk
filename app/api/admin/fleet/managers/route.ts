import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { getResetPasswordEmailRedirectTo } from '../../../../../lib/authFlow';
import { normalizeProfileRoleForStorage } from '../../../../../lib/authRole';

const OWNER_ADMIN_ROLES = ['owner', 'admin'] as const;
const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const createSchema = z.object({
  companyId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(100).nullable().optional(),
});

async function resolveOwnerAdmin(request: NextRequest, companyId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { response: json(503, { error: 'Fleet Manager administration is unavailable.' }) };

  const token = getBearerToken(request);
  if (!token) return { response: json(401, { error: 'Unauthorized.' }) };
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return { response: json(401, { error: 'Unauthorized.' }) };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id,company_id,role_in_company,companies!inner(status)')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .in('role_in_company', [...OWNER_ADMIN_ROLES])
    .maybeSingle();

  if (membershipError) return { response: json(500, { error: 'Fleet Manager authority could not be verified.' }) };
  if (!membership) return { response: json(403, { error: 'Only company owners and admins can manage Fleet Managers.' }) };

  return { userId: authData.user.id, companyId };
}

async function findAuthUserIdByEmail(email: string) {
  if (!supabaseAdmin) return null;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  if (!z.string().uuid().safeParse(companyId).success) return json(400, { error: 'Valid companyId is required.' });

  const access = await resolveOwnerAdmin(request, companyId);
  if ('response' in access) return access.response;

  const { data, error } = await supabaseAdmin!
    .from('company_memberships')
    .select('id,user_id,invited_email,role_in_company,status,created_at,updated_at')
    .eq('company_id', access.companyId)
    .eq('role_in_company', 'fleet_manager')
    .order('created_at', { ascending: false });

  if (error) return json(500, { error: 'Fleet Managers could not be loaded.' });
  return json(200, { managers: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Fleet Manager administration is unavailable.' });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Fleet Manager name, email and company are required.' });

  const access = await resolveOwnerAdmin(request, parsed.data.companyId);
  if ('response' in access) return access.response;

  const email = parsed.data.email;
  let userId: string | null = null;
  let inviteSent = false;

  const { data: invitedData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getResetPasswordEmailRedirectTo()}?type=invite`,
    data: {
      role: 'company_staff',
      requested_role: 'fleet_manager',
      workspace_role: 'fleet_manager',
    },
  });

  if (!inviteError && invitedData.user) {
    userId = invitedData.user.id;
    inviteSent = true;
  } else {
    const message = String(inviteError?.message ?? '').toLowerCase();
    const alreadyExists =
      message.includes('already registered') ||
      message.includes('already been registered') ||
      message.includes('user already exists') ||
      (inviteError as { code?: string } | null)?.code === 'email_exists';

    if (!alreadyExists) {
      return json(400, { error: inviteError?.message ?? 'Fleet Manager invite could not be sent.' });
    }
    userId = await findAuthUserIdByEmail(email);
  }

  if (!userId) return json(500, { error: 'Fleet Manager account could not be resolved.' });

  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: 'company_staff',
      requested_role: 'fleet_manager',
      workspace_role: 'fleet_manager',
    },
    app_metadata: {
      role: 'company_staff',
      workspace_role: 'fleet_manager',
    },
  });
  if (metadataError) return json(400, { error: metadataError.message });

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      user_id: userId,
      full_name: parsed.data.displayName,
      phone: parsed.data.phone?.trim() || null,
      role: normalizeProfileRoleForStorage('company_staff') ?? 'company_staff',
      status: 'active',
      company_id: access.companyId,
      is_driver: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (profileError) return json(500, { error: `Fleet Manager profile could not be saved: ${profileError.message}` });

  const { data: manager, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .upsert({
      company_id: access.companyId,
      user_id: userId,
      invited_email: email,
      role_in_company: 'fleet_manager',
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,user_id' })
    .select('id,user_id,invited_email,role_in_company,status,created_at,updated_at')
    .maybeSingle();

  if (membershipError) {
    return json(500, { error: `Fleet Manager membership could not be saved: ${membershipError.message}` });
  }

  return json(201, { manager, inviteSent });
}
