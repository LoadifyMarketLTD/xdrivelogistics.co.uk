/**
 * Workspace route-boundary helpers.
 *
 * Pure functions for checking whether a pathname is within a workspace
 * boundary and for computing redirect targets when it is not.
 *
 * Security model — all checks fail closed:
 *  - Cross-workspace routes always return false.
 *  - Unknown routes (not in the explicit registry) return false.
 *  - Only super-admin and explicitly listed known routes are evaluated.
 *  - Public routes (/, /login, etc.) are NOT the concern of this module;
 *    callers must NOT use `membershipCanAccessRoute` for public-route gating.
 *
 * These helpers preserve the four canonical route prefixes:
 *   /driver    → owner_operator
 *   /customer  → shipper
 *   /broker    → broker
 *   /admin     → carrier_fleet
 *
 * They complement the capability-based ROUTE_REQUIREMENTS in
 * lib/roleCapabilities.ts, which already drives the existing middleware.
 * These helpers operate on the typed BusinessWorkspace / MembershipRole
 * contracts so they can be independently unit-tested.
 */

import type { BusinessWorkspace } from './businessWorkspace';
import type { MembershipRole } from './membershipRole';
import { workspaceForRoute, WORKSPACE_LANDING_ROUTE } from './businessWorkspace';
import { membershipHasCapability } from './membershipRole';

// ── Boundary checks ───────────────────────────────────────────────────────────

/**
 * Returns true when `pathname` is within the expected route boundary for
 * `workspace`.
 */
export function isWithinWorkspaceBoundary(
  pathname: string,
  workspace: BusinessWorkspace,
): boolean {
  return workspaceForRoute(pathname) === workspace;
}

/**
 * Returns the canonical landing route for a workspace.
 * Returns '/' for null to give callers a safe fallback.
 */
export function getLandingRoute(workspace: BusinessWorkspace | null): string {
  if (!workspace) return '/';
  return WORKSPACE_LANDING_ROUTE[workspace];
}

/**
 * Returns the redirect destination when a user accesses a route that is
 * outside their permitted workspace, or null when no redirect is needed.
 *
 * A null workspace means the user's workspace is unknown — no redirect is
 * applied to avoid a redirect loop.
 */
export function getOutOfBoundaryRedirect(
  pathname: string,
  workspace: BusinessWorkspace | null,
): string | null {
  if (!workspace) return null;
  const routeWorkspace = workspaceForRoute(pathname);
  // Public routes (routeWorkspace === null) are not workspace-scoped — no redirect needed
  if (routeWorkspace === null) return null;
  if (routeWorkspace === workspace) return null; // within boundary — no redirect needed
  return getLandingRoute(workspace);
}

// ── Per-route membership checks ───────────────────────────────────────────────

/**
 * Returns true when `role` has sufficient capability to access `pathname`
 * within the carrier_fleet (/admin) workspace.
 *
 * Fail-closed behaviour:
 *  - Super-admin routes → always false.
 *  - Routes belonging to OTHER workspace prefixes (/customer, /driver, /broker)
 *    → always false (cross-workspace access is never permitted here).
 *  - Known specific /admin sub-routes → checked against explicit capability map.
 *  - General /admin catch-all → requires minimum jobs.view capability.
 *  - All other routes (public routes, unknown patterns) → false.
 *
 * This function governs ONLY carrier_fleet (/admin) membership access.
 * Do not use it to gate public routes or other workspace routes.
 */
export function membershipCanAccessRoute(
  pathname: string,
  role: MembershipRole,
): boolean {
  const clean = pathname.split('?')[0]?.split('#')[0] ?? '';

  // Super-admin routes are never accessible to company membership roles
  if (clean.startsWith('/super-admin')) return false;

  // Cross-workspace routes: other workspace prefixes are NOT governed by
  // carrier_fleet membership — deny to prevent cross-workspace privilege escalation
  const routeWorkspace = workspaceForRoute(clean);
  if (routeWorkspace !== null && routeWorkspace !== 'carrier_fleet') return false;

  // Dispatch and live-operations routes
  if (
    clean.startsWith('/admin/operations-centre') ||
    clean.startsWith('/admin/diary')
  ) {
    return membershipHasCapability(role, 'jobs.dispatch');
  }

  // Finance routes
  if (clean.startsWith('/admin/invoices') || clean.startsWith('/admin/finance')) {
    return membershipHasCapability(role, 'invoices.carrier.manage');
  }

  // Driver and vehicle management
  if (
    clean.startsWith('/admin/drivers') ||
    clean.startsWith('/admin/vehicles') ||
    clean.startsWith('/admin/driver-availability')
  ) {
    return membershipHasCapability(role, 'drivers.manage');
  }

  // Team / settings management
  if (
    clean.startsWith('/admin/settings') ||
    clean.startsWith('/admin/dispatchers')
  ) {
    return membershipHasCapability(role, 'settings.manage');
  }

  // All remaining /admin routes require at minimum jobs.view.
  // Use exact match or /admin/ prefix to avoid matching /administration/* etc.
  if (clean === '/admin' || clean.startsWith('/admin/')) {
    return membershipHasCapability(role, 'jobs.view');
  }

  // Public routes, unknown patterns and anything not explicitly listed → deny
  return false;
}
