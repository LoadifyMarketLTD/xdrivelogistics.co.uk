import type { BusinessWorkspace } from './businessWorkspace';
import type { MembershipRole } from './membershipRole';
import { workspaceForRoute, WORKSPACE_LANDING_ROUTE } from './businessWorkspace';
import { resolveWorkspacePermission } from './workspacePermissionResolver';

export function isWithinWorkspaceBoundary(
  pathname: string,
  workspace: BusinessWorkspace,
): boolean {
  return workspaceForRoute(pathname) === workspace;
}

export function getLandingRoute(workspace: BusinessWorkspace | null): string {
  if (!workspace) return '/';
  return WORKSPACE_LANDING_ROUTE[workspace];
}

export function getOutOfBoundaryRedirect(
  pathname: string,
  workspace: BusinessWorkspace | null,
): string | null {
  if (!workspace) return null;
  const routeWorkspace = workspaceForRoute(pathname);
  if (routeWorkspace === null) return null;
  if (routeWorkspace === workspace) return null;
  return getLandingRoute(workspace);
}

/**
 * Membership access checker for protected routes.
 * This is fail-closed for unmapped routes and cross-workspace access.
 */
export function membershipCanAccessRoute(
  pathname: string,
  role: MembershipRole,
): boolean {
  const result = resolveWorkspacePermission({
    companyType: 'standard',
    membershipStatus: 'active',
    membershipRole: role,
    enabledWorkspaces: ['carrier_fleet'],
    activeWorkspace: 'carrier_fleet',
    pathname,
  });

  return result.allowed;
}
