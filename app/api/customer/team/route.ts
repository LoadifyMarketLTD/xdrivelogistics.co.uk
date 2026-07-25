import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
});

const updateSchema = z.object({
  companyId: z.string().uuid(),
  membershipId: z.string().uuid(),
  action: z.enum(['role', 'suspend', 'reactivate', 'remove']),
  role: z.enum(ROLE_VALUES).optional(),
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
    .select('id, user_id, invited_email, role_in_company, status, created_at')
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

  return json(200, {
    canManageTeam: userCanManage(callerMembership.role_in_company),
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

  const { data: inserted, error: insertError } = await admin
    .from('company_memberships')
    .upsert(
      {
        company_id: companyId,
        invited_email: invitedEmail,
        role_in_company: role,
        status: 'invited',
        user_id: null,
      },
      { onConflict: 'company_id,invited_email' }
    )
    .select('id, invited_email, role_in_company, status, created_at')
    .maybeSingle();

  if (insertError) return json(500, { error: insertError.message });

  return json(201, { invitation: inserted });
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

  const { companyId, membershipId, action, role } = parsed.data;

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
  if (membership.user_id === user.id) return json(400, { error: 'You cannot change your own membership here.' });

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
  } else if (action === 'suspend') {
    updatePayload.status = 'suspended';
  } else if (action === 'reactivate') {
    updatePayload.status = 'active';
  }

  const { data: updated, error: updateError } = await admin
    .from('company_memberships')
    .update(updatePayload)
    .eq('id', membershipId)
    .eq('company_id', companyId)
    .select('id, user_id, invited_email, role_in_company, status, created_at')
    .maybeSingle();

  if (updateError) return json(500, { error: updateError.message });
  return json(200, { membership: updated });
}
