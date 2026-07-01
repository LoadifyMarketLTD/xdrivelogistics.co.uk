import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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

const classifyGroup = (key: string) => {
  if (key.startsWith('platform_')) return 'Platform';
  if (key.startsWith('marketplace_')) return 'Marketplace';
  if (key.startsWith('compliance_')) return 'Compliance';
  if (key.startsWith('onboarding_')) return 'Onboarding';
  if (key.startsWith('finance_')) return 'Finance';
  if (key.startsWith('notification_')) return 'Notifications';
  if (key.startsWith('supabase_')) return 'Infrastructure';
  return 'General';
};

const normalizeFlagStatus = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (['enabled', 'true', 'on', '1'].includes(normalized)) return 'enabled';
  if (['disabled', 'false', 'off', '0'].includes(normalized)) return 'disabled';
  return 'pending';
};

type AppSettingRow = { key: string; value: string; created_at: string };
type ProfileRoleRow = { role: string | null; updated_at: string | null };
type MembershipRoleRow = { role_in_company: string | null; status: string | null; updated_at: string | null };

const fetchSettings = async () => {
  const result = await supabaseAdmin!
    .from('app_settings')
    .select('key, value, created_at')
    .order('key', { ascending: true });
  return result;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();

  if (section === 'global') {
    const { data, error } = await fetchSettings();

    if (error && !['PGRST205', '42P01'].includes(error.code ?? '')) {
      return respond(500, { error: error.message });
    }

    const rows = ((data ?? []) as AppSettingRow[])
      .filter((row) => !row.key.startsWith('feature_flag_'))
      .map((row) => ({
        id: row.key,
        group: classifyGroup(row.key),
        key: row.key,
        value: row.value,
        created_at: row.created_at,
      }));

    return respond(200, {
      rows,
      summary: {
        total: rows.length,
        groups: new Set(rows.map((row) => row.group)).size,
      },
      note: rows.length === 0 ? 'No runtime settings found in app_settings.' : undefined,
    });
  }

  if (section === 'feature-flags') {
    const { data, error } = await fetchSettings();

    if (error && !['PGRST205', '42P01'].includes(error.code ?? '')) {
      return respond(500, { error: error.message });
    }

    const rows = ((data ?? []) as AppSettingRow[])
      .filter((row) => row.key.startsWith('feature_flag_'))
      .map((row) => {
        const status = normalizeFlagStatus(row.value);
        return {
          id: row.key,
          key: row.key,
          status,
          source_value: row.value,
          created_at: row.created_at,
        };
      });

    return respond(200, {
      rows,
      summary: {
        total: rows.length,
        enabled: rows.filter((row) => row.status === 'enabled').length,
        disabled: rows.filter((row) => row.status === 'disabled').length,
        pending: rows.filter((row) => row.status === 'pending').length,
      },
      note: rows.length === 0 ? 'No feature flags found in app_settings (expected keys: feature_flag_*).' : undefined,
    });
  }

  if (section === 'roles-permissions') {
    const [profilesResult, membershipsResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('role, updated_at'),
      supabaseAdmin.from('company_memberships').select('role_in_company, status, updated_at'),
    ]);

    if (profilesResult.error) return respond(500, { error: profilesResult.error.message });
    if (membershipsResult.error) return respond(500, { error: membershipsResult.error.message });

    const profileRows = (profilesResult.data ?? []) as ProfileRoleRow[];
    const membershipRows = (membershipsResult.data ?? []) as MembershipRoleRow[];

    const profileMap = new Map<string, { total: number; latest: string | null }>();
    for (const row of profileRows) {
      const role = row.role ?? 'unknown';
      const current = profileMap.get(role) ?? { total: 0, latest: null };
      current.total += 1;
      if (!current.latest || (row.updated_at && row.updated_at > current.latest)) current.latest = row.updated_at;
      profileMap.set(role, current);
    }

    const membershipMap = new Map<string, { total: number; active: number; invited: number; suspended: number; latest: string | null }>();
    for (const row of membershipRows) {
      const role = row.role_in_company ?? 'unknown';
      const current = membershipMap.get(role) ?? { total: 0, active: 0, invited: 0, suspended: 0, latest: null };
      current.total += 1;
      if (row.status === 'active') current.active += 1;
      if (row.status === 'invited') current.invited += 1;
      if (row.status === 'suspended') current.suspended += 1;
      if (!current.latest || (row.updated_at && row.updated_at > current.latest)) current.latest = row.updated_at;
      membershipMap.set(role, current);
    }

    const profileRoleRows = Array.from(profileMap.entries()).map(([role, stats]) => ({
      id: `profiles:${role}`,
      role,
      source: 'profiles',
      total_members: stats.total,
      active_members: stats.total,
      invited_members: 0,
      suspended_members: 0,
      last_updated_at: stats.latest,
    }));

    const membershipRoleRows = Array.from(membershipMap.entries()).map(([role, stats]) => ({
      id: `company_memberships:${role}`,
      role,
      source: 'company_memberships',
      total_members: stats.total,
      active_members: stats.active,
      invited_members: stats.invited,
      suspended_members: stats.suspended,
      last_updated_at: stats.latest,
    }));

    const rows = [...profileRoleRows, ...membershipRoleRows].sort((a, b) => a.role.localeCompare(b.role));

    return respond(200, {
      rows,
      summary: {
        total_roles: rows.length,
        profile_roles: profileRoleRows.length,
        membership_roles: membershipRoleRows.length,
      },
      note: 'Runtime RBAC visibility from profiles + company_memberships sources.',
    });
  }

  return respond(400, { error: 'Invalid section. Use global, feature-flags, or roles-permissions.' });
}
