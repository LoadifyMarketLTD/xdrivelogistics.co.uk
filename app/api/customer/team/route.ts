import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Team service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized - missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);

  if (authError || !user) {
    return json(401, { error: 'Unauthorized - invalid or expired token.' });
  }

  const companyId = request.nextUrl.searchParams.get('companyId')?.trim();
  if (!companyId) return json(400, { error: 'companyId is required.' });

  const { data: callerMembership, error: callerMembershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (callerMembershipError) {
    return json(500, { error: callerMembershipError.message });
  }

  if (!callerMembership?.id) {
    return json(403, { error: 'Forbidden - company membership is required.' });
  }

  const { data: memberships, error: membershipsError } = await supabaseAdmin
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
    const { data: profiles, error: profilesError } = await supabaseAdmin
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
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      return [userId, error ? null : data.user?.email ?? null] as const;
    })
  );
  const emailByUserId = new Map(emailEntries);

  return json(200, {
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
