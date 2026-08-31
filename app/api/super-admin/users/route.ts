import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const SUPPORTED_ROLES = ['driver', 'owner', 'customer', 'dispatcher', 'platform_admin', 'company_admin'] as const;
const UNSUPPORTED_ROLE_FILTERS = ['broker'] as const;
type SupportedRoleFilter = (typeof SUPPORTED_ROLES)[number];
type UnsupportedRoleFilter = (typeof UNSUPPORTED_ROLE_FILTERS)[number];
type RoleFilter = SupportedRoleFilter | UnsupportedRoleFilter;

type MembershipUserRow = {
  user_id: string | null;
  invited_email: string | null;
  role_in_company: string | null;
  created_at: string;
  company_id: string | null;
  companies: { name?: string; status?: string } | null;
};

type ProfileSummaryRow = {
  user_id: string;
  full_name: string | null;
  role?: string | null;
  status?: string | null;
  company_id?: string | null;
  created_at?: string;
};

type CompanySummaryRow = {
  id: string;
  name: string;
  status: string | null;
};

const loadAuthEmailMap = async (userIds: string[]) => {
  if (!supabaseAdmin) return new Map<string, string | null>();
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data, error } = await supabaseAdmin!.auth.admin.getUserById(userId);
      return [userId, error ? null : data.user?.email ?? null] as const;
    }),
  );
  return new Map<string, string | null>(entries);
};

const loadProfileMap = async (userIds: string[]) => {
  const profileMap = new Map<string, ProfileSummaryRow>();
  if (!supabaseAdmin || userIds.length === 0) return { profileMap, error: null as string | null };

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', Array.from(new Set(userIds)));

  if (error) return { profileMap, error: error.message };
  for (const profile of (profiles ?? []) as ProfileSummaryRow[]) {
    profileMap.set(profile.user_id, profile);
  }
  return { profileMap, error: null as string | null };
};

const loadCompanyMap = async (companyIds: string[]) => {
  const companyMap = new Map<string, CompanySummaryRow>();
  if (!supabaseAdmin || companyIds.length === 0) return { companyMap, error: null as string | null };

  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, status')
    .in('id', Array.from(new Set(companyIds)));

  if (error) return { companyMap, error: error.message };
  for (const company of (companies ?? []) as CompanySummaryRow[]) {
    companyMap.set(company.id, company);
  }
  return { companyMap, error: null as string | null };
};

