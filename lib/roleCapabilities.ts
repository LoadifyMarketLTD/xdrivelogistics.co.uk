import type { AppUserRole } from './authRole';
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

const pathMatches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const cleanPath = (pathname: string) => pathname.split('?')[0]?.split('#')[0] || '/';

type RouteRequirement = {
  prefix: string;
  roles?: WorkspaceRole[];
  anyOf?: WorkspaceCapability[];
};

const ROUTE_REQUIREMENTS: RouteRequirement[] = [
  { prefix: '/admin/fleet/assignments', anyOf: ['jobs.allocate'] },
  { prefix: '/admin/fleet/active-jobs', anyOf: ['jobs.track'] },
  { prefix: '/admin/fleet/future-availability', anyOf: ['drivers.manage'] },
  { prefix: '/admin/fleet/positions', anyOf: ['fleet.positions.view'] },
  { prefix: '/admin/fleet/maintenance', anyOf: ['fleet.maintenance.manage'] },
  { prefix: '/admin/fleet', anyOf: ['fleet.positions.view'] },
  { prefix: '/admin/operations-centre', anyOf: ['jobs.dispatch'] },
  { prefix: '/admin/marketplace', anyOf: ['loads.view.marketplace'] },
  { prefix: '/admin/quotes', anyOf: ['quotes.submit'] },
  { prefix: '/admin/bids', anyOf: ['jobs.view'] },
  { prefix: '/admin/diary', anyOf: ['jobs.dispatch', 'jobs.execute', 'jobs.view'] },
  { prefix: '/admin/jobs', anyOf: ['jobs.view'] },
  { prefix: '/admin/disputes', anyOf: ['incidents.manage'] },
  { prefix: '/admin/incidents', anyOf: ['incidents.manage'] },
  { prefix: '/admin/driver-availability', anyOf: ['drivers.manage'] },
  { prefix: '/admin/drivers', anyOf: ['drivers.manage'] },
  { prefix: '/admin/vehicles', anyOf: ['vehicles.manage'] },
  { prefix: '/admin/documents/expiry', anyOf: ['documents.company.manage', 'documents.verify'] },
  { prefix: '/admin/documents', anyOf: ['documents.company.manage', 'documents.verify'] },
  { prefix: '/admin/finance/payments', anyOf: ['payments.manage'] },
  {
    prefix: '/admin/finance/balances',
    anyOf: ['payments.manage', 'invoices.customer.manage', 'invoices.carrier.manage'],
  },
  { prefix: '/admin/finance/reports', anyOf: ['payments.manage', 'margins.view'] },
  {
    prefix: '/admin/finance',
    anyOf: ['payments.manage', 'margins.view', 'invoices.customer.manage', 'invoices.carrier.manage'],
  },
  { prefix: '/admin/invoices', anyOf: ['invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/returns', roles: ['company_owner', 'company_admin', 'carrier_admin', 'fleet_manager'] },
  { prefix: '/admin/dispatchers', anyOf: ['company.members.manage'] },
  { prefix: '/admin/settings', anyOf: ['settings.manage'] },

  { prefix: '/broker/customers', anyOf: ['company.manage'] },
  { prefix: '/broker/post-load', anyOf: ['loads.create'] },
  { prefix: '/broker/loads', anyOf: ['loads.view.own'] },
  { prefix: '/broker/bids', anyOf: ['quotes.receive'] },
  { prefix: '/broker/compare-quotes', anyOf: ['quotes.compare'] },
  { prefix: '/broker/awards', anyOf: ['quotes.award'] },
  { prefix: '/broker/jobs', anyOf: ['jobs.track'] },
  { prefix: '/broker/pod-review', anyOf: ['jobs.review_pod'] },
  { prefix: '/broker/margins', anyOf: ['margins.view'] },
  { prefix: '/broker/customer-invoices', anyOf: ['invoices.customer.manage'] },
  { prefix: '/broker/carrier-costs', anyOf: ['invoices.carrier.manage'] },
  { prefix: '/broker/disputes', anyOf: ['incidents.manage'] },
  { prefix: '/broker/settings', anyOf: ['settings.manage'] },

  { prefix: '/customer/post-load', anyOf: ['loads.create'] },
  { prefix: '/customer/loads', anyOf: ['loads.view.own'] },
  { prefix: '/customer/quotes', anyOf: ['quotes.receive'] },
  { prefix: '/customer/awards', anyOf: ['quotes.award'] },
  { prefix: '/customer/deliveries', anyOf: ['jobs.track'] },
  { prefix: '/customer/jobs', anyOf: ['jobs.view'] },
  { prefix: '/customer/documents', anyOf: ['jobs.review_pod'] },
  { prefix: '/customer/invoices', anyOf: ['invoices.customer.manage'] },
  // Team is currently a read-only company roster. Reuse settings access rather
  // than granting the customer role the broader company.members.manage ability.
  { prefix: '/customer/team', anyOf: ['settings.manage'] },
  { prefix: '/customer/settings', anyOf: ['settings.manage'] },

  { prefix: '/driver/change-password', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/loads', roles: ['owner_driver'], anyOf: ['loads.view.marketplace'] },
  { prefix: '/driver/quotes', roles: ['owner_driver'], anyOf: ['quotes.submit'] },
  { prefix: '/driver/won-work', roles: ['owner_driver'], anyOf: ['jobs.view'] },
  { prefix: '/driver/finance', roles: ['owner_driver'], anyOf: ['invoices.carrier.manage'] },
  { prefix: '/driver/returns', roles: ['owner_driver'] },
  { prefix: '/driver/jobs', roles: ['driver', 'owner_driver'], anyOf: ['jobs.execute'] },
  { prefix: '/driver/history', roles: ['driver', 'owner_driver'], anyOf: ['jobs.view'] },
  { prefix: '/driver/availability', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/vehicles', roles: ['driver', 'owner_driver'] },
  {
    prefix: '/driver/documents',
    roles: ['driver', 'owner_driver'],
    anyOf: ['documents.own.manage'],
  },
  { prefix: '/driver/messages', roles: ['driver', 'owner_driver'] },
  { prefix: '/driver/profile', roles: ['driver', 'owner_driver'] },
];

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
