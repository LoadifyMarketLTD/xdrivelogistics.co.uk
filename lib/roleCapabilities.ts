import type { AppUserRole } from './authRole';
import type { DriverWorkspaceMode } from './driverWorkspaceMode';

export type RoleCapabilities = {
  canPostLoads: boolean;
  canViewExchangeLoads: boolean;
  canQuoteLoads: boolean;
  canReceiveQuotes: boolean;
  canAwardJobs: boolean;
  canExecuteJobs: boolean;
  canAllocateDrivers: boolean;
  canManageFleet: boolean;
  canManageCompanyUsers: boolean;
  canManageOwnVehicle: boolean;
  canUploadPod: boolean;
  canViewInvoices: boolean;
  canRepostToExchange: boolean;
  canUseReturnJourneys: boolean;
};

const NO_CAPABILITIES: RoleCapabilities = {
  canPostLoads: false,
  canViewExchangeLoads: false,
  canQuoteLoads: false,
  canReceiveQuotes: false,
  canAwardJobs: false,
  canExecuteJobs: false,
  canAllocateDrivers: false,
  canManageFleet: false,
  canManageCompanyUsers: false,
  canManageOwnVehicle: false,
  canUploadPod: false,
  canViewInvoices: false,
  canRepostToExchange: false,
  canUseReturnJourneys: false,
};

export const getCapabilitiesForRole = (
  role: AppUserRole | null,
  context: {
    membershipRole?: string | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
  } = {}
): RoleCapabilities => {
  if (!role) return NO_CAPABILITIES;

  if (role === 'owner') {
    return {
      canPostLoads: true,
      canViewExchangeLoads: true,
      canQuoteLoads: true,
      canReceiveQuotes: true,
      canAwardJobs: true,
      canExecuteJobs: true,
      canAllocateDrivers: true,
      canManageFleet: true,
      canManageCompanyUsers: true,
      canManageOwnVehicle: true,
      canUploadPod: true,
      canViewInvoices: true,
      canRepostToExchange: true,
      canUseReturnJourneys: true,
    };
  }

  if (role === 'customer') {
    return {
      ...NO_CAPABILITIES,
      canPostLoads: true,
      canReceiveQuotes: true,
      canAwardJobs: true,
      canViewInvoices: true,
    };
  }

  if (role === 'broker') {
    return {
      ...NO_CAPABILITIES,
      canPostLoads: true,
      canViewExchangeLoads: true,
      canReceiveQuotes: true,
      canAwardJobs: true,
      canRepostToExchange: true,
      canViewInvoices: true,
    };
  }

  if (role === 'company_admin') {
    return {
      canPostLoads: true,
      canViewExchangeLoads: true,
      canQuoteLoads: true,
      canReceiveQuotes: true,
      canAwardJobs: true,
      canExecuteJobs: true,
      canAllocateDrivers: true,
      canManageFleet: true,
      canManageCompanyUsers: true,
      canManageOwnVehicle: true,
      canUploadPod: true,
      canViewInvoices: true,
      canRepostToExchange: true,
      canUseReturnJourneys: true,
    };
  }

  if (role === 'company_staff') {
    const canViewFinance =
      context.financeAccess === 'full' ||
      context.financeAccess === 'limited' ||
      context.membershipRole === 'dispatcher';

    return {
      ...NO_CAPABILITIES,
      canPostLoads: true,
      canViewExchangeLoads: true,
      canQuoteLoads: true,
      canReceiveQuotes: true,
      canAwardJobs: true,
      canExecuteJobs: true,
      canAllocateDrivers: true,
      canManageFleet: true,
      canManageOwnVehicle: true,
      canUploadPod: true,
      canViewInvoices: canViewFinance,
      canRepostToExchange: true,
      canUseReturnJourneys: true,
    };
  }

  if (role === 'driver') {
    return {
      ...NO_CAPABILITIES,
      canViewExchangeLoads: true,
      canQuoteLoads: true,
      canExecuteJobs: true,
      canManageOwnVehicle: true,
      canUploadPod: true,
      canUseReturnJourneys: true,
    };
  }

  return NO_CAPABILITIES;
};

