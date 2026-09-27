import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import {
  getAuthCallbackEmailRedirectTo,
  getResetPasswordEmailRedirectTo,
} from '../../../../../lib/authFlow';
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
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { response: json(503, { error: 'Fleet Manager administration is unavailable.' }) };
  }

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

  if (membershipError) {
    return { response: json(500, { error: 'Fleet Manager authority could not be verified.' }) };
  }
  if (!membership) {
    return { response: json(403, { error: 'Only company owners and admins can manage Fleet Managers.' }) };
  }

  return { userId: authData.user.id, companyId };
}

async function findAuthUserByEmail(email: string) {
  if (!supabaseAdmin) return null;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  if (!z.string().uuid().safeParse(companyId).success) {
    return json(400, { error: 'Valid companyId is required.' });
  }

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
  let targetUser = await findAuthUserByEmail(email);
  const existingAuthUser = Boolean(targetUser);
  const delivery: 'auth_invite' | 'magic_link' = existingAuthUser ? 'magic_link' : 'auth_invite';

  if (!targetUser) {
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getResetPasswordEmailRedirectTo()}?flow=team-invite&workspace=fleet_manager`,
      data: {
        role: 'company_staff',
        requested_role: 'fleet_manager',
        workspace_role: 'fleet_manager',
        invitation_kind: 'company_team',
      },
    });
    if (inviteError || !inviteData.user) {
      return json(503, { error: inviteError?.message ?? 'Fleet Manager invitation email could not be sent.' });
    }
    targetUser = inviteData.user;
  }

  const { data: activeMemberships, error: activeMembershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id,company_id,role_in_company,status')
    .eq('user_id', targetUser.id)
    .eq('status', 'active')
    .limit(2);
  if (activeMembershipError) {
    return json(500, { error: 'Existing Fleet Manager membership could not be verified.' });
  }
  const activeMembership = (activeMemberships ?? [])[0];
  if (activeMembership?.company_id && activeMembership.company_id !== access.companyId) {
    return json(409, { error: 'This account already belongs to another active company workspace.' });
  }
  if (activeMembership?.company_id === access.companyId) {
    return json(409, { error: 'This account is already an active member of this company.' });
  }

  const { data: pendingMemberships, error: pendingMembershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id,company_id,role_in_company,status')
    .eq('user_id', targetUser.id)
    .eq('status', 'invited')
    .limit(2);
  if (pendingMembershipError) {
    return json(500, { error: 'Pending Fleet Manager invitations could not be verified.' });
  }
  const conflictingInvitation = (pendingMemberships ?? []).find(
    (membership) => membership.company_id !== access.companyId
  );
  if (conflictingInvitation) {
    return json(409, { error: 'This account already has a pending invitation for another company workspace.' });
  }
  const conflictingSameCompanyRole = (pendingMemberships ?? []).find(
    (membership) =>
      membership.company_id === access.companyId
      && String(membership.role_in_company ?? '').trim().toLowerCase() !== 'fleet_manager'
  );
  if (conflictingSameCompanyRole) {
    return json(409, { error: 'This account already has a pending invitation for a different company role.' });
  }

  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from('profiles')
    .select('role,company_id,status')
    .eq('user_id', targetUser.id)
    .maybeSingle();
  if (profileLookupError) return json(500, { error: 'Fleet Manager profile could not be verified.' });
  const profileRole = String(existingProfile?.role ?? '').trim().toLowerCase();
  if (profileRole && profileRole !== 'company_staff') {
    return json(409, { error: 'This account already has a different platform workspace identity.' });
  }
  if (String(existingProfile?.status ?? '').trim().toLowerCase() === 'active') {
    return json(409, { error: 'This account already has an active platform profile and cannot be reprovisioned by invitation.' });
  }
  if (existingProfile?.company_id && existingProfile.company_id !== access.companyId) {
    return json(409, { error: 'This account is already bound to another company identity.' });
  }

  if (existingAuthUser) {
    const { error: magicLinkError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getAuthCallbackEmailRedirectTo()}?flow=team-invite&workspace=fleet_manager`,
      },
    });
    if (magicLinkError) {
      return json(503, { error: 'Existing Fleet Manager invitation email could not be sent.' });
    }
  }

  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
    app_metadata: {
      ...(targetUser.app_metadata ?? {}),
      role: 'company_staff',
      workspace_role: 'fleet_manager',
    },
  });
  if (metadataError) {
    return json(500, { error: 'Fleet Manager authority metadata could not be initialized.' });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      user_id: targetUser.id,
      full_name: parsed.data.displayName,
      phone: parsed.data.phone?.trim() || null,
      role: normalizeProfileRoleForStorage('company_staff') ?? 'company_staff',
      status: 'pending',
      company_id: access.companyId,
      is_driver: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (profileError) {
    return json(500, { error: `Fleet Manager profile could not be saved: ${profileError.message}` });
  }

  const { data: existingInvitation, error: existingInvitationError } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', access.companyId)
    .eq('user_id', targetUser.id)
    .eq('status', 'invited')
    .maybeSingle();
  if (existingInvitationError) {
    return json(500, { error: 'Existing Fleet Manager invitation could not be verified.' });
  }

  const membershipWrite = existingInvitation?.id
    ? supabaseAdmin
        .from('company_memberships')
        .update({
          invited_email: email,
          role_in_company: 'fleet_manager',
          status: 'invited',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingInvitation.id)
    : supabaseAdmin
        .from('company_memberships')
        .upsert({
          company_id: access.companyId,
          user_id: targetUser.id,
          invited_email: email,
          role_in_company: 'fleet_manager',
          status: 'invited',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,user_id' });

  const { data: manager, error: membershipError } = await membershipWrite
    .select('id,user_id,invited_email,role_in_company,status,created_at,updated_at')
    .maybeSingle();

  if (membershipError) {
    return json(500, { error: `Fleet Manager membership could not be saved: ${membershipError.message}` });
  }

  return json(201, { manager, inviteSent: true, delivery });
}
