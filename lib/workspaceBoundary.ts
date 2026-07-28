/**
 * Workspace route-boundary helpers.
 *
 * Pure functions for checking whether a pathname is within a workspace
 * boundary and for computing redirect targets when it is not.
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
 * This is an additive, per-route refinement on top of workspace-boundary
 * enforcement. It is intentionally conservative: any route not explicitly
 * listed here is allowed for all roles so that new admin pages do not
 * accidentally lock out valid members.
 */
export function membershipCanAccessRoute(
  pathname: string,
  role: MembershipRole,
): boolean {
  const clean = pathname.split('?')[0]?.split('#')[0] ?? '';

  // Super-admin routes are never accessible to membership roles
  if (clean.startsWith('/super-admin')) return false;

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

  // All remaining /admin routes require at minimum jobs.view
  if (clean.startsWith('/admin')) {
    return membershipHasCapability(role, 'jobs.view');
  }

  // Routes outside /admin are not governed by this helper
  return true;
}