export const getDriverWorkspaceCapabilities = (
  mode: DriverWorkspaceMode,
  context: {
    role?: AppUserRole | string | null;
    membershipRole?: string | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
  } = {}
): RoleCapabilities => {
  if (mode === 'provider_driver') {
    return {
      ...getCapabilitiesForRole('driver'),
      canViewInvoices: true,
      canUseReturnJourneys: true,
    };
  }

  if (mode === 'admin_business') {
    return getCapabilitiesForRole('company_admin', context);
  }

  return getCapabilitiesForRole('driver', context);
};
export type RouteAccessContext = {
  canAccessDriverMode?: boolean;
  membershipRole?: string | null;
  financeAccess?: 'full' | 'limited' | 'hidden' | null;
};

const ADMIN_ROUTE_CAPABILITIES: Array<{ prefix: string; capability: keyof RoleCapabilities }> = [
  { prefix: '/admin/marketplace', capability: 'canViewExchangeLoads' },
  { prefix: '/admin/quotes', capability: 'canReceiveQuotes' },
  { prefix: '/admin/bids', capability: 'canReceiveQuotes' },
  { prefix: '/admin/diary', capability: 'canAllocateDrivers' },
  { prefix: '/admin/jobs', capability: 'canExecuteJobs' },
  { prefix: '/admin/disputes', capability: 'canExecuteJobs' },
  { prefix: '/admin/fleet', capability: 'canManageFleet' },
  { prefix: '/admin/drivers', capability: 'canManageFleet' },
  { prefix: '/admin/vehicles', capability: 'canManageFleet' },
  { prefix: '/admin/documents', capability: 'canManageFleet' },
  { prefix: '/admin/invoices', capability: 'canViewInvoices' },
  { prefix: '/admin/dispatchers', capability: 'canManageCompanyUsers' },
  { prefix: '/admin/settings', capability: 'canManageCompanyUsers' },
];

const DRIVER_ROUTE_CAPABILITIES: Array<{ prefix: string; capability: keyof RoleCapabilities }> = [
  { prefix: '/driver/loads', capability: 'canViewExchangeLoads' },
  { prefix: '/driver/quotes', capability: 'canQuoteLoads' },
  { prefix: '/driver/won-work', capability: 'canExecuteJobs' },
  { prefix: '/driver/jobs', capability: 'canExecuteJobs' },
  { prefix: '/driver/finance', capability: 'canViewInvoices' },
  { prefix: '/driver/vehicles', capability: 'canManageOwnVehicle' },
  { prefix: '/driver/returns', capability: 'canUseReturnJourneys' },
  { prefix: '/driver/documents', capability: 'canUploadPod' },
];

const pathMatches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

const requiredCapabilityForPath = (pathname: string): keyof RoleCapabilities | null => {
  const adminMatch = ADMIN_ROUTE_CAPABILITIES.find((entry) => pathMatches(pathname, entry.prefix));
  if (adminMatch) return adminMatch.capability;

  const driverMatch = DRIVER_ROUTE_CAPABILITIES.find((entry) => pathMatches(pathname, entry.prefix));
  if (driverMatch) return driverMatch.capability;

  return null;
};

export const isCapabilityAllowedForPath = (
  pathname: string,
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): boolean => {
  if (!role) return false;

  if (pathname.startsWith('/super-admin')) return role === 'owner';
  if (pathname.startsWith('/broker')) return role === 'broker' || role === 'owner';
  if (pathname.startsWith('/customer')) return role === 'customer';

  if (pathname.startsWith('/driver')) {
    const driverRoleAllowed = role === 'driver' || context.canAccessDriverMode === true;
    if (!driverRoleAllowed) return false;

    const mode = context.canAccessDriverMode === true
      ? (role === 'driver' ? 'provider_driver' : 'admin_business')
      : 'fleet_driver';
    const capabilities = getDriverWorkspaceCapabilities(mode, context);
    const requiredCapability = requiredCapabilityForPath(pathname);
    return !requiredCapability || capabilities[requiredCapability];
  }

  if (pathname.startsWith('/admin')) {
    if (role !== 'owner' && role !== 'broker' && role !== 'company_admin' && role !== 'company_staff') return false;
    const capabilities = getCapabilitiesForRole(role, context);
    const requiredCapability = requiredCapabilityForPath(pathname);
    return !requiredCapability || capabilities[requiredCapability];
  }

  if (pathname.startsWith('/m')) {
    return role === 'owner' || role === 'broker' || role === 'company_admin' || role === 'company_staff';
  }

  return true;
};