const fetchMembershipUsers = async ({
  membershipRoles,
  offset,
  limit,
  responseRole,
  rowRole,
}: {
  membershipRoles: string[];
  offset: number;
  limit: number;
  responseRole: SupportedRoleFilter;
  rowRole: string;
}) => {
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  let membersQuery = supabaseAdmin
    .from('company_memberships')
    .select('user_id, invited_email, role_in_company, created_at, company_id, companies:company_id(name, status)', { count: 'exact' })
    .order('created_at', { ascending: false });

  membersQuery = membershipRoles.length === 1
    ? membersQuery.eq('role_in_company', membershipRoles[0])
    : membersQuery.in('role_in_company', membershipRoles);

  const { data: members, error: membersErr, count } = await membersQuery.range(offset, offset + limit - 1);
  if (membersErr) return respond(500, { error: membersErr.message });

  const typedMembers = (members ?? []) as MembershipUserRow[];
  const total = count ?? 0;
  const userIds = typedMembers
    .map((member) => member.user_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const { profileMap, error: profileError } = await loadProfileMap(userIds);
  if (profileError) return respond(500, { error: profileError });

  const authLookupIds = typedMembers
    .filter((member) => !member.invited_email && member.user_id)
    .map((member) => member.user_id as string);
  const authEmailMap = await loadAuthEmailMap(authLookupIds);

  return respond(200, {
    rows: typedMembers.map((member) => {
      const userId = member.user_id ?? '';
      const profile = profileMap.get(userId);
      return {
        id: userId || `${member.company_id ?? 'company'}:${member.created_at}`,
        user_id: member.user_id,
        name: profile?.full_name ?? '—',
        email: member.invited_email ?? authEmailMap.get(userId) ?? '—',
        status: member.companies?.status ?? '—',
        role: rowRole,
        company: member.companies?.name ?? '—',
        company_id: member.company_id,
        created_at: member.created_at,
      };
    }),
    total,
    role: responseRole,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: (Math.floor(offset / limit) + 1) * limit < total,
      hasPrevPage: offset > 0,
    },
  });
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const roleParam = (searchParams.get('role') ?? '').toLowerCase() as RoleFilter;
  const parsedLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const parsedPage = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(500, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 50));
  const page = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);
  const offset = (page - 1) * limit;

  if ((UNSUPPORTED_ROLE_FILTERS as readonly string[]).includes(roleParam)) {
    return respond(400, {
      error: `Unsupported role filter: ${roleParam}. No canonical company_memberships.role_in_company mapping exists for this filter.`,
    });
  }

  if (roleParam && !(SUPPORTED_ROLES as readonly string[]).includes(roleParam)) {
    return respond(400, { error: `Invalid role filter. Allowed: ${SUPPORTED_ROLES.join(', ')}` });
  }

  try {
    if (roleParam === 'driver') {
      const { data: drivers, error: driversErr, count } = await supabaseAdmin
        .from('drivers')
        .select(
          'id, user_id, name, full_name, display_name, email, phone, status, availability_status, app_access, created_at, company_id, companies:company_id(name)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (driversErr) return respond(500, { error: driversErr.message });

      const total = count ?? 0;
      const rows = (drivers ?? []).map((driver: Record<string, unknown>) => ({
        id: driver.id,
        user_id: driver.user_id,
        name:
          (driver.display_name as string | null) ??
          (driver.full_name as string | null) ??
          (driver.name as string | null) ??
          'Unknown',
        email: driver.email ?? '—',
        phone: driver.phone ?? '—',
        status: driver.status ?? 'unknown',
        availability_status: driver.availability_status ?? '—',
        app_access: driver.app_access ?? false,
        company: (driver.companies as { name?: string } | null)?.name ?? '—',
        company_id: driver.company_id ?? null,
        created_at: driver.created_at,
        role: 'driver',
      }));

      return respond(200, {
        rows,
        total,
        role: 'driver',
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      });
    }

    if (roleParam === 'platform_admin') {
      const { data: profiles, error: profilesErr, count } = await supabaseAdmin
        .from('profiles')
        .select('user_id, full_name, role, status, created_at', { count: 'exact' })
        .eq('role', 'owner')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (profilesErr) return respond(500, { error: profilesErr.message });

      const typedProfiles = (profiles ?? []) as ProfileSummaryRow[];
      const authEmailMap = await loadAuthEmailMap(typedProfiles.map((profile) => profile.user_id));
      const total = count ?? 0;
      const rows = typedProfiles.map((profile) => ({
        id: profile.user_id,
        user_id: profile.user_id,
        name: profile.full_name ?? 'Platform Admin',
        email: authEmailMap.get(profile.user_id) ?? '—',
        status: profile.status ?? 'active',
        role: 'owner',
        created_at: profile.created_at,
      }));

      return respond(200, {
        rows,
        total,
        role: 'platform_admin',
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      });
    }

    if (roleParam === 'owner') {
      return fetchMembershipUsers({
        membershipRoles: ['owner'],
        offset,
        limit,
        responseRole: 'owner',
        rowRole: 'company_owner',
      });
    }

    if (roleParam === 'customer') {
      const { data: profiles, error: profilesErr, count } = await supabaseAdmin
        .from('profiles')
        .select('user_id, full_name, role, status, company_id, created_at', { count: 'exact' })
        .eq('role', 'customer')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (profilesErr) return respond(500, { error: profilesErr.message });

      const typedProfiles = (profiles ?? []) as ProfileSummaryRow[];
      const authEmailMap = await loadAuthEmailMap(typedProfiles.map((profile) => profile.user_id));
      const companyIds = typedProfiles
        .map((profile) => profile.company_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
      const { companyMap, error: companyError } = await loadCompanyMap(companyIds);
      if (companyError) return respond(500, { error: companyError });

      const total = count ?? 0;
      const rows = typedProfiles.map((profile) => {
        const company = profile.company_id ? companyMap.get(profile.company_id) : undefined;
        return {
          id: profile.user_id,
          user_id: profile.user_id,
          name: profile.full_name ?? '—',
          email: authEmailMap.get(profile.user_id) ?? '—',
          status: company?.status ?? profile.status ?? '—',
          role: 'customer',
          company: company?.name ?? '—',
          company_id: profile.company_id ?? null,
          created_at: profile.created_at,
        };
      });

      return respond(200, {
        rows,
        total,
        role: 'customer',
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      });
    }

    if (roleParam === 'dispatcher') {
      return fetchMembershipUsers({
        membershipRoles: ['dispatcher'],
        offset,
        limit,
        responseRole: 'dispatcher',
        rowRole: 'dispatcher',
      });
    }

    if (roleParam === 'company_admin') {
      return fetchMembershipUsers({
        membershipRoles: ['owner', 'admin'],
        offset,
        limit,
        responseRole: 'company_admin',
        rowRole: 'company_admin',
      });
    }

    const [driversRes, profilesRes] = await Promise.all([
      supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('profiles')
        .select('user_id, full_name, role, status, company_id, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    if (driversRes.error) return respond(500, { error: driversRes.error.message });
    if (profilesRes.error) return respond(500, { error: profilesRes.error.message });

    const profiles = (profilesRes.data ?? []) as ProfileSummaryRow[];
    const authEmailMap = await loadAuthEmailMap(profiles.map((profile) => profile.user_id));
    const companyIds = profiles
      .map((profile) => profile.company_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const { companyMap, error: companyError } = await loadCompanyMap(companyIds);
    if (companyError) return respond(500, { error: companyError });

    const roleCounts: Record<string, number> = {};
    for (const profile of profiles) {
      const role = profile.role ?? 'unknown';
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }

    const rows = profiles.map((profile) => {
      const company = profile.company_id ? companyMap.get(profile.company_id) : undefined;
      return {
        id: profile.user_id,
        user_id: profile.user_id,
        name: profile.full_name ?? '—',
        email: authEmailMap.get(profile.user_id) ?? '—',
        status: company?.status ?? profile.status ?? '—',
        company: company?.name ?? '—',
        company_id: profile.company_id ?? null,
        role: profile.role ?? '—',
        created_at: profile.created_at,
      };
    });

    return respond(200, {
      rows,
      total: profilesRes.count ?? rows.length,
      totalDrivers: driversRes.count ?? 0,
      roleCounts,
      role: 'all',
      pagination: {
        page,
        limit,
        total: profilesRes.count ?? rows.length,
        totalPages: Math.ceil((profilesRes.count ?? rows.length) / limit),
        hasNextPage: page * limit < (profilesRes.count ?? rows.length),
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return respond(500, { error: message });
  }
}
