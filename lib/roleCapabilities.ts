import type { AppUserRole } from './authRole';
import type { BusinessWorkspace } from './businessWorkspace';
import type { DriverWorkspaceMode } from './driverWorkspaceMode';
import {
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
  membershipRole?: string | null;
  financeAccess?: 'full' | 'limited' | 'hidden' | null;
  ownerDriverWorkspace?: boolean | null;
  rawRole?: string | null;
  workspaceRole?: WorkspaceRole | null;
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
      workspaceRole === 'owner_driver' ||
      (hasWorkspaceCapability(workspaceRole, 'drivers.manage') &&
        hasWorkspaceCapability(workspaceRole, 'jobs.track')),
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

/** Sanitised pathname (no query, no hash, no double slashes). Exported for resolvers. */
export const cleanPathname = (pathname: string): string =>
  cleanPath(pathname).replace(/\/{2,}/g, '/');

/** Route prefixes that require authentication. */
export const PROTECTED_ROUTE_PREFIXES = [
  '/admin',
  '/broker',
  '/customer',
  '/driver',
  '/super-admin',
] as const;

/** Returns true if the pathname falls under a protected prefix. */
export const isProtectedRoute = (pathname: string): boolean =>
  PROTECTED_ROUTE_PREFIXES.some((prefix) => pathMatches(cleanPathname(pathname), prefix));

export type RouteRequirement = {
  prefix: string;
  /** BusinessWorkspace that owns this route. */
  workspace: BusinessWorkspace;
  roles?: WorkspaceRole[];
  anyOf?: WorkspaceCapability[];
  /** When true, only an exact pathname match triggers this requirement. */
  exact?: boolean;
};

const ROUTE_REQUIREMENTS: RouteRequirement[] = [
  // carrier_fleet (/admin)
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
  { prefix: '/admin/settings', workspace: 'carrier_fleet', anyOf: ['settings.manage'] },
  { prefix: '/admin', workspace: 'carrier_fleet', anyOf: ['jobs.view'], exact: true },

  // broker (/broker)
  { prefix: '/broker/customers', workspace: 'broker', anyOf: ['company.manage'] },
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
  { prefix: '/broker/settings', workspace: 'broker', anyOf: ['settings.manage'] },
  { prefix: '/broker', workspace: 'broker', anyOf: ['loads.view.own'], exact: true },

  // shipper (/customer)
  { prefix: '/customer/post-load', workspace: 'shipper', anyOf: ['loads.create'] },
  { prefix: '/customer/loads', workspace: 'shipper', anyOf: ['loads.view.own'] },
  { prefix: '/customer/quotes', workspace: 'shipper', anyOf: ['quotes.receive'] },
  { prefix: '/customer/awards', workspace: 'shipper', anyOf: ['quotes.award'] },
  { prefix: '/customer/deliveries', workspace: 'shipper', anyOf: ['jobs.track'] },
  { prefix: '/customer/jobs', workspace: 'shipper', anyOf: ['jobs.view'] },
  { prefix: '/customer/documents', workspace: 'shipper', anyOf: ['jobs.review_pod'] },
  { prefix: '/customer/invoices', workspace: 'shipper', anyOf: ['invoices.customer.manage'] },
  // Team is currently a read-only company roster. Reuse settings access rather
  // than granting the customer role the broader company.members.manage ability.
  { prefix: '/customer/team', workspace: 'shipper', anyOf: ['settings.manage'] },
  { prefix: '/customer/settings', workspace: 'shipper', anyOf: ['settings.manage'] },
  { prefix: '/customer', workspace: 'shipper', anyOf: ['loads.view.own'], exact: true },

  // owner_operator (/driver)
  { prefix: '/driver/change-password', workspace: 'owner_operator', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/loads', workspace: 'owner_operator', roles: ['owner_driver'], anyOf: ['loads.view.marketplace'] },
  { prefix: '/driver/quotes', workspace: 'owner_operator', roles: ['owner_driver'], anyOf: ['quotes.submit'] },
  { prefix: '/driver/won-work', workspace: 'owner_operator', roles: ['owner_driver'], anyOf: ['jobs.view'] },
  { prefix: '/driver/finance', workspace: 'owner_operator', roles: ['owner_driver'], anyOf: ['invoices.carrier.manage'] },
  { prefix: '/driver/returns', workspace: 'owner_operator', roles: ['owner_driver'] },
  { prefix: '/driver/jobs', workspace: 'owner_operator', roles: ['driver', 'owner_driver'], anyOf: ['jobs.execute'] },
  { prefix: '/driver/history', workspace: 'owner_operator', roles: ['driver', 'owner_driver'], anyOf: ['jobs.view'] },
  { prefix: '/driver/availability', workspace: 'owner_operator', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/vehicles', workspace: 'owner_operator', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/documents', workspace: 'owner_operator', roles: ['driver', 'owner_driver'], anyOf: ['documents.own.manage'] },
  { prefix: '/driver/messages', workspace: 'owner_operator', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/profile', workspace: 'owner_operator', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver', workspace: 'owner_operator', exact: true },
];

/**
 * Returns the most-specific RouteRequirement for the given pathname,
 * or null if no requirement is registered.
 * Protected-but-unregistered routes should be denied by callers.
 */
export const getProtectedRouteRequirement = (pathname: string): RouteRequirement | null => {
  const clean = cleanPathname(pathname);
  let best: RouteRequirement | null = null;
  for (const req of ROUTE_REQUIREMENTS) {
    if (pathMatches(clean, req.prefix, req.exact)) {
      if (!best || req.prefix.length > best.prefix.length) {
        best = req;
      }
    }
  }
  return best;
};

export const isCapabilityAllowedForPath = (
  pathname: string,
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): boolean => {
  const path = cleanPath(pathname);
  const workspaceRole = resolveRole(role, context);
  if (!workspaceRole) return false;

  if (pathMatches(path, '/super-admin')) return workspaceRole === 'platform_owner';

  if (pathMatches(path, '/broker')) {
    if (workspaceRole !== 'broker') return false;
  } else if (pathMatches(path, '/customer')) {
    if (workspaceRole !== 'customer') return false;
  } else if (pathMatches(path, '/driver')) {
    if (workspaceRole !== 'driver' && workspaceRole !== 'owner_driver') return false;
  } else if (pathMatches(path, '/admin')) {
    if (
      ![
        'platform_owner',
        'company_owner',
        'company_admin',
        'carrier_admin',
        'fleet_manager',
        'dispatcher',
        'finance',
        'compliance',
        'viewer',
      ].includes(workspaceRole)
    ) {
      return false;
    }
  } else if (pathMatches(path, '/m')) {
    return workspaceRole === 'driver' || workspaceRole === 'owner_driver';
  } else {
    return true;
  }

  const requirement = ROUTE_REQUIREMENTS.find((entry) => pathMatches(path, entry.prefix));
  if (!requirement) return true;
  if (requirement.roles && !requirement.roles.includes(workspaceRole)) return false;
  if (!requirement.anyOf?.length) return true;

  return requirement.anyOf.some((capability) =>
    hasWorkspaceCapability(workspaceRole, capability)
  );
};
