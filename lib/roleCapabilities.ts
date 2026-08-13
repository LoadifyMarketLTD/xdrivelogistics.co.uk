import type { AppUserRole } from './authRole';
import type { BusinessWorkspace } from './businessWorkspace';
import type { DriverWorkspaceMode } from './driverWorkspaceMode';
import {
  DRIVER_WORKSPACE_CAPABILITIES,
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  type WorkspaceCapability,
  type WorkspaceRole,
  type WorkspaceUserLike,
} from './workspaceRole';

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

export type RouteAccessContext = {
  canAccessDriverMode?: boolean;
  membershipId?: string | null;
  membershipRole?: string | null;
  financeAccess?: 'full' | 'limited' | 'hidden' | null;
  ownerDriverWorkspace?: boolean | null;
  ownerDriverExecutionMode?: boolean | null;
  rawRole?: string | null;
  workspaceRole?: WorkspaceRole | null;
  driverId?: string | null;
  canCommercialBid?: boolean | null;
  driverStatus?: string | null;
  appAccess?: boolean | null;
  accountStatus?: string | null;
  companyStatus?: string | null;
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

const resolveRole = (
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): WorkspaceRole | null => {
  if (context.workspaceRole) return context.workspaceRole;
  if (!role) return null;

  const user: WorkspaceUserLike = {
    role,
    rawRole: context.rawRole ?? null,
    membershipRole: context.membershipRole ?? null,
    ownerDriverWorkspace: context.ownerDriverWorkspace === true,
    financeAccess: context.financeAccess ?? null,
  };

  return resolveWorkspaceRole(user);
};

const hasAny = (role: WorkspaceRole, capabilities: WorkspaceCapability[]) =>
  capabilities.some((capability) => hasWorkspaceCapability(role, capability));

const hasDriverCapability = (capability: WorkspaceCapability) =>
  DRIVER_WORKSPACE_CAPABILITIES.includes(capability);

export const getCapabilitiesForRole = (
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): RoleCapabilities => {
  const workspaceRole = resolveRole(role, context);
  if (!workspaceRole) return NO_CAPABILITIES;

  return {
    canPostLoads: hasAny(workspaceRole, ['loads.create', 'loads.publish']),
    canViewExchangeLoads: hasWorkspaceCapability(workspaceRole, 'loads.view.marketplace'),
    canQuoteLoads: hasWorkspaceCapability(workspaceRole, 'quotes.submit'),
    canReceiveQuotes: hasWorkspaceCapability(workspaceRole, 'quotes.receive'),
    canAwardJobs: hasWorkspaceCapability(workspaceRole, 'quotes.award'),
    canExecuteJobs: hasWorkspaceCapability(workspaceRole, 'jobs.execute'),
    canAllocateDrivers: hasWorkspaceCapability(workspaceRole, 'jobs.allocate'),
    canManageFleet: hasAny(workspaceRole, [
      'drivers.manage',
      'vehicles.manage',
      'fleet.positions.view',
      'fleet.maintenance.manage',
    ]),
    canManageCompanyUsers: hasWorkspaceCapability(workspaceRole, 'company.members.manage'),
    canManageOwnVehicle:
      workspaceRole === 'owner_driver' || hasWorkspaceCapability(workspaceRole, 'vehicles.manage'),
    canUploadPod: hasAny(workspaceRole, ['jobs.execute', 'jobs.review_pod']),
    canViewInvoices: hasAny(workspaceRole, [
      'invoices.customer.manage',
      'invoices.carrier.manage',
    ]),
    canRepostToExchange: hasWorkspaceCapability(workspaceRole, 'loads.publish'),
    canUseReturnJourneys:
      hasWorkspaceCapability(workspaceRole, 'jobs.track') &&
      hasWorkspaceCapability(workspaceRole, 'loads.view.marketplace'),
  };
};

export const getDriverWorkspaceCapabilities = (
  mode: DriverWorkspaceMode,
  context: RouteAccessContext & { role?: AppUserRole | string | null } = {}
): RoleCapabilities => {
  if (mode === 'provider_driver') {
    return getCapabilitiesForRole('driver', {
      ...context,
      workspaceRole: 'owner_driver',
      ownerDriverWorkspace: true,
    });
  }

  if (mode === 'admin_business') {
    return getCapabilitiesForRole('company_admin', {
      ...context,
      workspaceRole: context.workspaceRole ?? 'company_admin',
    });
  }

  return getCapabilitiesForRole('driver', {
    ...context,
    workspaceRole: 'driver',
    ownerDriverWorkspace: false,
  });
};

const pathMatches = (pathname: string, prefix: string, exact = false) =>
  exact ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`);

const cleanPath = (pathname: string) => pathname.split('?')[0]?.split('#')[0] || '/';

const isActiveStatus = (value: string | null | undefined) =>
  ((value ?? 'active').trim().toLowerCase() === 'active');

const isExplicitActiveStatus = (value: string | null | undefined) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'active';

const isDriverCommercialRoute = (pathname: string) => {
  const clean = cleanPathname(pathname);
  return (
    clean === '/driver/loads' ||
    clean.startsWith('/driver/loads/') ||
    clean === '/driver/quotes' ||
    clean.startsWith('/driver/quotes/') ||
    clean === '/driver/won-work' ||
    clean.startsWith('/driver/won-work/') ||
    clean === '/driver/finance' ||
    clean.startsWith('/driver/finance/') ||
    clean === '/driver/returns' ||
    clean.startsWith('/driver/returns/')
  );
};

export const cleanPathname = (pathname: string): string =>
  cleanPath(pathname).replace(/\/{2,}/g, '/');

export const PROTECTED_ROUTE_PREFIXES = [
  '/admin',
  '/broker',
  '/customer',
  '/driver',
  '/super-admin',
] as const;

export const isProtectedRoute = (pathname: string): boolean =>
  PROTECTED_ROUTE_PREFIXES.some((prefix) => pathMatches(cleanPathname(pathname), prefix));

export type RouteRequirement = {
  prefix: string;
  workspace: BusinessWorkspace;
  roles?: WorkspaceRole[];
  anyOf?: WorkspaceCapability[];
  exact?: boolean;
};

const ROUTE_REQUIREMENTS: RouteRequirement[] = [
  { prefix: '/admin/fleet/assignments', workspace: 'carrier_fleet', anyOf: ['jobs.allocate'] },
  { prefix: '/admin/fleet/active-jobs', workspace: 'carrier_fleet', anyOf: ['jobs.track'] },
  { prefix: '/admin/fleet/future-availability', workspace: 'carrier_fleet', anyOf: ['drivers.manage'] },
  { prefix: '/admin/fleet/positions', workspace: 'carrier_fleet', anyOf: ['fleet.positions.view'] },
  { prefix: '/admin/fleet/maintenance', workspace: 'carrier_fleet', anyOf: ['fleet.maintenance.manage'] },
  { prefix: '/admin/fleet', workspace: 'carrier_fleet', anyOf: ['fleet.positions.view'] },
  { prefix: '/admin/operations-centre', workspace: 'carrier_fleet', anyOf: ['jobs.dispatch'] },
  { prefix: '/admin/marketplace', workspace: 'carrier_fleet', anyOf: ['loads.view.marketplace'] },
  { prefix: '/admin/quotes', workspace: 'carrier_fleet', anyOf: ['quotes.submit'] },
  { prefix: '/admin/bids', workspace: 'carrier_fleet', anyOf: ['jobs.view'] },
  { prefix: '/admin/diary', workspace: 'carrier_fleet', anyOf: ['jobs.dispatch', 'jobs.execute', 'jobs.view'] },
  { prefix: '/admin/jobs', workspace: 'carrier_fleet', anyOf: ['jobs.view'] },
  { prefix: '/admin/disputes', workspace: 'carrier_fleet', anyOf: ['incidents.manage'] },
  { prefix: '/admin/incidents', workspace: 'carrier_fleet', anyOf: ['incidents.manage'] },
  { prefix: '/admin/driver-availability', workspace: 'carrier_fleet', anyOf: ['drivers.manage'] },
  { prefix: '/admin/drivers-vehicles', workspace: 'carrier_fleet', anyOf: ['drivers.manage', 'vehicles.manage'] },
  { prefix: '/admin/drivers', workspace: 'carrier_fleet', anyOf: ['drivers.manage'] },
  { prefix: '/admin/vehicles', workspace: 'carrier_fleet', anyOf: ['vehicles.manage'] },
  { prefix: '/admin/documents/expiry', workspace: 'carrier_fleet', anyOf: ['documents.company.manage', 'documents.verify'] },
  { prefix: '/admin/documents', workspace: 'carrier_fleet', anyOf: ['documents.company.manage', 'documents.verify'] },
  { prefix: '/admin/finance/payments', workspace: 'carrier_fleet', anyOf: ['payments.manage'] },
  { prefix: '/admin/finance/balances', workspace: 'carrier_fleet', anyOf: ['payments.manage', 'invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/finance/reports', workspace: 'carrier_fleet', anyOf: ['payments.manage', 'margins.view'] },
  { prefix: '/admin/finance', workspace: 'carrier_fleet', anyOf: ['payments.manage', 'margins.view', 'invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/invoices', workspace: 'carrier_fleet', anyOf: ['invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/returns', workspace: 'carrier_fleet', roles: ['company_owner', 'company_admin', 'carrier_admin', 'fleet_manager'] },
  { prefix: '/admin/dispatchers', workspace: 'carrier_fleet', anyOf: ['company.members.manage'] },
  { prefix: '/admin/companies', workspace: 'carrier_fleet', anyOf: ['company.members.manage'] },
  { prefix: '/admin/broker-invitations', workspace: 'carrier_fleet', roles: ['company_owner', 'company_admin', 'carrier_admin'] },
  { prefix: '/admin/notifications', workspace: 'carrier_fleet' },
  { prefix: '/admin/settings', workspace: 'carrier_fleet', anyOf: ['settings.manage'] },
  { prefix: '/admin', workspace: 'carrier_fleet', anyOf: ['jobs.view'], exact: true },

  { prefix: '/broker/enquiries', workspace: 'broker', anyOf: ['quotes.receive'] },
  { prefix: '/broker/customers', workspace: 'broker', anyOf: ['company.manage'] },
  { prefix: '/broker/carrier-network', workspace: 'broker', anyOf: ['company.manage'] },
  { prefix: '/broker/post-load', workspace: 'broker', anyOf: ['loads.create'] },
  { prefix: '/broker/loads', workspace: 'broker', anyOf: ['loads.view.own'] },
  { prefix: '/broker/bids', workspace: 'broker', anyOf: ['quotes.receive'] },
  { prefix: '/broker/compare-quotes', workspace: 'broker', anyOf: ['quotes.compare'] },
  { prefix: '/broker/awards', workspace: 'broker', anyOf: ['quotes.award'] },
  { prefix: '/broker/jobs', workspace: 'broker', anyOf: ['jobs.track'] },
  { prefix: '/broker/pod-review', workspace: 'broker', anyOf: ['jobs.review_pod'] },
  { prefix: '/broker/margins', workspace: 'broker', anyOf: ['margins.view'] },
  { prefix: '/broker/customer-invoices', workspace: 'broker', anyOf: ['invoices.customer.manage'] },
  { prefix: '/broker/carrier-costs', workspace: 'broker', anyOf: ['invoices.carrier.manage'] },
  { prefix: '/broker/disputes', workspace: 'broker', anyOf: ['incidents.manage'] },
  { prefix: '/broker/team', workspace: 'broker', anyOf: ['settings.manage'] },
  { prefix: '/broker/notifications', workspace: 'broker' },
  { prefix: '/broker/settings', workspace: 'broker', anyOf: ['settings.manage'] },
  { prefix: '/broker', workspace: 'broker', anyOf: ['loads.view.own'], exact: true },

  { prefix: '/customer/post-load', workspace: 'shipper', anyOf: ['loads.create'] },
  { prefix: '/customer/loads', workspace: 'shipper', anyOf: ['loads.view.own'] },
  { prefix: '/customer/quotes', workspace: 'shipper', anyOf: ['quotes.receive'] },
  { prefix: '/customer/awards', workspace: 'shipper', anyOf: ['quotes.award'] },
  { prefix: '/customer/deliveries', workspace: 'shipper', anyOf: ['jobs.track'] },
  { prefix: '/customer/jobs', workspace: 'shipper', anyOf: ['jobs.view'] },
  { prefix: '/customer/documents', workspace: 'shipper', anyOf: ['jobs.review_pod'] },
  { prefix: '/customer/invoices', workspace: 'shipper', anyOf: ['invoices.customer.manage'] },
  { prefix: '/customer/team', workspace: 'shipper', anyOf: ['settings.manage'] },
  { prefix: '/customer/updates', workspace: 'shipper' },
  { prefix: '/customer/notifications', workspace: 'shipper' },
  { prefix: '/customer/settings', workspace: 'shipper', anyOf: ['settings.manage'] },
  { prefix: '/customer', workspace: 'shipper', anyOf: ['loads.view.own'], exact: true },

  { prefix: '/driver/change-password', workspace: 'owner_operator' },
  { prefix: '/driver/loads', workspace: 'owner_operator', anyOf: ['loads.view.marketplace'] },
  { prefix: '/driver/quotes', workspace: 'owner_operator', anyOf: ['quotes.submit'] },
  { prefix: '/driver/won-work', workspace: 'owner_operator', anyOf: ['jobs.view'] },
  { prefix: '/driver/finance', workspace: 'owner_operator', anyOf: ['invoices.carrier.manage'] },
  { prefix: '/driver/returns', workspace: 'owner_operator' },
  { prefix: '/driver/jobs', workspace: 'owner_operator', anyOf: ['jobs.execute'] },
  { prefix: '/driver/history', workspace: 'owner_operator', anyOf: ['jobs.view'] },
  { prefix: '/driver/availability', workspace: 'owner_operator' },
  { prefix: '/driver/vehicles', workspace: 'owner_operator' },
  { prefix: '/driver/documents', workspace: 'owner_operator', anyOf: ['documents.own.manage'] },
  { prefix: '/driver/messages', workspace: 'owner_operator' },
  { prefix: '/driver/more', workspace: 'owner_operator' },
  { prefix: '/driver/notifications', workspace: 'owner_operator' },
  { prefix: '/driver/profile', workspace: 'owner_operator' },
  { prefix: '/driver', workspace: 'owner_operator', exact: true },
];

export const getRouteRequirement = (pathname: string): RouteRequirement | null => {
  const clean = cleanPathname(pathname);
  const matches = ROUTE_REQUIREMENTS.filter((requirement) =>
    pathMatches(clean, requirement.prefix, requirement.exact === true)
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
};

export const canAccessRoute = (
  pathname: string,
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): boolean => {
  const clean = cleanPathname(pathname);
  const requirement = getRouteRequirement(clean);

  if (!requirement) return !isProtectedRoute(clean);

  const workspaceRole = resolveRole(role, context);
  if (!workspaceRole) return false;

  if (!isActiveStatus(context.accountStatus)) return false;
  if (context.companyStatus && !isActiveStatus(context.companyStatus)) return false;

  if (clean.startsWith('/super-admin')) {
    return workspaceRole === 'platform_owner';
  }

  if (clean.startsWith('/driver')) {
    if (workspaceRole === 'driver') {
      if (!isExplicitActiveStatus(context.driverStatus)) return false;
      if (context.appAccess === false) return false;
      if (isDriverCommercialRoute(clean) && context.canCommercialBid === false) return false;
    }
    if (workspaceRole === 'owner_driver' && context.appAccess === false) return false;
  }

  if (requirement.roles && !requirement.roles.includes(workspaceRole)) return false;

  if (requirement.anyOf && requirement.anyOf.length > 0) {
    if (workspaceRole === 'driver' && requirement.workspace === 'owner_operator') {
      const granted = requirement.anyOf.some((capability) =>
        hasDriverCapability(capability) && hasWorkspaceCapability(workspaceRole, capability)
      );
      if (!granted) return false;
    } else if (!requirement.anyOf.some((capability) => hasWorkspaceCapability(workspaceRole, capability))) {
      return false;
    }
  }

  return true;
};
