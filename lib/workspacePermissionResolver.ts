import type { BusinessWorkspace } from './businessWorkspace';
import { membershipHasCapability, resolveMembershipRole, type MembershipRole } from './membershipRole';
import { resolveCompanyEnabledWorkspaces } from './activeWorkspace';
import {
  cleanPathname,
  getProtectedRouteRequirement,
  isProtectedRoute,
} from './roleCapabilities';

export type WorkspacePermissionDenyReason =
  | 'no_active_membership'
  | 'unsupported_membership_role'
  | 'unsupported_company_type'
  | 'active_workspace_required'
  | 'workspace_not_enabled'
  | 'requested_workspace_not_permitted'
  | 'route_workspace_mismatch'
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
  requiredCapability?: string | null;
};

export type WorkspacePermissionResult =
  | { allowed: true; membershipRole: MembershipRole; activeWorkspace: BusinessWorkspace }
  | { allowed: false; reason: WorkspacePermissionDenyReason };

const hasPathTraversalSignal = (pathname: string): boolean => {
  const normalized = pathname.toLowerCase();
  return normalized.includes('/../') || normalized.includes('/..') || normalized.includes('%2e%2e');
};

export function resolveWorkspacePermission(
  input: WorkspacePermissionInput,
): WorkspacePermissionResult {
  const pathname = cleanPathname(input.pathname);

  if (hasPathTraversalSignal(pathname)) {
    return { allowed: false, reason: 'malformed_route' };
  }

  if ((input.membershipStatus ?? '').trim().toLowerCase() !== 'active') {
    return { allowed: false, reason: 'no_active_membership' };
  }

  const membershipRole = resolveMembershipRole(input.membershipRole);
  if (!membershipRole) {
    return { allowed: false, reason: 'unsupported_membership_role' };
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

  const routeRequirement = getProtectedRouteRequirement(pathname);
  if (!routeRequirement) {
    if (isProtectedRoute(pathname)) {
      return { allowed: false, reason: 'unmapped_route' };
    }

    if (input.requiredCapability && !membershipHasCapability(membershipRole, input.requiredCapability)) {
      return { allowed: false, reason: 'capability_not_permitted' };
    }

    return { allowed: true, membershipRole, activeWorkspace };
  }

  if (routeRequirement.workspace !== activeWorkspace) {
    return { allowed: false, reason: 'route_workspace_mismatch' };
  }

  if (
    input.requiredCapability &&
    !membershipHasCapability(membershipRole, input.requiredCapability)
  ) {
    return { allowed: false, reason: 'capability_not_permitted' };
  }

  if (
    routeRequirement.anyOf?.length &&
    !routeRequirement.anyOf.some((capability) => membershipHasCapability(membershipRole, capability))
  ) {
    return { allowed: false, reason: 'capability_not_permitted' };
  }

  return { allowed: true, membershipRole, activeWorkspace };
}
