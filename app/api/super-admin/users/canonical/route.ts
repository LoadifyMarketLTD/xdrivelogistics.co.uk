import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const CANONICAL_WORKSPACE_ROLES = [
  'platform_owner',
  'company_owner',
  'company_admin',
  'carrier_admin',
  'broker',
  'customer',
  'fleet_manager',
  'dispatcher',
  'driver',
  'owner_driver',
  'finance',
  'compliance',
  'viewer',
] as const;

type WorkspaceRole = (typeof CANONICAL_WORKSPACE_ROLES)[number];

type AuthorityGrant = {
  id: string;
  user_id: string;
  workspace_role: WorkspaceRole;
  company_id: string | null;
  company: string | null;
  name: string | null;
  email: string | null;
  status: string;
  authority_active: boolean;
  provenance: string[];
  created_at: string | null;
  operational_entity_type: 'driver' | null;
  operational_entity_id: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
  company_id: string | null;
  created_at: string | null;
};

type MembershipRow = {
  id: string;
  user_id: string | null;
  company_id: string;
  role_in_company: string | null;
  status: string | null;
  invited_email: string | null;
  created_at: string | null;
};

type WorkspaceGrantRow = {
  company_membership_id: string;
  workspace_key: string;
  granted_at: string | null;
};

type DriverRow = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  display_name: string | null;
  full_name: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  driver_type: string | null;
  created_at: string | null;
};

const PROFILE_ROLE_MAP: Record<string, WorkspaceRole | undefined> = {
  owner: 'platform_owner',
  broker: 'broker',
  customer: 'customer',
  driver: 'driver',
  owner_driver: 'owner_driver',
  company_admin: 'company_admin',
  viewer: 'viewer',
};

const MEMBERSHIP_ROLE_MAP: Record<string, WorkspaceRole | undefined> = {
  owner: 'company_owner',
  admin: 'company_admin',
  member: 'carrier_admin',
  carrier: 'carrier_admin',
  dispatcher: 'dispatcher',
  finance: 'finance',
  compliance: 'compliance',
  viewer: 'viewer',
};

const WORKSPACE_GRANT_MAP: Record<string, WorkspaceRole | undefined> = {
  broker: 'broker',
  carrier: 'carrier_admin',
  customer: 'customer',
  fleet: 'fleet_manager',
  dispatcher: 'dispatcher',
  driver: 'driver',
  owner_driver: 'owner_driver',
  finance: 'finance',
  compliance: 'compliance',
};

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');
const grantKey = (role: WorkspaceRole, userId: string, companyId: string | null) => `${role}:${userId}:${companyId ?? 'platform'}`;

async function authEmailMap(userIds: string[]) {
  const map = new Map<string, string | null>();
  if (!supabaseAdmin) return map;
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const results = await Promise.all(ids.map(async (userId) => {
    const { data, error } = await supabaseAdmin!.auth.admin.getUserById(userId);
    return [userId, error ? null : data.user?.email ?? null] as const;
  }));
  for (const [userId, email] of results) map.set(userId, email);
  return map;
}

