/**
 * Workspace registry — immutable lookup table linking each BusinessWorkspace
 * to its route prefix, capability set and associated company types.
 *
 * Use this registry for navigation guards, capability checks and workspace
 * discovery without duplicating constants across individual pages.
 */

import type { BusinessWorkspace } from './businessWorkspace';
import {
  WORKSPACE_CAPABILITIES,
  WORKSPACE_LANDING_ROUTE,
  WORKSPACE_LABEL,
} from './businessWorkspace';

/** A single workspace registry entry. */
export type WorkspaceRegistryEntry = {
  workspace: BusinessWorkspace;
  label: string;
  /** The canonical landing route for this workspace. */
  landingRoute: string;
  /** The route prefix that belongs exclusively to this workspace. */
  routePrefix: string;
  /** Capabilities available when this workspace is active. */
  capabilities: readonly string[];
  /**
   * Informational: company.company_type values associated with this workspace.
   * Access is enforced by RLS and membership, not by this field alone.
   */
  associatedCompanyTypes: readonly string[];
};

/** Immutable registry keyed by BusinessWorkspace value for O(1) lookup. */
export const WORKSPACE_REGISTRY: Record<BusinessWorkspace, WorkspaceRegistryEntry> = {
  owner_operator: {
    workspace: 'owner_operator',
    label: WORKSPACE_LABEL.owner_operator,
    landingRoute: WORKSPACE_LANDING_ROUTE.owner_operator,
    routePrefix: '/driver',
    capabilities: WORKSPACE_CAPABILITIES.owner_operator,
    associatedCompanyTypes: [],
  },
  shipper: {
    workspace: 'shipper',
    label: WORKSPACE_LABEL.shipper,
    landingRoute: WORKSPACE_LANDING_ROUTE.shipper,
    routePrefix: '/customer',
    capabilities: WORKSPACE_CAPABILITIES.shipper,
    associatedCompanyTypes: ['customer', 'shipper'],
  },
  broker: {
    workspace: 'broker',
    label: WORKSPACE_LABEL.broker,
    landingRoute: WORKSPACE_LANDING_ROUTE.broker,
    routePrefix: '/broker',
    capabilities: WORKSPACE_CAPABILITIES.broker,
    associatedCompanyTypes: ['broker'],
  },
  carrier_fleet: {
    workspace: 'carrier_fleet',
    label: WORKSPACE_LABEL.carrier_fleet,
    landingRoute: WORKSPACE_LANDING_ROUTE.carrier_fleet,
    routePrefix: '/admin',
    capabilities: WORKSPACE_CAPABILITIES.carrier_fleet,
    associatedCompanyTypes: ['standard', 'carrier', 'fleet'],
  },
};

/** All workspace entries as an ordered array. */
export const ALL_WORKSPACES: readonly WorkspaceRegistryEntry[] =
  Object.values(WORKSPACE_REGISTRY);

/** Returns the registry entry for a given workspace. */
export function getWorkspaceEntry(
  workspace: BusinessWorkspace,
): WorkspaceRegistryEntry {
  return WORKSPACE_REGISTRY[workspace];
}

/**
 * Returns the workspace entry whose route prefix matches the given pathname.
 * Returns undefined for public routes, super-admin and other non-workspace paths.
 */
export function getWorkspaceEntryForRoute(
  pathname: string,
): WorkspaceRegistryEntry | undefined {
  const clean = pathname.split('?')[0]?.split('#')[0] ?? '';
  return ALL_WORKSPACES.find(
    (entry) =>
      clean === entry.routePrefix || clean.startsWith(`${entry.routePrefix}/`),
  );
}
