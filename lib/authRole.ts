import { isCapabilityAllowedForPath, type RouteAccessContext } from './roleCapabilities';
export type AppUserRole =
  | 'owner'
  | 'broker'
  | 'company_admin'
  | 'company_staff'
  | 'driver'
  | 'customer';

/**
 * Driver persona classification — stored in driver profile metadata.
 * Used for workspace defaults and load-board filters, NOT for cross-portal
 * access control (all personas map to the single `driver` AppUserRole).
 */
export type DriverPersona =
  | 'solo_driver'
  | 'owner_operator'
  | 'self_employed'
  | 'company_driver';

export const DRIVER_PERSONA_LABELS: Record<DriverPersona, string> = {
  solo_driver: 'Solo Driver',
  owner_operator: 'Owner Operator',
  self_employed: 'Self Employed Driver',
  company_driver: 'Company Driver',
};

export const mapDriverPersona = (value: string | null | undefined): DriverPersona | null => {
  const v = (value ?? '').toLowerCase().trim();
  if (v === 'solo_driver' || v === 'solo') return 'solo_driver';
  if (v === 'owner_operator' || v === 'owner_driver') return 'owner_operator';
  if (v === 'self_employed' || v === 'self_employed_driver') return 'self_employed';
  if (v === 'company_driver' || v === 'company') return 'company_driver';
  return null;
};

/**
 * Maps any profile.role value (canonical or legacy alias) to an AppUserRole.
 *
 * Canonical values:
 *   owner | broker | company_admin | company_staff | driver | customer
 *
 * Returns null only when the value is empty/null or genuinely unrecognised
 * (triggers 'role_unsupported' error in authSession.ts).
 */
export const mapAppRole = (value: string | null | undefined): AppUserRole | null => {
  const normalized = (value ?? '').toLowerCase().trim();

  // Canonical values
  if (normalized === 'owner') return 'owner';
  if (normalized === 'broker') return 'broker';
  if (normalized === 'company_admin') return 'company_admin';
  if (normalized === 'company_staff') return 'company_staff';
  if (normalized === 'driver') return 'driver';
  if (normalized === 'customer') return 'customer';

  // Owner aliases
  if (
    normalized === 'superadmin' ||
    normalized === 'super_admin' ||
    normalized === 'platform_owner' ||
    normalized === 'platform_admin' ||
    normalized === 'platform_administrator'
  ) return 'owner';

  // Company admin aliases
  if (
    normalized === 'admin' ||
    normalized === 'admin_staff' ||
    normalized === 'org_admin' ||
    normalized === 'fleet_operator'
  ) return 'company_admin';

  // Company staff aliases
  if (
    normalized === 'company' ||
    normalized === 'dispatcher' ||
    normalized === 'carrier' ||
    normalized === 'admin_operator'
  ) return 'company_staff';

  // Broker aliases
  if (
    normalized === 'freight_broker' ||
    normalized === 'shipper_broker' ||
    normalized === 'transport_broker'
  ) return 'broker';

  // Driver aliases
  if (
    normalized === 'owner_driver' ||
    normalized === 'owner-driver' ||
    normalized === 'owner_operator' ||
    normalized === 'owner-operator' ||
    normalized === 'self_employed' ||
    normalized === 'self-employed' ||
    normalized === 'self_employed_driver'
  ) return 'driver';

  // Customer aliases
  if (
    normalized === 'shipper' ||
    normalized === 'customer_shipper' ||
    normalized === 'client' ||
    normalized === 'viewer'
  ) return 'customer';

  return null;
};

/**
 * Persist profile roles using the canonical database values defined by the
 * profiles_role_canonical constraint (migration 098):
 *   owner | broker | company_admin | company_staff | driver | customer
 *
 * Legacy aliases ('admin', 'company') are no longer accepted by the DB
 * constraint and must NOT be written. Canonical values only.
 */
