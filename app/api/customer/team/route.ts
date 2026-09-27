import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthCallbackEmailRedirectTo,
  getResetPasswordEmailRedirectTo,
} from '../../../../lib/authFlow';
import { normalizeProfileRoleForStorage } from '../../../../lib/authRole';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const ROLE_VALUES = ['owner', 'admin', 'dispatcher', 'viewer'] as const;
const ACTIVE_MANAGEMENT_ROLES = ['owner', 'admin'] as const;

const inviteSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'dispatcher', 'viewer']).default('viewer'),
  workspace: z.enum(['customer', 'broker']),
  departmentId: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  action: z.enum(['role', 'department', 'suspend', 'reactivate', 'remove']),
  role: z.enum(ROLE_VALUES).optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

const resolveCaller = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Team service is not configured.' }) };
  }

  const admin = supabaseAdmin;
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized - missing bearer token.' }) };

  const validatorClient = supabaseValidator ?? admin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);

  if (authError || !user) {
    return { error: json(401, { error: 'Unauthorized - invalid or expired token.' }) };
  }

  return { admin, user };
};

const getCallerMembership = async (
  companyId: string,
  userId: string
) => {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company, status')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return data;
};

const userCanManage = (role: string | null | undefined) =>
  ACTIVE_MANAGEMENT_ROLES.includes((role ?? '') as (typeof ACTIVE_MANAGEMENT_ROLES)[number]);

const findAuthUserByEmail = async (email: string) => {
  if (!supabaseAdmin) return null;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
};

const expectedWorkspaceProfileRole = (workspace: 'customer' | 'broker') =>
  normalizeProfileRoleForStorage(workspace) ?? workspace;

