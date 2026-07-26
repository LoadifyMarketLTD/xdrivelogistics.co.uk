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

const ALLOWED_ROLES = ['driver', 'owner', 'customer', 'dispatcher', 'platform_admin', 'company_admin', 'broker'] as const;
type RoleFilter = (typeof ALLOWED_ROLES)[number];

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const roleParam = (searchParams.get('role') ?? '').toLowerCase() as RoleFilter;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '250', 10), 500);

  if (roleParam && !ALLOWED_ROLES.includes(roleParam)) {
    return respond(400, { error: `Invalid role filter. Allowed: ${ALLOWED_ROLES.join(', ')}` });
  }

  try {
    // ── Driver users ─────────────────────────────────────────────────────────
    if (roleParam === 'driver') {
      const { data: drivers, error: driversErr } = await supabaseAdmin
        .from('drivers')
        .select(
          'id, user_id, first_name, last_name, email, phone, status, availability_status, app_access, created_at, company_id, companies:company_id(name)'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (driversErr) return respond(500, { error: driversErr.message });

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

      return respond(200, { rows, total: rows.length, role: 'driver' });
    }

    // ── Platform admins (owner role in profiles) ──────────────────────────────
    if (roleParam === 'platform_admin') {
      const { data: profiles, error: profilesErr } = await supabaseAdmin
        .from('profiles')
        .select('user_id, display_name, email, role, created_at')
        .eq('role', 'owner')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (profilesErr) return respond(500, { error: profilesErr.message });

      const rows = (profiles ?? []).map((p: Record<string, unknown>) => ({
        id: p.user_id,
        user_id: p.user_id,
        name: (p.display_name as string | null) ?? 'Platform Admin',
        email: (p.email as string | null) ?? '—',
        status: 'active',
        role: 'owner',
        created_at: p.created_at,
      }));

      return respond(200, { rows, total: rows.length, role: 'platform_admin' });
    }

    // ── Company owners (owner role in company_memberships) ────────────────────────
    if (roleParam === 'owner') {
      const { data: members, error: membersErr } = await supabaseAdmin
        .from('company_memberships')
        .select('user_id, role_in_company, created_at, company_id, companies:company_id(name, status)')
        .eq('role_in_company', 'owner')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (membersErr) return respond(500, { error: membersErr.message });

      // Fetch profile emails
      const userIds = (members ?? []).map((m: Record<string, unknown>) => m.user_id as string).filter(Boolean);
      let profileMap: Map<string, { name: string; email: string }> = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);
        profileMap = new Map(
          (profiles ?? []).map((p: Record<string, unknown>) => [
            p.user_id as string,
            { name: (p.display_name as string | null) ?? '—', email: (p.email as string | null) ?? '—' },
          ])
        );
      }

      const rows = (members ?? []).map((m: Record<string, unknown>) => {
        const profile = profileMap.get(m.user_id as string);
        return {
          id: m.user_id,
          user_id: m.user_id,
          name: profile?.name ?? '—',
          email: profile?.email ?? '—',
          status: (m.companies as { status?: string } | null)?.status ?? '—',
          role: 'company_owner',
          company: (m.companies as { name?: string } | null)?.name ?? '—',
          company_id: m.company_id,
          created_at: m.created_at,
        };
      });

      return respond(200, { rows, total: rows.length, role: 'owner' });
    }

    // ── Customers ─────────────────────────────────────────────────────────────
    if (roleParam === 'customer') {
      const { data: members, error: membersErr } = await supabaseAdmin
        .from('company_memberships')
        .select('user_id, role_in_company, created_at, company_id, companies:company_id(name, status)')
        .eq('role_in_company', 'customer')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (membersErr) return respond(500, { error: membersErr.message });

      const userIds = (members ?? []).map((m: Record<string, unknown>) => m.user_id as string).filter(Boolean);
      let profileMap: Map<string, { name: string; email: string }> = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);
        profileMap = new Map(
          (profiles ?? []).map((p: Record<string, unknown>) => [
            p.user_id as string,
            { name: (p.display_name as string | null) ?? '—', email: (p.email as string | null) ?? '—' },
          ])
        );
      }

      const rows = (members ?? []).map((m: Record<string, unknown>) => {
        const profile = profileMap.get(m.user_id as string);
        return {
          id: m.user_id,
          user_id: m.user_id,
          name: profile?.name ?? '—',
          email: profile?.email ?? '—',
          status: (m.companies as { status?: string } | null)?.status ?? '—',
          role: 'customer',
          company: (m.companies as { name?: string } | null)?.name ?? '—',
          company_id: m.company_id,
          created_at: m.created_at,
        };
      });

      return respond(200, { rows, total: rows.length, role: 'customer' });
    }

    // ── Dispatchers ───────────────────────────────────────────────────────────
    if (roleParam === 'dispatcher') {
      const { data: members, error: membersErr } = await supabaseAdmin
        .from('company_memberships')
        .select('user_id, role_in_company, created_at, company_id, companies:company_id(name, status)')
        .eq('role_in_company', 'dispatcher')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (membersErr) return respond(500, { error: membersErr.message });

      const userIds = (members ?? []).map((m: Record<string, unknown>) => m.user_id as string).filter(Boolean);
      let profileMap: Map<string, { name: string; email: string }> = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);
        profileMap = new Map(
          (profiles ?? []).map((p: Record<string, unknown>) => [
            p.user_id as string,
            { name: (p.display_name as string | null) ?? '—', email: (p.email as string | null) ?? '—' },
          ])
        );
      }

      const rows = (members ?? []).map((m: Record<string, unknown>) => {
        const profile = profileMap.get(m.user_id as string);
        return {
          id: m.user_id,
          user_id: m.user_id,
          name: profile?.name ?? '—',
          email: profile?.email ?? '—',
          status: (m.companies as { status?: string } | null)?.status ?? '—',
          role: 'dispatcher',
          company: (m.companies as { name?: string } | null)?.name ?? '—',
          company_id: m.company_id,
          created_at: m.created_at,
        };
      });

      return respond(200, { rows, total: rows.length, role: 'dispatcher' });
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
