import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

const SUPPORTED_ROLES = ['driver', 'owner', 'customer', 'dispatcher', 'platform_admin', 'company_admin'] as const;
const UNSUPPORTED_ROLE_FILTERS = ['broker'] as const;
type SupportedRoleFilter = (typeof SUPPORTED_ROLES)[number];
type UnsupportedRoleFilter = (typeof UNSUPPORTED_ROLE_FILTERS)[number];
type RoleFilter = SupportedRoleFilter | UnsupportedRoleFilter;

type MembershipUserRow = {
  user_id: string | null;
  role_in_company: string | null;
  created_at: string;
  company_id: string | null;
  companies: { name?: string; status?: string } | null;
};

type ProfileSummaryRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
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
    .select('user_id, role_in_company, created_at, company_id, companies:company_id(name, status)', { count: 'exact' })
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

  let profileMap = new Map<string, { name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('user_id, display_name, email')
      .in('user_id', userIds);
    if (profilesErr) return respond(500, { error: profilesErr.message });

    profileMap = new Map(
      ((profiles ?? []) as ProfileSummaryRow[]).map((profile) => [
        profile.user_id,
        { name: profile.display_name ?? '—', email: profile.email ?? '—' },
      ]),
    );
  }

  return respond(200, {
    rows: typedMembers.map((member) => {
      const userId = member.user_id ?? '';
      const profile = profileMap.get(userId);
      return {
        id: userId || `${member.company_id ?? 'company'}:${member.created_at}`,
        user_id: member.user_id,
        name: profile?.name ?? '—',
        email: profile?.email ?? '—',
        status: member.companies?.status ?? '—',
        role: rowRole,
        company: member.companies?.name ?? '—',
        company_id: member.company_id,
        created_at: member.created_at,
      };
    }),
    total,
    role: responseRole,
    pagination: { page: Math.floor(offset / limit) + 1, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: (Math.floor(offset / limit) + 1) * limit < total, hasPrevPage: offset > 0 },
  });
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const roleParam = (searchParams.get('role') ?? '').toLowerCase() as RoleFilter;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
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
    // ── Driver users ─────────────────────────────────────────────────────────
    if (roleParam === 'driver') {
      const { data: drivers, error: driversErr, count } = await supabaseAdmin
        .from('drivers')
        .select(
          'id, user_id, first_name, last_name, email, phone, status, availability_status, app_access, created_at, company_id, companies:company_id(name)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (driversErr) return respond(500, { error: driversErr.message });

      const total = count ?? 0;

      const rows = (drivers ?? []).map((d: Record<string, unknown>) => ({
        id: d.id,
        user_id: d.user_id,
        name: [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: d.email ?? '—',
        phone: d.phone ?? '—',
        status: d.status ?? 'unknown',
        availability_status: d.availability_status ?? '—',
        app_access: d.app_access ?? false,
        company: (d.companies as { name?: string } | null)?.name ?? '—',
        company_id: d.company_id ?? null,
        created_at: d.created_at,
        role: 'driver',
      }));

      return respond(200, {
        rows,
        total,
        role: 'driver',
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
      });
    }

    // ── Platform admins (owner role in profiles) ──────────────────────────────
    if (roleParam === 'platform_admin') {
      const { data: profiles, error: profilesErr, count } = await supabaseAdmin
        .from('profiles')
        .select('user_id, display_name, email, role, created_at', { count: 'exact' })
        .eq('role', 'owner')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (profilesErr) return respond(500, { error: profilesErr.message });

      const total = count ?? 0;
      const rows = (profiles ?? []).map((p: Record<string, unknown>) => ({
        id: p.user_id,
        user_id: p.user_id,
        name: (p.display_name as string | null) ?? 'Platform Admin',
        email: (p.email as string | null) ?? '—',
        status: 'active',
        role: 'owner',
        created_at: p.created_at,
      }));

      return respond(200, {
        rows, total, role: 'platform_admin',
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
      });
    }

    // ── Company owners (owner role in company_memberships) ────────────────────────
    if (roleParam === 'owner') {
      return fetchMembershipUsers({
        membershipRoles: ['owner'],
        offset,
        limit,
        responseRole: 'owner',
        rowRole: 'company_owner',
      });
    }

    // ── Customers ─────────────────────────────────────────────────────────────
    if (roleParam === 'customer') {
      return fetchMembershipUsers({
        membershipRoles: ['customer'],
        offset,
        limit,
        responseRole: 'customer',
        rowRole: 'customer',
      });
    }

    // ── Dispatchers ───────────────────────────────────────────────────────────
    if (roleParam === 'dispatcher') {
      return fetchMembershipUsers({
        membershipRoles: ['dispatcher'],
        offset,
        limit,
        responseRole: 'dispatcher',
        rowRole: 'dispatcher',
      });
    }

    // ── Company admins (company_admin app role = owner/admin membership) ─────
    if (roleParam === 'company_admin') {
      return fetchMembershipUsers({
        membershipRoles: ['owner', 'admin'],
        offset,
        limit,
        responseRole: 'company_admin',
        rowRole: 'company_admin',
      });
    }

    // ── All users (summary) ───────────────────────────────────────────────────
    const [driversRes, profilesRes, membersRes] = await Promise.all([
      supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('user_id, role, created_at').order('created_at', { ascending: false }).limit(limit),
      supabaseAdmin
        .from('company_memberships')
        .select('user_id, role_in_company, company_id, companies:company_id(name)', { count: 'exact' })
        .order('role_in_company')
        .limit(limit),
    ]);

    if (driversRes.error) return respond(500, { error: driversRes.error.message });
    if (profilesRes.error) return respond(500, { error: profilesRes.error.message });
    if (membersRes.error) return respond(500, { error: membersRes.error.message });

    const profiles = profilesRes.data ?? [];
    const members = membersRes.data ?? [];

    const roleCounts: Record<string, number> = {};
    for (const m of members) {
      const role = (m as Record<string, unknown>).role_in_company as string | null;
      if (role) roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }
    for (const p of profiles) {
      const role = (p as Record<string, unknown>).role as string | null;
      if (role === 'owner') roleCounts['platform_admin'] = (roleCounts['platform_admin'] ?? 0) + 1;
    }

    const rows = profiles.map((p: Record<string, unknown>) => ({
      id: p.user_id,
      user_id: p.user_id,
      name: (p as { display_name?: string }).display_name ?? '—',
      email: (p as { email?: string }).email ?? '—',
      role: p.role ?? '—',
      created_at: p.created_at,
    }));

    return respond(200, {
      rows,
      total: rows.length,
      totalDrivers: driversRes.count ?? 0,
      roleCounts,
      role: 'all',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return respond(500, { error: message });
  }
}
