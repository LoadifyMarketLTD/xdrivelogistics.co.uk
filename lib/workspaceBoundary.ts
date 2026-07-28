import type { BusinessWorkspace } from './businessWorkspace';
import { workspaceForRoute, WORKSPACE_LANDING_ROUTE } from './businessWorkspace';

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
