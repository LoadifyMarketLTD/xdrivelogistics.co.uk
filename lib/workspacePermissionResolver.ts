import { workspaceForRoute, type BusinessWorkspace } from './businessWorkspace';
import { membershipHasCapability, resolveMembershipRole, type MembershipRole } from './membershipRole';
import { resolveCompanyEnabledWorkspaces } from './activeWorkspace';
import { workspaceHasCapability } from './businessWorkspace';
import type { WorkspaceCapability, WorkspaceRole } from './workspaceRole';
import {
  cleanPathname,
  getProtectedRouteRequirement,
  isProtectedRoute,
} from './roleCapabilities';

export type WorkspacePermissionDenyReason =
  | 'no_active_membership'
  | 'unsupported_membership_role'
  | 'unsupported_workspace_role'
  | 'unsupported_company_type'
  | 'active_workspace_required'
  | 'workspace_not_enabled'
  | 'requested_workspace_not_permitted'
  | 'route_workspace_mismatch'
  | 'owner_driver_proof_required'
  | 'commercial_bidding_disabled'
  | 'driver_context_required'
  | 'driver_inactive'
  | 'driver_app_access_denied'
  | 'account_inactive'
  | 'company_inactive'
  | 'capability_not_permitted'
  | 'unmapped_route'
  | 'malformed_route';

export type WorkspacePermissionInput = {
  companyType: string | null | undefined;
  membershipStatus: string | null | undefined;
  membershipRole: string | null | undefined;
  enabledWorkspaces?: readonly string[] | null;
  activeWorkspace?: BusinessWorkspace | null;
  requestedWorkspace?: BusinessWorkspace | null;
  pathname: string;
  requiredCapability?: WorkspaceCapability | null;
  workspaceRole?: WorkspaceRole | null;
  ownerDriverWorkspace?: boolean | null;
  ownerDriverExecutionMode?: boolean | null;
  canCommercialBid?: boolean | null;
  driverId?: string | null;
  driverStatus?: string | null;
  appAccess?: boolean | null;
  accountStatus?: string | null;
  companyStatus?: string | null;
};

export type WorkspacePermissionResult =
  | { allowed: true; membershipRole: MembershipRole; activeWorkspace: BusinessWorkspace }
  | { allowed: false; reason: WorkspacePermissionDenyReason };

const hasPathTraversalSignal = (pathname: string): boolean => {
  const normalized = pathname.toLowerCase();
  return normalized.includes('/../') || normalized.includes('/..') || normalized.includes('%2e%2e');
};

const isActiveStatus = (value: string | null | undefined): boolean =>
  ((value ?? 'active').trim().toLowerCase() === 'active');

const isExplicitActiveStatus = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().toLowerCase() === 'active';

const isDriverSurfaceRoute = (pathname: string): boolean =>
  pathname === '/driver' || pathname.startsWith('/driver/');

const isDriverCommercialRoute = (pathname: string): boolean =>
  pathname === '/driver/loads' ||
  pathname.startsWith('/driver/loads/') ||
  pathname === '/driver/quotes' ||
  pathname.startsWith('/driver/quotes/') ||
  pathname === '/driver/won-work' ||
  pathname.startsWith('/driver/won-work/') ||
  pathname === '/driver/finance' ||
  pathname.startsWith('/driver/finance/') ||
  pathname === '/driver/returns' ||
  pathname.startsWith('/driver/returns/');

/**
 * Compatibility fallback for existing protected pages that are live but not yet
 * represented in the strict route requirement registry.
 *
 * Keep this list explicit and scoped to known routes so unmapped/invented
 * protected paths continue to fail closed.
 */
const COMPATIBILITY_FALLBACK_PREFIXES: readonly string[] = [
  '/admin/companies',
  '/admin/broker-invitations',
  '/admin/drivers-vehicles',
  '/admin/notifications',
  '/broker/carrier-network',
  '/broker/team',
  '/broker/notifications',
  '/customer/updates',
  '/customer/notifications',
  '/driver/more',
  '/driver/notifications',
];

