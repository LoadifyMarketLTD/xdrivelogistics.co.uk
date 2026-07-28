/**
 * Active-company context contract.
 *
 * Resolves which company, enabled workspaces and active workspace are current
 * from raw public.company_memberships rows (joined with public.companies).
 *
 * Key architectural decisions:
 *  - A company is NOT limited to one workspace.  `enabledWorkspaces` is a set;
 *    `activeWorkspace` is the independently selected entry within that set.
 *  - Unknown / null / empty `company_type` values do NOT default to carrier_fleet.
 *    They return `workspace_not_enabled`.  Only explicitly recognised values map
 *    to a workspace.
 *  - Resolution never silently falls back across companies or workspaces.
 *  - This module is pure (no Supabase imports, no side effects) so it can be
 *    fully unit-tested without mocking.
 *
 * Schema references:
 *   public.companies              — supabase/migrations/006_complete_schema.sql
 *   public.company_memberships    — supabase/migrations/006_complete_schema.sql
 *   public.company_role ENUM      — owner | admin | dispatcher | member | viewer
 *   public.membership_status ENUM — invited | active | suspended
 */

import type { BusinessWorkspace } from './businessWorkspace';
import type { MembershipRole } from './membershipRole';
import { workspaceForRoute } from './businessWorkspace';
import { resolveMembershipRole } from './membershipRole';

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * The resolved active-company context.
 * All pages that need company identity should consume this type rather than
 * reading raw DB fields.
 */
export type ActiveCompanyContext = {
  /** Matches public.companies.id */
  companyId: string;
  /** Matches public.companies.name */
  companyName: string;
  /** The user's role in this company (from company_memberships.role_in_company). */
  membershipRole: MembershipRole;
  /**
   * All business workspaces this company membership is permitted to access.
   * Derived from the company's known type and capabilities.
   * Never empty on a successful resolution.
   */
  enabledWorkspaces: readonly BusinessWorkspace[];
  /**
   * The workspace currently active for this session.
   * Must be a member of `enabledWorkspaces`.
   * Selected from: targetPathname → targetWorkspace → preferredWorkspace → sole enabled workspace.
   */
  activeWorkspace: BusinessWorkspace;
  /** True only when membership_status = 'active'. */
  isActive: boolean;
};

/**
 * Minimal shape of a company_memberships row joined with its companies row.
 * Only fields used by resolution logic are required.
 */
export type RawMembershipRow = {
  company_id: string;
  user_id: string;
  role_in_company: string | null;
  status: string | null;
  companies: {
    id: string;
    name: string;
    company_type?: string | null;
    status?: string | null;
  } | null;
};

/** Possible failure reasons when resolving the active workspace. */
export type WorkspaceResolutionError =
  | 'no_memberships'         // user has no membership rows at all
  | 'no_active_membership'   // none are active / no preference matches
  | 'company_inactive'       // company.status is not 'active'
  | 'workspace_mismatch'     // requested route/workspace is outside enabled set
  | 'workspace_not_enabled'; // company type is unrecognised — no workspaces enabled

export type WorkspaceResolutionResult =
  | { ok: true;  context: ActiveCompanyContext }
  | { ok: false; error: WorkspaceResolutionError };

// ── Resolution logic ──────────────────────────────────────────────────────────

/**
 * Resolves the active company context from a list of raw membership rows.
 *
 * Selection rules (applied in order):
 *  1. Filter to memberships whose status = 'active' and whose company is not
 *     suspended.
 *  2. If `preferredCompanyId` is provided and matches an active membership, use it.
 *  3. Otherwise, only auto-select when there is **exactly one** active membership.
 *     Multiple memberships without an explicit preference return an error —
 *     the caller must prompt the user to select a company.
 *  4. Determine enabled workspaces for the chosen company.  If none → error.
 *  5. Select `activeWorkspace`:
 *     a. From `targetPathname` or `targetWorkspace` (route guard check) —
 *        must be in the enabled set, otherwise `workspace_mismatch`.
 *     b. Otherwise from `preferredWorkspace` — must be in the enabled set.
 *     c. Otherwise auto-select only when there is exactly one enabled workspace.
 *     d. Multiple enabled workspaces without an explicit selection → error.
 *
 * This function never falls back to a random first membership or workspace,
 * preventing inadvertent cross-company or cross-workspace access.
 */
