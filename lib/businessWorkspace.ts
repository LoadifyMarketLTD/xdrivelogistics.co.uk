/**
 * BusinessWorkspace — the top-level workspace identity.
 *
 * Describes *which product surface* a company or user belongs to, independent
 * of their membership role within a company.  Four workspaces map 1:1 to the
 * four canonical route prefixes and are mutually exclusive from a routing
 * perspective.
 *
 * Existing routes (do not change):
 *   /driver    → owner_operator
 *   /customer  → shipper
 *   /broker    → broker
 *   /admin     → carrier_fleet  (legacy company / carrier-fleet control surface)
 *
 * Do not confuse BusinessWorkspace with:
 *   - WorkspaceRole (lib/workspaceRole.ts) — the UI-level coarse role resolver.
 *   - MembershipRole (lib/membershipRole.ts) — the per-company DB role.
 */

/** The four XDrive business workspace types. */
export type BusinessWorkspace =
  | 'owner_operator'  // individual owner-driver; accesses /driver
  | 'shipper'         // customer / shipper company; accesses /customer
  | 'broker'          // freight broker; accesses /broker
  | 'carrier_fleet';  // carrier / fleet company; accesses /admin

/** Canonical landing route for each workspace. Existing routes preserved. */
export const WORKSPACE_LANDING_ROUTE: Record<BusinessWorkspace, string> = {
  owner_operator: '/driver',
  shipper:        '/customer',
  broker:         '/broker',
  carrier_fleet:  '/admin',
};

/** Human-readable label for each workspace. */
export const WORKSPACE_LABEL: Record<BusinessWorkspace, string> = {
  owner_operator: 'Owner Operator',
  shipper:        'Shipper',
  broker:         'Broker',
  carrier_fleet:  'Carrier / Fleet',
};

/**
 * High-level capabilities available within each workspace.
 * These align with the WorkspaceCapability strings in lib/workspaceRole.ts.
 */
export const WORKSPACE_CAPABILITIES: Record<BusinessWorkspace, readonly string[]> = {
  owner_operator: [
    'loads.view.marketplace',
    'quotes.submit',
    'jobs.execute',
    'jobs.track',
    'documents.own.manage',
  ],
  shipper: [
    'loads.create',
    'loads.publish',
    'loads.view.own',
    'quotes.receive',
    'quotes.compare',
    'quotes.award',
    'jobs.track',
    'jobs.review_pod',
    'invoices.customer.manage',
  ],
  broker: [
    'loads.create',
    'loads.publish',
    'loads.view.marketplace',
    'quotes.submit',
    'quotes.receive',
    'quotes.compare',
    'quotes.award',
    'jobs.dispatch',
    'jobs.review_pod',
    'invoices.customer.manage',
    'invoices.carrier.manage',
    'margins.view',
  ],
  carrier_fleet: [
    'loads.view.marketplace',
    'quotes.submit',
    'jobs.view',
    'jobs.allocate',
    'jobs.dispatch',
    'jobs.track',
    'drivers.manage',
    'vehicles.manage',
    'fleet.positions.view',
    'documents.company.manage',
    'invoices.carrier.manage',
  ],
};

/**
 * Returns true if the workspace exposes the given high-level capability.
 */
export function workspaceHasCapability(
  workspace: BusinessWorkspace,
  capability: string,
): boolean {
  return WORKSPACE_CAPABILITIES[workspace]?.includes(capability) ?? false;
}

/**
 * Resolves the BusinessWorkspace for a given route pathname.
 * Returns null for unrecognised prefixes (public routes, super-admin, etc.).
 */
export function workspaceForRoute(pathname: string): BusinessWorkspace | null {
  const clean = pathname.split('?')[0]?.split('#')[0] ?? '';
  if (clean === '/driver'   || clean.startsWith('/driver/'))   return 'owner_operator';
  if (clean === '/customer' || clean.startsWith('/customer/')) return 'shipper';
  if (clean === '/broker'   || clean.startsWith('/broker/'))   return 'broker';
  if (clean === '/admin'    || clean.startsWith('/admin/'))    return 'carrier_fleet';
  return null;
}