function mergeGrant(target: Map<string, AuthorityGrant>, incoming: AuthorityGrant) {
  const existing = target.get(incoming.id);
  if (!existing) {
    target.set(incoming.id, incoming);
    return;
  }
  existing.name = existing.name ?? incoming.name;
  existing.email = existing.email ?? incoming.email;
  existing.company = existing.company ?? incoming.company;
  existing.authority_active = existing.authority_active || incoming.authority_active;
  if (existing.status !== 'active' && incoming.status === 'active') existing.status = incoming.status;
  existing.created_at = [existing.created_at, incoming.created_at].filter((value): value is string => Boolean(value)).sort()[0] ?? null;
  existing.operational_entity_type = existing.operational_entity_type ?? incoming.operational_entity_type;
  existing.operational_entity_id = existing.operational_entity_id ?? incoming.operational_entity_id;
  existing.provenance = Array.from(new Set([...existing.provenance, ...incoming.provenance]));
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const workspaceRoleParam = normalize(searchParams.get('workspaceRole'));
  if (workspaceRoleParam && !(CANONICAL_WORKSPACE_ROLES as readonly string[]).includes(workspaceRoleParam)) {
    return respond(400, { error: `Invalid workspaceRole. Allowed: ${CANONICAL_WORKSPACE_ROLES.join(', ')}` });
  }
  const workspaceRole = workspaceRoleParam ? workspaceRoleParam as WorkspaceRole : null;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));

  const [profilesResult, membershipsResult, workspaceGrantsResult, driversResult, companiesResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id, full_name, role, status, company_id, created_at').order('created_at', { ascending: false }).limit(5000),
    supabaseAdmin.from('company_memberships').select('id, user_id, company_id, role_in_company, status, invited_email, created_at').order('created_at', { ascending: false }).limit(5000),
    supabaseAdmin.from('company_membership_workspace_access').select('company_membership_id, workspace_key, granted_at').order('granted_at', { ascending: false }).limit(5000),
    supabaseAdmin.from('drivers').select('id, user_id, company_id, display_name, full_name, name, email, status, driver_type, created_at').order('created_at', { ascending: false }).limit(5000),
    supabaseAdmin.from('companies').select('id, name, status').limit(5000),
  ]);

  for (const [source, result] of [
    ['profiles', profilesResult],
    ['company_memberships', membershipsResult],
    ['company_membership_workspace_access', workspaceGrantsResult],
    ['drivers', driversResult],
    ['companies', companiesResult],
  ] as const) {
    if (result.error) return respond(500, { error: `Canonical authority directory failed for ${source}: ${result.error.message}` });
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const workspaceGrants = (workspaceGrantsResult.data ?? []) as WorkspaceGrantRow[];
  const drivers = (driversResult.data ?? []) as DriverRow[];
  const companyNameById = new Map((companiesResult.data ?? []).map((company) => [String(company.id), String(company.name ?? 'Company')]));
  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
  const grants = new Map<string, AuthorityGrant>();

  for (const profile of profiles) {
    const mappedRole = PROFILE_ROLE_MAP[normalize(profile.role)];
    if (!mappedRole) continue;
    const companyId = mappedRole === 'platform_owner' ? null : profile.company_id;
    const id = grantKey(mappedRole, profile.user_id, companyId);
    mergeGrant(grants, {
      id,
      user_id: profile.user_id,
      workspace_role: mappedRole,
      company_id: companyId,
      company: companyId ? companyNameById.get(companyId) ?? null : null,
      name: profile.full_name,
      email: null,
      status: profile.status ?? 'unknown',
      authority_active: normalize(profile.status) === 'active',
      provenance: [`profiles.role=${profile.role ?? 'null'}`],
      created_at: profile.created_at,
      operational_entity_type: null,
      operational_entity_id: null,
    });
  }

  for (const membership of memberships) {
    if (!membership.user_id) continue;
    const mappedRole = MEMBERSHIP_ROLE_MAP[normalize(membership.role_in_company)];
    if (!mappedRole) continue;
    const profile = profileByUserId.get(membership.user_id);
    const id = grantKey(mappedRole, membership.user_id, membership.company_id);
    mergeGrant(grants, {
      id,
      user_id: membership.user_id,
      workspace_role: mappedRole,
      company_id: membership.company_id,
      company: companyNameById.get(membership.company_id) ?? null,
      name: profile?.full_name ?? null,
      email: membership.invited_email,
      status: membership.status ?? 'unknown',
      authority_active: normalize(membership.status) === 'active',
      provenance: [`company_memberships.role_in_company=${membership.role_in_company ?? 'null'}`],
      created_at: membership.created_at,
      operational_entity_type: null,
      operational_entity_id: null,
    });
  }

  const ignoredPlatformWorkspaceGrants: string[] = [];
  for (const workspaceGrant of workspaceGrants) {
    const membership = membershipById.get(workspaceGrant.company_membership_id);
    if (!membership?.user_id) continue;
    const normalizedWorkspace = normalize(workspaceGrant.workspace_key);
    if (normalizedWorkspace === 'platform') {
      ignoredPlatformWorkspaceGrants.push(workspaceGrant.company_membership_id);
      continue;
    }
    const mappedRole = WORKSPACE_GRANT_MAP[normalizedWorkspace];
    if (!mappedRole) continue;
    const profile = profileByUserId.get(membership.user_id);
    const id = grantKey(mappedRole, membership.user_id, membership.company_id);
    mergeGrant(grants, {
      id,
      user_id: membership.user_id,
      workspace_role: mappedRole,
      company_id: membership.company_id,
      company: companyNameById.get(membership.company_id) ?? null,
      name: profile?.full_name ?? null,
      email: membership.invited_email,
      status: membership.status ?? 'unknown',
      authority_active: normalize(membership.status) === 'active',
      provenance: [`company_membership_workspace_access.workspace_key=${workspaceGrant.workspace_key}`],
      created_at: workspaceGrant.granted_at ?? membership.created_at,
      operational_entity_type: null,
      operational_entity_id: null,
    });
  }

  for (const driver of drivers) {
    if (!driver.user_id) continue;
    const mappedRole: WorkspaceRole = normalize(driver.driver_type) === 'owner_driver' ? 'owner_driver' : 'driver';
    const profile = profileByUserId.get(driver.user_id);
    const id = grantKey(mappedRole, driver.user_id, driver.company_id);
    mergeGrant(grants, {
      id,
      user_id: driver.user_id,
      workspace_role: mappedRole,
      company_id: driver.company_id,
      company: driver.company_id ? companyNameById.get(driver.company_id) ?? null : null,
      name: driver.display_name ?? driver.full_name ?? driver.name ?? profile?.full_name ?? null,
      email: driver.email,
      status: driver.status ?? profile?.status ?? 'unknown',
      authority_active: normalize(driver.status) === 'active',
      provenance: [`drivers.driver_type=${driver.driver_type ?? 'company_driver'}`],
      created_at: driver.created_at,
      operational_entity_type: 'driver',
      operational_entity_id: driver.id,
    });
  }

  let rows = Array.from(grants.values());
  const emails = await authEmailMap(rows.map((row) => row.user_id));
  rows = rows.map((row) => ({ ...row, email: row.email ?? emails.get(row.user_id) ?? null }));

  const roleCounts = Object.fromEntries(CANONICAL_WORKSPACE_ROLES.map((role) => [role, rows.filter((row) => row.workspace_role === role).length]));
  const activeRoleCounts = Object.fromEntries(CANONICAL_WORKSPACE_ROLES.map((role) => [role, rows.filter((row) => row.workspace_role === role && row.authority_active).length]));

  if (workspaceRole) rows = rows.filter((row) => row.workspace_role === workspaceRole);
  rows.sort((a, b) => {
    if (a.authority_active !== b.authority_active) return a.authority_active ? -1 : 1;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });

  const total = rows.length;
  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);

  return respond(200, {
    rows: pageRows,
    summary: {
      totalAuthorityGrants: Object.values(roleCounts).reduce((sum, count) => sum + count, 0),
      activeAuthorityGrants: Object.values(activeRoleCounts).reduce((sum, count) => sum + count, 0),
      canonicalRoles: CANONICAL_WORKSPACE_ROLES.length,
    },
    roleCounts,
    activeRoleCounts,
    roles: CANONICAL_WORKSPACE_ROLES,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    diagnosticNote: ignoredPlatformWorkspaceGrants.length > 0
      ? `${ignoredPlatformWorkspaceGrants.length} company workspace grant(s) named 'platform' were intentionally ignored; Platform Owner authority is sourced only from profiles.role=owner.`
      : null,
  });
}
