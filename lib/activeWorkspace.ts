/**
 * Active-company context contract.
 *
 * Resolves which company and workspace are currently active from raw
 * public.company_memberships rows (joined with public.companies).
 *
 * This module is pure (no Supabase imports, no side effects) so it can be
 * fully unit-tested without mocking.  Actual data fetching happens in
 * lib/activeCompany.ts (resolveActiveCompanyId) and in individual page hooks.
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
  /** The resolved workspace for this company. */
  workspace: BusinessWorkspace;
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
  | 'no_memberships'        // user has no membership rows at all
  | 'no_active_membership'  // none are active (or multiple with no preference given)
  | 'company_inactive'      // company.status is not 'active'
  | 'workspace_mismatch';   // company workspace differs from the requested route

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
 *  4. If a `targetWorkspace` or `targetPathname` is given, verify the resolved
 *     company's workspace matches.
 *
 * This function never falls back to a random first membership when the user
 * belongs to multiple companies, preventing inadvertent cross-company access.
 */
export function resolveActiveCompanyContext(
  memberships: RawMembershipRow[],
  options: {
    preferredCompanyId?: string | null;
    targetWorkspace?: BusinessWorkspace | null;
    targetPathname?: string | null;
  } = {},
): WorkspaceResolutionResult {
  if (!memberships.length) {
    return { ok: false, error: 'no_memberships' };
  }

  const { preferredCompanyId, targetWorkspace, targetPathname } = options;

  // Derive workspace from pathname when not explicitly supplied
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
  }

  if (!chosen) {
    if (preferredCompanyId) {
      // An explicit preference was given but the company was not found in the
      // user's active memberships — do not silently fall back to another company.
      return { ok: false, error: 'no_active_membership' };
    }
    if (active.length === 1) {
      // Safe to auto-select: only one active membership and no preference given
      chosen = active[0];
    } else {
      // Multiple memberships — require an explicit selection to avoid silent
      // cross-company access.
      return { ok: false, error: 'no_active_membership' };
    }
  }

  const company = chosen.companies;
  if (!company) {
    return { ok: false, error: 'company_inactive' };
  }

  const workspace = resolveWorkspaceForCompany(company.company_type ?? null);

  // Guard against workspace mismatch (e.g. a shipper trying to access /admin)
  if (resolvedTarget !== null && workspace !== resolvedTarget) {
    return { ok: false, error: 'workspace_mismatch' };
  }

  return {
    ok: true,
    context: {
      companyId: chosen.company_id,
      companyName: company.name,
      membershipRole: resolveMembershipRole(chosen.role_in_company),
      workspace,
      isActive: true,
    },
  };
}

/**
 * Maps public.companies.company_type to a BusinessWorkspace.
 *
 * Gap: company_type is a free-text column (not an ENUM) in the current schema
 * (006_complete_schema.sql).  This function normalises known values and
 * defaults to 'carrier_fleet' for 'standard' and unknown types.
 * A future migration could constrain company_type to a proper ENUM.
 */
export function resolveWorkspaceForCompany(
  companyType: string | null | undefined,
): BusinessWorkspace {
  const t = (companyType ?? '').toLowerCase().trim();
  if (t === 'customer' || t === 'shipper') return 'shipper';
  if (t === 'broker') return 'broker';
  // 'standard', 'carrier', 'fleet', '' → carrier_fleet
  return 'carrier_fleet';
}
