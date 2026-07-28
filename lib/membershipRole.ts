/**
 * Membership role contract for company workspaces.
 *
 * Maps directly to the DB public.company_role ENUM, which currently contains:
 *   owner | admin | dispatcher | member | viewer
 *   (supabase/migrations/006_complete_schema.sql,
 *    supabase/migrations/064_extend_company_role_membership_values.sql)
 *
 * NOTE: 'finance', 'compliance' and 'driver' are NOT present in the DB enum.
 * They are documented as planned future extensions and must not be persisted
 * until a migration adds them to public.company_role.
 *
 * Do not confuse MembershipRole with WorkspaceRole (the UI resolver in
 * lib/workspaceRole.ts) or BusinessWorkspace (the top-level workspace type in
 * lib/businessWorkspace.ts). They serve different concerns:
 *   - MembershipRole: what a user can do within a specific company (DB-backed).
 *   - WorkspaceRole: coarse-grained UI role used by the nav/shell resolver.
 *   - BusinessWorkspace: which product surface the company belongs to.
 */

/** Roles currently in the DB company_role ENUM (authoritative list). */
export type MembershipRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'member'
  | 'viewer';

/**
 * Ordered from highest to lowest privilege.
 * Used when comparing or displaying roles.
 */
export const MEMBERSHIP_ROLE_PRECEDENCE: readonly MembershipRole[] = [
  'owner',
  'admin',
  'dispatcher',
  'member',
  'viewer',
];

/** Capabilities available to each membership role within a carrier/fleet company. */
export const MEMBERSHIP_ROLE_CAPABILITIES: Record<MembershipRole, readonly string[]> = {
  owner: [
    'company.manage',
    'company.members.manage',
    'jobs.view',
    'jobs.allocate',
    'jobs.dispatch',
    'drivers.manage',
    'vehicles.manage',
    'documents.company.manage',
    'invoices.carrier.manage',
    'payments.manage',
    'margins.view',
    'incidents.manage',
    'settings.manage',
  ],
  admin: [
    'company.members.manage',
    'jobs.view',
    'jobs.allocate',
    'jobs.dispatch',
    'drivers.manage',
    'vehicles.manage',
    'documents.company.manage',
    'invoices.carrier.manage',
    'incidents.manage',
    'settings.manage',
  ],
  dispatcher: [
    'jobs.view',
    'jobs.allocate',
    'jobs.dispatch',
    'drivers.manage',
    'vehicles.manage',
  ],
  member: ['jobs.view'],
  viewer: ['jobs.view'],
};

/**
 * Returns true if the membership role grants the given capability string.
 */
export function membershipHasCapability(role: MembershipRole, capability: string): boolean {
  return MEMBERSHIP_ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/**
 * Normalises a raw string to a MembershipRole.
 * Returns 'viewer' for null, empty or unrecognised values so callers always
 * get a safe default rather than an exception.
 */
export function resolveMembershipRole(raw: string | null | undefined): MembershipRole {
  const normalised = (raw ?? '').trim().toLowerCase();
  if ((MEMBERSHIP_ROLE_PRECEDENCE as readonly string[]).includes(normalised)) {
    return normalised as MembershipRole;
  }
  return 'viewer';
}

/**
 * Returns true when `a` has equal or higher privilege than `b`.
 */
export function isMembershipRoleAtLeast(a: MembershipRole, b: MembershipRole): boolean {
  return MEMBERSHIP_ROLE_PRECEDENCE.indexOf(a) <= MEMBERSHIP_ROLE_PRECEDENCE.indexOf(b);
}
