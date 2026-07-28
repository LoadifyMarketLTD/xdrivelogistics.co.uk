/**
 * Permission resolver — single typed allow/deny contract.
 *
 * Combines company identity, membership role, enabled workspaces, active
 * workspace, required capability and route into one decision.
 *
 * This module is PURE (no network, no Supabase, no side effects) and
 * provides the typed contract that connects:
 *  - Frontend route guards (middleware.ts / page-level guards)
 *  - Per-page capability checks
 *  - Future server-side API validation
 *
 * Security layers NOT in this module (must exist independently):
 *  - Supabase RLS policies — enforced at the DB level for every query.
 *  - Server-side API route handlers — must validate membership/company
 *    independently; never trust client-provided company/workspace IDs.
 *  - State-machine validation — job status transitions, POD gates, etc.
 *
 * Usage pattern:
 * ```ts
 * const result = resolvePermission({
 *   companyId:         context.companyId,
 *   membershipRole:    context.membershipRole,
 *   enabledWorkspaces: context.enabledWorkspaces,
 *   activeWorkspace:   context.activeWorkspace,
 *   requiredCapability: 'jobs.dispatch',
 *   targetPathname:    pathname,
 * });
 * if (!result.allowed) redirect(getLandingRoute(context.activeWorkspace));
 * ```
 */

import type { BusinessWorkspace } from './businessWorkspace';
import type { MembershipRole } from './membershipRole';
import { workspaceForRoute } from './businessWorkspace';
import { membershipHasCapability } from './membershipRole';
import { membershipCanAccessRoute } from './workspaceBoundary';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PermissionInput = {
  /** Resolves from ActiveCompanyContext.companyId */
  companyId: string;
  /** Resolves from ActiveCompanyContext.membershipRole */
  membershipRole: MembershipRole;
  /** Resolves from ActiveCompanyContext.enabledWorkspaces */
  enabledWorkspaces: readonly BusinessWorkspace[];
  /** Resolves from ActiveCompanyContext.activeWorkspace */
  activeWorkspace: BusinessWorkspace;
  /** Optional capability string required for this action/page (e.g. 'jobs.dispatch'). */
  requiredCapability?: string;
  /** Optional pathname being accessed — used for cross-workspace and route checks. */
  targetPathname?: string;
};

export type PermissionDeniedReason =
  | 'no_company'              // companyId is missing
  | 'workspace_not_enabled'   // activeWorkspace is not in enabledWorkspaces
  | 'cross_workspace_access'  // targetPathname belongs to a different workspace
  | 'capability_denied'       // membershipRole does not have requiredCapability
  | 'route_not_permitted';    // membershipCanAccessRoute returned false

export type PermissionResult =
  | { allowed: true }
  | { allowed: false; reason: PermissionDeniedReason };

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Returns the combined allow/deny decision for a permission check.
 *
 * Evaluation order (fail on first denial):
 *  1. Company ID must be present.
 *  2. activeWorkspace must be within the enabledWorkspaces set.
 *  3. Super-admin routes are always denied.
 *  4. targetPathname workspace (if any) must match activeWorkspace.
 *  5. requiredCapability (if given) must be granted by membershipRole.
 *  6. targetPathname (if given) must pass the membership route check.
 */
export function resolvePermission(input: PermissionInput): PermissionResult {
  const {
    companyId,
    membershipRole,
    enabledWorkspaces,
    activeWorkspace,
    requiredCapability,
    targetPathname,
  } = input;

  // 1. Company identity required
  if (!companyId || !companyId.trim()) {
    return { allowed: false, reason: 'no_company' };
  }

  // 2. Active workspace must be in the enabled set
  if (!enabledWorkspaces.includes(activeWorkspace)) {
    return { allowed: false, reason: 'workspace_not_enabled' };
  }

  // 3. Super-admin routes are never accessible to workspace membership roles
  if (targetPathname) {
    const cleanPath = targetPathname.split('?')[0]?.split('#')[0] ?? '';
    if (cleanPath.startsWith('/super-admin')) {
      return { allowed: false, reason: 'route_not_permitted' };
    }
  }

  // 4. Route's workspace must match activeWorkspace
  if (targetPathname) {
    const pathWorkspace = workspaceForRoute(targetPathname);
    if (pathWorkspace !== null && pathWorkspace !== activeWorkspace) {
      return { allowed: false, reason: 'cross_workspace_access' };
    }
  }

  // 5. Required capability check
  if (requiredCapability) {
    if (!membershipHasCapability(membershipRole, requiredCapability)) {
      return { allowed: false, reason: 'capability_denied' };
    }
  }

  // 6. Per-route membership check (carrier_fleet /admin routes only)
  if (targetPathname && activeWorkspace === 'carrier_fleet') {
    const pathWorkspace = workspaceForRoute(targetPathname);
    // Only apply carrier_fleet route rules to /admin routes, not public routes
    if (pathWorkspace === 'carrier_fleet' && !membershipCanAccessRoute(targetPathname, membershipRole)) {
      return { allowed: false, reason: 'route_not_permitted' };
    }
  }

  return { allowed: true };
}
