import type { AppUserRole } from './authRole';
import type { DriverWorkspaceMode } from './driverWorkspaceMode';
import {
  getWorkspaceCapabilities,
  isWorkspacePathAllowed,
  resolveWorkspaceRole,
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

const workspaceUser = (
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): WorkspaceUserLike | null => {
  if (!role && !context.workspaceRole) return null;
  return {
    role,
    rawRole: context.rawRole ?? null,
    membershipRole: context.membershipRole ?? null,
    ownerDriverWorkspace: context.ownerDriverWorkspace === true,
    canAccessDriverMode: context.canAccessDriverMode === true,
    financeAccess: context.financeAccess ?? null,
    workspaceRole: context.workspaceRole ?? null,
  };
};

export const getCapabilitiesForRole = (
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): RoleCapabilities => {
  const user = workspaceUser(role, context);
  if (!user) return NO_CAPABILITIES;

  const workspaceRole = resolveWorkspaceRole(user);
  const capabilities = getWorkspaceCapabilities(workspaceRole);
  const has = (...keys: Parameters<typeof capabilities.has>[0][]) => keys.some((key) => capabilities.has(key));

  return {
    canPostLoads: has('loads.create', 'loads.publish'),
    canViewExchangeLoads: has('loads.view.marketplace'),
    canQuoteLoads: has('quotes.submit'),
    canReceiveQuotes: has('quotes.receive'),
    canAwardJobs: has('quotes.award'),
    canExecuteJobs: has('jobs.execute'),
    canAllocateDrivers: has('jobs.allocate'),
    canManageFleet: has('drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'fleet.maintenance.manage', 'fleet.future.manage'),
    canManageCompanyUsers: has('company.members.manage'),
    canManageOwnVehicle: workspaceRole === 'owner_driver' || has('vehicles.manage'),
    canUploadPod: has('jobs.review_pod', 'jobs.execute'),
    canViewInvoices: has('invoices.customer.manage', 'invoices.carrier.manage'),
    canRepostToExchange: has('loads.publish'),
    canUseReturnJourneys: workspaceRole === 'owner_driver' || has('fleet.future.manage'),
  };
};

export const getDriverWorkspaceCapabilities = (
  mode: DriverWorkspaceMode,
  context: RouteAccessContext & { role?: AppUserRole | string | null } = {}
): RoleCapabilities => {
  if (mode === 'provider_driver') {
    return getCapabilitiesForRole('driver', {
      ...context,
      workspaceRole: 'driver',
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
    workspaceRole: context.ownerDriverWorkspace ? 'owner_driver' : 'driver',
  });
};

export const isCapabilityAllowedForPath = (
  pathname: string,
  role: AppUserRole | null,
  context: RouteAccessContext = {}
): boolean => isWorkspacePathAllowed(pathname, workspaceUser(role, context));