const isCompatibilityFallbackRoute = (pathname: string): boolean =>
  COMPATIBILITY_FALLBACK_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export function resolveWorkspacePermission(
  input: WorkspacePermissionInput,
): WorkspacePermissionResult {
  const pathname = cleanPathname(input.pathname);
  const driverRoute = isDriverSurfaceRoute(pathname);

  if (hasPathTraversalSignal(pathname)) {
    return { allowed: false, reason: 'malformed_route' };
  }

  if ((input.membershipStatus ?? '').trim().toLowerCase() !== 'active') {
    return { allowed: false, reason: 'no_active_membership' };
  }

  if (!isActiveStatus(input.accountStatus)) {
    return { allowed: false, reason: 'account_inactive' };
  }

  if (!isActiveStatus(input.companyStatus)) {
    return { allowed: false, reason: 'company_inactive' };
  }

  const membershipRole = resolveMembershipRole(input.membershipRole);
  if (!membershipRole) {
    return { allowed: false, reason: 'unsupported_membership_role' };
  }

  const routeWorkspace = workspaceForRoute(pathname);
  const driverOnlyWorkspaceRole =
    input.workspaceRole === 'driver' || input.workspaceRole === 'owner_driver';

  // Driver surface permissions never imply /admin access. A dual-role user must
  // switch into a membership-derived admin workspace role before entering /admin.
  if (routeWorkspace === 'carrier_fleet' && driverOnlyWorkspaceRole) {
    return { allowed: false, reason: 'capability_not_permitted' };
  }

  const enabled = resolveCompanyEnabledWorkspaces({
    companyType: input.companyType,
    enabledWorkspaces: input.enabledWorkspaces,
  });
  if (!enabled.ok) {
    return { allowed: false, reason: enabled.error };
  }

  const requestedWorkspace = input.requestedWorkspace ?? null;
  if (requestedWorkspace && !enabled.enabledWorkspaces.includes(requestedWorkspace)) {
    return { allowed: false, reason: 'requested_workspace_not_permitted' };
  }

  const activeWorkspace =
    input.activeWorkspace ??
    requestedWorkspace ??
    (enabled.enabledWorkspaces.length === 1 ? enabled.enabledWorkspaces[0] : null);

  if (!activeWorkspace) {
    return { allowed: false, reason: 'active_workspace_required' };
  }

  if (!enabled.enabledWorkspaces.includes(activeWorkspace)) {
    return { allowed: false, reason: 'workspace_not_enabled' };
  }

  if (isDriverSurfaceRoute(pathname)) {
    const isChangePasswordRoute = pathname === '/driver/change-password' || pathname.startsWith('/driver/change-password/');
    if (!isChangePasswordRoute && !input.driverId) {
      return { allowed: false, reason: 'driver_context_required' };
    }
    if (!isExplicitActiveStatus(input.accountStatus)) {
      return { allowed: false, reason: 'account_inactive' };
    }
    if (!isExplicitActiveStatus(input.companyStatus)) {
      return { allowed: false, reason: 'company_inactive' };
    }
    if (!isExplicitActiveStatus(input.driverStatus)) {
      return { allowed: false, reason: 'driver_inactive' };
    }
    if (input.appAccess !== true) {
      return { allowed: false, reason: 'driver_app_access_denied' };
    }
  }

  if (isDriverCommercialRoute(pathname)) {
    const isQuoteRoute = pathname === '/driver/quotes' || pathname.startsWith('/driver/quotes/');
    if (isQuoteRoute && input.canCommercialBid !== true) {
      return { allowed: false, reason: 'commercial_bidding_disabled' };
    }
  }

  const routeRequirement = getProtectedRouteRequirement(pathname);
  if (!routeRequirement) {
    if (isProtectedRoute(pathname)) {
      if (!routeWorkspace || !isCompatibilityFallbackRoute(pathname)) {
        return { allowed: false, reason: 'unmapped_route' };
      }
      if (
        routeWorkspace !== activeWorkspace &&
        !(isDriverSurfaceRoute(pathname) && activeWorkspace === 'carrier_fleet')
      ) {
        return { allowed: false, reason: 'route_workspace_mismatch' };
      }
      if (
        input.requiredCapability &&
        (!workspaceHasCapability(activeWorkspace, input.requiredCapability) ||
          (!driverRoute && !membershipHasCapability(membershipRole, input.requiredCapability)))
      ) {
        return { allowed: false, reason: 'capability_not_permitted' };
      }

      return { allowed: true, membershipRole, activeWorkspace };
    }

    if (
      input.requiredCapability &&
      (!workspaceHasCapability(activeWorkspace, input.requiredCapability) ||
        (!driverRoute && !membershipHasCapability(membershipRole, input.requiredCapability)))
    ) {
      return { allowed: false, reason: 'capability_not_permitted' };
    }

    return { allowed: true, membershipRole, activeWorkspace };
  }

  if (routeRequirement.roles?.length) {
    const workspaceRole = input.workspaceRole ?? null;
    if (!workspaceRole) {
      return { allowed: false, reason: 'unsupported_workspace_role' };
    }
    if (!routeRequirement.roles.includes(workspaceRole)) {
      return { allowed: false, reason: 'capability_not_permitted' };
    }
  }

  if (
    routeRequirement.workspace !== activeWorkspace &&
    !(isDriverSurfaceRoute(pathname) && activeWorkspace === 'carrier_fleet')
  ) {
    return { allowed: false, reason: 'route_workspace_mismatch' };
  }

  if (
    input.requiredCapability &&
    (!workspaceHasCapability(activeWorkspace, input.requiredCapability) ||
      (!driverRoute && !membershipHasCapability(membershipRole, input.requiredCapability)))
  ) {
    return { allowed: false, reason: 'capability_not_permitted' };
  }

  if (
    routeRequirement.anyOf?.length &&
    !routeRequirement.anyOf.some(
      (capability) =>
        workspaceHasCapability(activeWorkspace, capability) &&
        (driverRoute || membershipHasCapability(membershipRole, capability)),
    )
  ) {
    return { allowed: false, reason: 'capability_not_permitted' };
  }

  return { allowed: true, membershipRole, activeWorkspace };
}