export function resolveActiveCompanyContext(
  memberships: RawMembershipRow[],
  options: {
    preferredCompanyId?: string | null;
    preferredWorkspace?: BusinessWorkspace | null;
    targetWorkspace?: BusinessWorkspace | null;
    targetPathname?: string | null;
  } = {},
): WorkspaceResolutionResult {
  if (!memberships.length) {
    return { ok: false, error: 'no_memberships' };
  }

  const { preferredCompanyId, preferredWorkspace, targetWorkspace, targetPathname } = options;

  // Derive target workspace from pathname when not explicitly supplied
  const resolvedTarget: BusinessWorkspace | null =
    targetWorkspace ??
    (targetPathname ? workspaceForRoute(targetPathname) : null);

  // Only consider memberships whose status is 'active' and whose company is live
  const active = memberships.filter(
    (m) =>
      m.status === 'active' &&
      m.companies !== null &&
      (m.companies.status ?? 'active') !== 'suspended',
  );

  if (!active.length) {
    return { ok: false, error: 'no_active_membership' };
  }

  // Select the chosen membership
  let chosen: RawMembershipRow | undefined;

  if (preferredCompanyId) {
    chosen = active.find((m) => m.company_id === preferredCompanyId);
    if (!chosen) {
      // An explicit preference was given but the company was not found in the
      // user's active memberships — do not silently fall back to another company.
      return { ok: false, error: 'no_active_membership' };
    }
  } else if (active.length === 1) {
    // Safe to auto-select: only one active membership and no preference given
    chosen = active[0];
  } else {
    // Multiple memberships — require an explicit selection to avoid silent
    // cross-company access.
    return { ok: false, error: 'no_active_membership' };
  }

  const company = chosen.companies;
  if (!company) {
    return { ok: false, error: 'company_inactive' };
  }

  // Determine enabled workspaces — fail closed for unknown types
  const enabledWorkspaces = resolveEnabledWorkspacesForCompany(company.company_type);
  if (enabledWorkspaces.length === 0) {
    return { ok: false, error: 'workspace_not_enabled' };
  }

  // Select the active workspace
  let activeWorkspace: BusinessWorkspace | undefined;

  if (resolvedTarget !== null) {
    // Route-guard path: requested workspace must be in the enabled set
    if (!enabledWorkspaces.includes(resolvedTarget)) {
      return { ok: false, error: 'workspace_mismatch' };
    }
    activeWorkspace = resolvedTarget;
  } else if (preferredWorkspace !== null && preferredWorkspace !== undefined) {
    // User has a stored workspace preference
    if (!enabledWorkspaces.includes(preferredWorkspace)) {
      return { ok: false, error: 'workspace_mismatch' };
    }
    activeWorkspace = preferredWorkspace;
  } else if (enabledWorkspaces.length === 1) {
    // Safe to auto-select: company only supports one workspace
    activeWorkspace = enabledWorkspaces[0];
  } else {
    // Multiple enabled workspaces, no selection made — require explicit choice
    return { ok: false, error: 'workspace_not_enabled' };
  }

  return {
    ok: true,
    context: {
      companyId: chosen.company_id,
      companyName: company.name,
      membershipRole: resolveMembershipRole(chosen.role_in_company),
      enabledWorkspaces,
      activeWorkspace,
      isActive: true,
    },
  };
}

/**
 * Maps a public.companies.company_type string to the set of enabled
 * BusinessWorkspaces for that company.
 *
 * Fail-closed: null, empty and unrecognised values return an empty array.
 * Only explicitly recognised legacy values produce a non-empty result.
 *
 * NOTE: company_type is a free-text column (not an ENUM) in the current schema
 * (006_complete_schema.sql).  A future migration could constrain it to an ENUM
 * and expand the multi-workspace set per company as capabilities are added.
 */
export function resolveEnabledWorkspacesForCompany(
  companyType: string | null | undefined,
): readonly BusinessWorkspace[] {
  const t = (companyType ?? '').toLowerCase().trim();

  if (t === 'customer' || t === 'shipper') return ['shipper'];
  if (t === 'broker') return ['broker'];
  // Only explicitly recognised legacy carrier/fleet values map to carrier_fleet
  if (t === 'standard' || t === 'carrier' || t === 'fleet') return ['carrier_fleet'];

  // null, empty, 'unknown', or any other value → no workspaces (fail closed)
  return [];
}