export async function GET(request: NextRequest) {
  const resolved = await resolveCaller(request);
  if ('error' in resolved) return resolved.error;
  const { admin, user } = resolved;

  const companyId = request.nextUrl.searchParams.get('companyId')?.trim();
  if (!companyId) return json(400, { error: 'companyId is required.' });

  const callerMembership = await getCallerMembership(companyId, user.id);
  if (!callerMembership || callerMembership.status !== 'active') {
    return json(403, { error: 'Forbidden - active company membership is required.' });
  }

  const { data: memberships, error: membershipsError } = await admin
    .from('company_memberships')
    .select('id, user_id, invited_email, role_in_company, status, department_id, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(250);

  if (membershipsError) return json(500, { error: membershipsError.message });

  const membershipRows = memberships ?? [];
  const userIds = membershipRows
    .map((membership) => membership.user_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const profileByUserId = new Map<
    string,
    { full_name: string | null; phone: string | null; status: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('user_id, full_name, phone, status')
      .in('user_id', userIds);

    if (profilesError) return json(500, { error: profilesError.message });

    for (const profile of profiles ?? []) {
      profileByUserId.set(profile.user_id, {
        full_name: profile.full_name ?? null,
        phone: profile.phone ?? null,
        status: profile.status ?? null,
      });
    }
  }

  const emailEntries = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      return [userId, error ? null : data.user?.email ?? null] as const;
    })
  );
  const emailByUserId = new Map(emailEntries);

  const { data: departments, error: departmentsError } = await admin
    .from('company_departments')
    .select('id,name,description')
    .eq('company_id', companyId)
    .order('name', { ascending: true });
  if (departmentsError) return json(500, { error: departmentsError.message });
  const departmentById = new Map((departments ?? []).map((department) => [department.id, department.name] as const));

  return json(200, {
    canManageTeam: userCanManage(callerMembership.role_in_company),
    departments: departments ?? [],
    members: membershipRows.map((membership) => {
      const profile = membership.user_id
        ? profileByUserId.get(membership.user_id)
        : undefined;
      const accountEmail = membership.user_id
        ? emailByUserId.get(membership.user_id) ?? null
        : null;

      return {
        id: membership.id,
        userId: membership.user_id,
        fullName: profile?.full_name ?? null,
        email: membership.invited_email ?? accountEmail,
        phone: profile?.phone ?? null,
        role: membership.role_in_company,
        departmentId: membership.department_id ?? null,
        departmentName: membership.department_id ? departmentById.get(membership.department_id) ?? null : null,
        membershipStatus: membership.status,
        profileStatus: profile?.status ?? null,
        createdAt: membership.created_at,
        isCurrentUser: membership.user_id === user.id,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveCaller(request);
  if ('error' in resolved) return resolved.error;
  const { admin, user } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const companyId = parsed.data.companyId;
  const callerMembership = await getCallerMembership(companyId, user.id);
  if (!callerMembership || callerMembership.status !== 'active' || !userCanManage(callerMembership.role_in_company)) {
    return json(403, { error: 'Forbidden - owner/admin membership is required.' });
  }

  const invitedEmail = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role;
  const workspace = parsed.data.workspace;
  const targetProfileRole = expectedWorkspaceProfileRole(workspace);

  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (callerProfileError) return json(500, { error: 'Caller workspace identity could not be verified.' });
  const callerProfileRole = String(callerProfile?.role ?? '').trim().toLowerCase();
  if (callerProfileRole !== workspace && callerProfileRole !== 'owner') {
    return json(403, { error: 'This team invitation does not match your active workspace.' });
  }

  if (parsed.data.departmentId) {
    const { data: department, error: departmentError } = await admin
      .from('company_departments')
      .select('id')
      .eq('id', parsed.data.departmentId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (departmentError) return json(500, { error: 'Department could not be verified.' });
    if (!department) return json(400, { error: 'Department does not belong to this company.' });
  }

  let targetUser = await findAuthUserByEmail(invitedEmail);
  const existingAuthUser = Boolean(targetUser);
  const delivery: 'auth_invite' | 'magic_link' = existingAuthUser ? 'magic_link' : 'auth_invite';

  if (!targetUser) {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(invitedEmail, {
      redirectTo: `${getResetPasswordEmailRedirectTo()}?flow=team-invite&workspace=${workspace}`,
      data: { requested_workspace: workspace, invitation_kind: 'company_team' },
    });
    if (inviteError || !inviteData.user) {
      return json(503, { error: inviteError?.message ?? 'Invitation email could not be sent.' });
    }
    targetUser = inviteData.user;
  }

  const { data: existingActiveMembership, error: activeMembershipError } = await admin
    .from('company_memberships')
    .select('id, company_id, status')
    .eq('user_id', targetUser.id)
    .eq('status', 'active')
    .maybeSingle();
  if (activeMembershipError) return json(500, { error: 'Existing membership could not be verified.' });
  if (existingActiveMembership?.company_id && existingActiveMembership.company_id !== companyId) {
    return json(409, { error: 'This account already belongs to another active company workspace.' });
  }
  if (existingActiveMembership?.company_id === companyId) {
    return json(409, { error: 'This account is already an active member of this company.' });
  }

  const { data: pendingMemberships, error: pendingMembershipsError } = await admin
    .from('company_memberships')
    .select('id, company_id, invited_email, status')
    .eq('user_id', targetUser.id)
    .eq('status', 'invited')
    .limit(2);
  if (pendingMembershipsError) return json(500, { error: 'Pending invitations could not be verified.' });
  const conflictingPendingMembership = (pendingMemberships ?? []).find(
    (membership) => membership.company_id !== companyId
  );
  if (conflictingPendingMembership) {
    return json(409, { error: 'This account already has a pending invitation for another company workspace.' });
  }

  const { data: existingProfile, error: profileLookupError } = await admin
    .from('profiles')
    .select('role, company_id, status')
    .eq('user_id', targetUser.id)
    .maybeSingle();
  if (profileLookupError) return json(500, { error: 'Invitee profile could not be verified.' });
  const existingProfileRole = String(existingProfile?.role ?? '').trim().toLowerCase();
  if (existingProfileRole && existingProfileRole !== targetProfileRole) {
    return json(409, { error: 'This account already has a different platform workspace identity.' });
  }
  if (existingProfile?.company_id && existingProfile.company_id !== companyId) {
    return json(409, { error: 'This account is already bound to another company identity.' });
  }

  if (existingAuthUser) {
    const { error: magicLinkError } = await admin.auth.signInWithOtp({
      email: invitedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getAuthCallbackEmailRedirectTo()}?flow=team-invite&workspace=${workspace}`,
      },
    });
    if (magicLinkError) return json(503, { error: 'Existing account invitation email could not be sent.' });
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(targetUser.id, {
    app_metadata: { ...(targetUser.app_metadata ?? {}), role: targetProfileRole },
  });
  if (metadataError) return json(500, { error: 'Invitee authority metadata could not be initialized.' });

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      user_id: targetUser.id,
      role: targetProfileRole,
      status: 'pending',
      company_id: companyId,
      is_driver: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (profileError) return json(500, { error: 'Invitee profile could not be initialized.' });

  const { data: existingInvitation } = await admin
    .from('company_memberships')
    .select('id')
    .eq('company_id', companyId)
    .eq('invited_email', invitedEmail)
    .eq('status', 'invited')
    .maybeSingle();

  const membershipWrite = existingInvitation?.id
    ? admin.from('company_memberships').update({
        user_id: targetUser.id,
        role_in_company: role,
        department_id: parsed.data.departmentId ?? null,
        status: 'invited',
        updated_at: new Date().toISOString(),
      }).eq('id', existingInvitation.id)
    : admin.from('company_memberships').upsert({
        company_id: companyId,
        user_id: targetUser.id,
        invited_email: invitedEmail,
        role_in_company: role,
        department_id: parsed.data.departmentId ?? null,
        status: 'invited',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,user_id' });

  const { data: inserted, error: insertError } = await membershipWrite
    .select('id, user_id, invited_email, role_in_company, department_id, status, created_at')
    .maybeSingle();

  if (insertError) return json(500, { error: insertError.message });

  return json(201, { invitation: inserted, delivery });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveCaller(request);
  if ('error' in resolved) return resolved.error;
  const { admin, user } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { companyId, membershipId, action, role, departmentId } = parsed.data;

  const callerMembership = await getCallerMembership(companyId, user.id);
  if (!callerMembership || callerMembership.status !== 'active' || !userCanManage(callerMembership.role_in_company)) {
    return json(403, { error: 'Forbidden - owner/admin membership is required.' });
  }

  const { data: membership, error: membershipError } = await admin
    .from('company_memberships')
    .select('id, user_id, role_in_company, status')
    .eq('id', membershipId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (membershipError) return json(500, { error: membershipError.message });
  if (!membership) return json(404, { error: 'Membership not found.' });
  if (membership.user_id === user.id && action !== 'department') return json(400, { error: 'You cannot change your own role or membership status here.' });

  const callerRole = String(callerMembership.role_in_company ?? '');
  const targetRole = String(membership.role_in_company ?? '');
  if (callerRole !== 'owner' && targetRole === 'owner') {
    return json(403, { error: 'Only owner can modify owner memberships.' });
  }

  const { count: activeOwnerCount } = await admin
    .from('company_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role_in_company', 'owner')
    .eq('status', 'active');

  const removingOnlyOwner =
    activeOwnerCount === 1 &&
    membership.role_in_company === 'owner' &&
    membership.status === 'active' &&
    (action === 'remove' || action === 'suspend' || (action === 'role' && role !== 'owner'));
  if (removingOnlyOwner) {
    return json(400, { error: 'Cannot remove or demote the only active owner.' });
  }

  if (action === 'remove') {
    const { error: removeError } = await admin
      .from('company_memberships')
      .delete()
      .eq('id', membershipId)
      .eq('company_id', companyId);
    if (removeError) return json(500, { error: removeError.message });
    return json(200, { removed: true, membershipId });
  }

  const updatePayload: Record<string, unknown> = {};
  if (action === 'role') {
    if (!role) return json(400, { error: 'role is required for action=role.' });
    if (role === 'owner' && callerRole !== 'owner') {
      return json(403, { error: 'Only owner can assign owner role.' });
    }
    updatePayload.role_in_company = role;
  } else if (action === 'department') {
    const { data: departmentUpdated, error: departmentError } = await admin
      .rpc('assign_company_membership_department', {
        p_company_id: companyId,
        p_actor_user_id: user.id,
        p_membership_id: membershipId,
        p_department_id: departmentId ?? null,
      })
      .maybeSingle();
    if (departmentError) {
      if (departmentError.code === 'P0002') return json(404, { error: 'Membership not found.' });
      if (departmentError.code === '42501') return json(403, { error: 'Department assignment is outside this company workspace.' });
      return json(500, { error: 'Department assignment failed.' });
    }
    return json(200, { membership: departmentUpdated });
  } else if (action === 'suspend') {
    updatePayload.status = 'disabled';
  } else if (action === 'reactivate') {
    updatePayload.status = 'active';
  }

  const { data: updated, error: updateError } = await admin
    .from('company_memberships')
    .update(updatePayload)
    .eq('id', membershipId)
    .eq('company_id', companyId)
    .select('id, user_id, invited_email, role_in_company, status, department_id, created_at')
    .maybeSingle();

  if (updateError) return json(500, { error: updateError.message });
  return json(200, { membership: updated });
}
