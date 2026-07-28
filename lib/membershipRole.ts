/**
 * Membership role contracts for company workspaces.
 *
 * DB enum (persisted): owner | admin | dispatcher | member | viewer
 * App/domain roles include planned identities not yet persisted: finance | compliance | driver
 */

import type { WorkspaceCapability } from './workspaceRole';

/** Full application-domain role identity. */
export type MembershipRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'driver'
  | 'member'
  | 'viewer';

/** DB-persisted subset currently present in public.company_role. */
export type PersistedCompanyRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'member'
  | 'viewer';

export const PERSISTED_COMPANY_ROLES: readonly PersistedCompanyRole[] = [
  'owner',
  'admin',
  'dispatcher',
  'member',
  'viewer',
];

/**
 * All application-domain role values.
 * These are capability profiles, not a privilege ladder — do not infer rank from order.
 */
export const MEMBERSHIP_ROLE_VALUES: readonly MembershipRole[] = [
  'owner',
  'admin',
  'dispatcher',
  'finance',
  'compliance',
  'driver',
  'member',
  'viewer',
];

export const MEMBERSHIP_ROLE_CAPABILITIES: Record<MembershipRole, readonly WorkspaceCapability[]> = {
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
  finance: ['jobs.view', 'invoices.carrier.manage', 'payments.manage', 'margins.view'],
  compliance: ['jobs.view', 'drivers.manage', 'vehicles.manage', 'documents.company.manage', 'incidents.manage'],
  driver: ['jobs.view', 'jobs.execute', 'jobs.track', 'documents.own.manage'],
  member: ['jobs.view'],
  viewer: ['jobs.view'],
};

export function membershipHasCapability(role: MembershipRole, capability: WorkspaceCapability): boolean {
  return MEMBERSHIP_ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/**
 * Resolves raw input to application-domain role identity.
 * Returns null for null/empty/unknown values.
 */
export function resolveMembershipRole(raw: string | null | undefined): MembershipRole | null {
  const normalised = (raw ?? '').trim().toLowerCase();
  if ((MEMBERSHIP_ROLE_VALUES as readonly string[]).includes(normalised)) {
    return normalised as MembershipRole;
  }
  return null;
}

/**
 * Resolves raw input to DB-persisted subset.
 * Planned roles intentionally remain outside this subset until schema migration.
 */
export function resolvePersistedCompanyRole(
  raw: string | null | undefined,
): PersistedCompanyRole | null {
  const normalised = (raw ?? '').trim().toLowerCase();
  if ((PERSISTED_COMPANY_ROLES as readonly string[]).includes(normalised)) {
    return normalised as PersistedCompanyRole;
  }
  return null;
}