export const normalizeProfileRoleForStorage = (value: string | null | undefined): string | null => {
  const resolvedRole = mapAppRole(value);

  if (resolvedRole === 'owner') return 'owner';
  if (resolvedRole === 'broker') return 'broker';
  if (resolvedRole === 'company_admin') return 'company_admin';
  if (resolvedRole === 'company_staff') return 'company_staff';
  if (resolvedRole === 'driver') return 'driver';
  if (resolvedRole === 'customer') return 'customer';

  return null;
};

export const shouldAutoProvisionCompany = ({
  fallbackRole,
  profileRole,
}: {
  fallbackRole?: string | null;
  profileRole?: string | null;
}) => {
  const candidateRoles = [mapAppRole(fallbackRole), mapAppRole(profileRole)];
  return candidateRoles.some(
    (role) => role === 'broker' || role === 'company_admin' || role === 'company_staff' || role === 'owner'
  );
};

export const roleRequiresCompanyContext = (role: AppUserRole | null) =>
  role === 'broker' || role === 'company_admin' || role === 'company_staff';

export const resolveAuthoritativeRole = ({
  membershipRole,
  profileRole,
  isDriver,
  hasCreatedCompany,
  creatorCompanyType,
  fallbackRole,
  ownerDriverWorkspaceRequested,
}: {
  membershipRole?: string | null;
  profileRole?: string | null;
  isDriver: boolean;
  hasCreatedCompany: boolean;
  creatorCompanyType?: string | null;
  fallbackRole?: string | null;
  ownerDriverWorkspaceRequested?: boolean;
}): AppUserRole | null => {
  const normalizedProfileRole = (profileRole ?? '').toLowerCase().trim();
  const resolvedProfileRole = mapAppRole(profileRole);
  const resolvedFallbackRole = mapAppRole(fallbackRole);
  const ownerDriverWorkspace =
    ownerDriverWorkspaceRequested &&
    (resolvedProfileRole === 'driver' || resolvedFallbackRole === 'driver' || isDriver);

  if (ownerDriverWorkspace && (membershipRole === 'owner' || membershipRole === 'admin')) {
    return 'company_admin';
  }

  if (ownerDriverWorkspace && hasCreatedCompany) {
    return creatorCompanyType === 'admin' ? 'company_admin' : 'company_staff';
  }

  if (
    resolvedFallbackRole &&
    (normalizedProfileRole === 'admin' || normalizedProfileRole === 'company') &&
    resolvedFallbackRole !== resolvedProfileRole
  ) {
    return resolvedFallbackRole;
  }

  if (resolvedProfileRole) return resolvedProfileRole;
  if (resolvedFallbackRole) return resolvedFallbackRole;

  if (isDriver) return 'driver';

  if (membershipRole === 'owner' || membershipRole === 'admin') return 'company_admin';
  if (
    membershipRole === 'finance' ||
    membershipRole === 'compliance' ||
    normalizedProfileRole === 'finance' ||
    normalizedProfileRole === 'compliance' ||
    (fallbackRole ?? '').toLowerCase().trim() === 'finance' ||
    (fallbackRole ?? '').toLowerCase().trim() === 'compliance'
  ) return 'company_staff';
  if (membershipRole === 'dispatcher' || membershipRole === 'member') return 'company_staff';
  if (membershipRole === 'viewer') return 'customer';
  if (hasCreatedCompany) return creatorCompanyType === 'admin' ? 'company_admin' : 'company_staff';

  return null;
};

export const isRoleAllowedForPath = (
  pathname: string,
  role: AppUserRole | null,
  options: RouteAccessContext = {}
): boolean => isCapabilityAllowedForPath(pathname, role, options);

export const isRoleAllowedForRequiredRole = (
  requiredRole: AppUserRole,
  role: AppUserRole | null
): boolean => {
  if (!role) return false;
  if (requiredRole === 'company_admin') {
    return role === 'broker' || role === 'company_admin' || role === 'company_staff' || role === 'owner';
  }
  if (requiredRole === 'company_staff') {
    return role === 'broker' || role === 'company_admin' || role === 'company_staff' || role === 'owner';
  }
  if (requiredRole === 'owner') {
    return role === 'owner';
  }
  return role === requiredRole;
};
