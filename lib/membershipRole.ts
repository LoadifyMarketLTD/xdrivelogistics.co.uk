/**
 * Membership role contract for company workspaces.
 *
 * There are TWO distinct role concepts in this module:
 *
 * 1. `PersistedCompanyRole` — roles currently in the DB public.company_role ENUM:
 *      owner | admin | dispatcher | member | viewer
 *    (supabase/migrations/006_complete_schema.sql,
 *     supabase/migrations/064_extend_company_role_membership_values.sql)
 *
 * 2. `MembershipRole` — the full application-domain role type, which includes
 *    planned future roles not yet in the DB enum:
 *      owner | admin | dispatcher | finance | compliance | driver | member | viewer
 *
 * Schema gap: 'finance', 'compliance' and 'driver' are NOT present in the DB
 * enum yet. They are valid domain roles that represent real access boundaries
 * and must NOT be silently downgraded to 'viewer' — that would destroy role
 * identity and produce incorrect navigation and audit behaviour.  A migration
 * must add them to public.company_role before rows can carry these values.
 *
 * Do not confuse MembershipRole with WorkspaceRole (the UI resolver in
 * lib/workspaceRole.ts) or BusinessWorkspace (the top-level workspace type in
 * lib/businessWorkspace.ts). They serve different concerns:
 *   - MembershipRole: what a user can do within a specific company (application domain).
 *   - PersistedCompanyRole: subset of MembershipRole currently in the DB enum.
 *   - WorkspaceRole: coarse-grained UI role used by the nav/shell resolver.
 *   - BusinessWorkspace: which product surface the company belongs to.
 */

/**
 * Roles currently persisted in the DB public.company_role ENUM.
 * Use this type when reading from or writing to the database.
 */
export type PersistedCompanyRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'member'
  | 'viewer';

/**
 * Full application-domain membership role type.
 * Includes planned roles not yet in the DB enum — see schema gap note above.
 * Use this type for all in-application permission, navigation and audit logic.
 */
export type MembershipRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'finance'       // schema gap: planned, not yet in DB
  | 'compliance'    // schema gap: planned, not yet in DB
  | 'driver'        // schema gap: planned, not yet in DB
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
  'finance',
  'compliance',
  'driver',
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
  finance: [
    'jobs.view',
    'invoices.carrier.manage',
    'payments.manage',
    'documents.company.manage',
    'margins.view',
  ],
  compliance: [
    'jobs.view',
    'drivers.manage',
    'vehicles.manage',
    'documents.company.manage',
  ],
  driver: [
    'jobs.view',
    'jobs.execute',
    'jobs.track',
    'documents.own.manage',
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
 * Normalises a raw DB string to a MembershipRole.
 *
 * Mapping rules:
 *  - All eight application-domain roles are accepted and returned as-is.
 *  - `finance`, `compliance` and `driver` are valid domain roles even though they
 *    are not yet in the DB enum; they are preserved, not downgraded to `viewer`.
 *  - null, undefined, empty and truly unrecognised strings → `viewer` (minimum
 *    privilege — the caller always receives a valid MembershipRole).
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
