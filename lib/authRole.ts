export type AppUserRole =
  | 'owner'
  | 'broker'
  | 'company_admin'
  | 'company_staff'
  | 'driver'
  | 'customer';

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
  if (normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'platform_owner') return 'owner';

  // Company admin aliases
  if (
    normalized === 'admin' ||
    normalized === 'admin_staff' ||
    normalized === 'org_admin' ||
    normalized === 'platform_admin'
  ) return 'company_admin';

  // Company staff aliases
  if (
    normalized === 'company' ||
    normalized === 'dispatcher' ||
    normalized === 'carrier' ||
    normalized === 'admin_operator'
  ) return 'company_staff';

  // Broker aliases
  if (normalized === 'freight_broker' || normalized === 'shipper_broker') return 'broker';

  // Driver aliases
  if (normalized === 'owner_driver') return 'driver';

  // Customer aliases
  if (normalized === 'shipper' || normalized === 'client' || normalized === 'viewer') return 'customer';

  return null;
};

/**
 * Persist profile roles using the legacy-compatible database values so auth
 * writes keep working even when production has not yet applied migration 063.
 */
export const normalizeProfileRoleForStorage = (value: string | null | undefined): string | null => {
  const resolvedRole = mapAppRole(value);

  if (resolvedRole === 'owner') return 'owner';
  if (resolvedRole === 'broker') return 'company';
  if (resolvedRole === 'company_admin') return 'admin';
  if (resolvedRole === 'company_staff') return 'company';
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
  role === 'broker' || role === 'company_admin' || role === 'company_staff' || role === 'driver';

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
  if (membershipRole === 'dispatcher' || membershipRole === 'member') return 'company_staff';
  if (membershipRole === 'viewer') return 'customer';
  if (hasCreatedCompany) return creatorCompanyType === 'admin' ? 'company_admin' : 'company_staff';

  return null;
};

const ADMIN_ROUTE_ROLES = new Set<AppUserRole>(['broker', 'company_admin', 'company_staff', 'owner']);
const MOBILE_ROUTE_ROLES = new Set<AppUserRole>(['broker', 'company_admin', 'company_staff', 'owner']);
const DRIVER_ROUTE_ROLES = new Set<AppUserRole>(['driver']);
const CUSTOMER_ROUTE_ROLES = new Set<AppUserRole>(['customer']);

export const isRoleAllowedForPath = (
  pathname: string,
  role: AppUserRole | null,
  options?: { canAccessDriverMode?: boolean }
): boolean => {
  if (!role) return false;
  if (pathname.startsWith('/admin')) return ADMIN_ROUTE_ROLES.has(role);
  if (pathname.startsWith('/driver')) {
    return DRIVER_ROUTE_ROLES.has(role) || options?.canAccessDriverMode === true;
  }
  if (pathname.startsWith('/m')) return MOBILE_ROUTE_ROLES.has(role);
  if (pathname.startsWith('/customer')) return CUSTOMER_ROUTE_ROLES.has(role);
  return true;
};

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
