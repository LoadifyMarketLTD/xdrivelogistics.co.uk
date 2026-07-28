/**
 * Active-company context contract.
 */

import type { BusinessWorkspace } from './businessWorkspace';
import type { MembershipRole } from './membershipRole';
import { workspaceForRoute } from './businessWorkspace';
import { resolveMembershipRole } from './membershipRole';

const LEGACY_CARRIER_FLEET_COMPANY_TYPES = new Set(['standard', 'carrier', 'fleet']);

const ALL_WORKSPACES: readonly BusinessWorkspace[] = [
  'owner_operator',
  'shipper',
  'broker',
  'carrier_fleet',
];

const ACTIVE_COMPANY_STATUS = 'active';

export type ActiveCompanyContext = {
  membershipId: string;
  membershipStatus: string;
  companyId: string;
  companyName: string;
  membershipRole: MembershipRole;
  enabledWorkspaces: readonly BusinessWorkspace[];
  activeWorkspace: BusinessWorkspace;
  /** Backward-compatible alias for activeWorkspace. */
  workspace: BusinessWorkspace;
  isActive: boolean;
};

export type RawMembershipRow = {
  id: string;
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

export type WorkspaceResolutionError =
  | 'no_memberships'
  | 'no_active_membership'
  | 'active_company_required'
  | 'active_workspace_required'
  | 'unsupported_membership_role'
  | 'unsupported_company_type'
  | 'workspace_not_enabled'
  | 'company_inactive'
  | 'workspace_mismatch';

export type WorkspaceResolutionResult =
  | { ok: true; context: ActiveCompanyContext }
  | { ok: false; error: WorkspaceResolutionError };

export type CompanyWorkspaceResolutionResult =
  | { ok: true; enabledWorkspaces: readonly BusinessWorkspace[] }
  | { ok: false; error: 'unsupported_company_type' | 'workspace_not_enabled' };

const normalizeWorkspace = (value: string | null | undefined): BusinessWorkspace | null => {
  const normalized = (value ?? '').trim().toLowerCase();
  return (ALL_WORKSPACES as readonly string[]).includes(normalized)
    ? (normalized as BusinessWorkspace)
    : null;
};

const deriveLegacyWorkspace = (
  companyType: string | null | undefined,
): BusinessWorkspace | null => {
  const normalized = (companyType ?? '').trim().toLowerCase();
  if (normalized === 'customer' || normalized === 'shipper') return 'shipper';
  if (normalized === 'broker') return 'broker';
  if (normalized === 'owner_driver') return 'owner_operator';
  if (LEGACY_CARRIER_FLEET_COMPANY_TYPES.has(normalized)) return 'carrier_fleet';
  return null;
};

export function resolveCompanyEnabledWorkspaces(input: {
  companyType: string | null | undefined;
  enabledWorkspaces?: readonly string[] | null;
}): CompanyWorkspaceResolutionResult {
  const fromRecord = (input.enabledWorkspaces ?? [])
    .map((value) => normalizeWorkspace(value))
    .filter((value): value is BusinessWorkspace => value !== null);

  if (fromRecord.length > 0) {
    return { ok: true, enabledWorkspaces: [...new Set(fromRecord)] };
  }

  if (input.enabledWorkspaces && input.enabledWorkspaces.length === 0) {
    return { ok: false, error: 'workspace_not_enabled' };
  }

  const legacy = deriveLegacyWorkspace(input.companyType);
  if (!legacy) {
    return { ok: false, error: 'unsupported_company_type' };
  }

  return { ok: true, enabledWorkspaces: [legacy] };
}

export function resolveWorkspaceForCompany(
  companyType: string | null | undefined,
): BusinessWorkspace | null {
  return deriveLegacyWorkspace(companyType);
}

export function resolveActiveCompanyContext(
  memberships: RawMembershipRow[],
  options: {
    preferredCompanyId?: string | null;
    activeWorkspace?: BusinessWorkspace | null;
    targetWorkspace?: BusinessWorkspace | null;
    targetPathname?: string | null;
    /** Domain-supplied enabled workspace set (not a DB column). Overrides company_type derivation. */
    enabledWorkspaces?: readonly BusinessWorkspace[] | null;
  } = {},
): WorkspaceResolutionResult {
  if (!memberships.length) {
    return { ok: false, error: 'no_memberships' };
  }

  const { preferredCompanyId, activeWorkspace, targetWorkspace, targetPathname, enabledWorkspaces: explicitEnabledWorkspaces } = options;
  const routeWorkspace = targetPathname ? workspaceForRoute(targetPathname) : null;
  const isDriverSurfaceRoute =
    (targetPathname?.split('?')[0]?.split('#')[0] ?? '') === '/driver' ||
    (targetPathname?.split('?')[0]?.split('#')[0] ?? '').startsWith('/driver/');
  const explicitlyRequestedWorkspace = activeWorkspace ?? targetWorkspace ?? routeWorkspace;

  const active = memberships.filter(
    (m) => {
      const companyStatus = (m.companies?.status ?? ACTIVE_COMPANY_STATUS)
        .trim()
        .toLowerCase();

      return (
        m.status === 'active' &&
        m.companies !== null &&
        companyStatus === ACTIVE_COMPANY_STATUS
      );
    },
  );

  if (!active.length) {
    return { ok: false, error: 'no_active_membership' };
  }

  let chosen: RawMembershipRow | undefined;

  if (preferredCompanyId) {
    chosen = active.find((m) => m.company_id === preferredCompanyId);
    if (!chosen) {
      return { ok: false, error: 'no_active_membership' };
    }
  } else if (active.length === 1) {
    chosen = active[0];
  } else {
    // Multiple active memberships — caller must supply preferredCompanyId.
    return { ok: false, error: 'active_company_required' };
  }

  const company = chosen.companies;
  if (!company) {
    return { ok: false, error: 'company_inactive' };
  }

  const membershipRole = resolveMembershipRole(chosen.role_in_company);
  if (!membershipRole) {
    return { ok: false, error: 'unsupported_membership_role' };
  }

  const enabled = resolveCompanyEnabledWorkspaces({
    companyType: company.company_type ?? null,
    enabledWorkspaces: explicitEnabledWorkspaces ?? null,
  });

  if (!enabled.ok) {
    return { ok: false, error: enabled.error };
  }

  if (explicitlyRequestedWorkspace && !enabled.enabledWorkspaces.includes(explicitlyRequestedWorkspace)) {
    return { ok: false, error: 'workspace_not_enabled' };
  }

  const resolvedActiveWorkspace =
    explicitlyRequestedWorkspace ??
    (enabled.enabledWorkspaces.length === 1 ? enabled.enabledWorkspaces[0] : null);

  if (!resolvedActiveWorkspace) {
    return { ok: false, error: 'active_workspace_required' };
  }

  if (
    routeWorkspace &&
    routeWorkspace !== resolvedActiveWorkspace &&
    !(isDriverSurfaceRoute && resolvedActiveWorkspace === 'carrier_fleet')
  ) {
    return { ok: false, error: 'workspace_mismatch' };
  }

  return {
    ok: true,
    context: {
      membershipId: chosen.id,
      membershipStatus: chosen.status ?? '',
      companyId: chosen.company_id,
      companyName: company.name,
      membershipRole,
      enabledWorkspaces: enabled.enabledWorkspaces,
      activeWorkspace: resolvedActiveWorkspace,
      workspace: resolvedActiveWorkspace,
      isActive: true,
    },
  };
}
