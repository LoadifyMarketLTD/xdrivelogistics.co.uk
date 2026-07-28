import {
  resolveCompanyEnabledWorkspaces,
  type RawMembershipRow,
} from './activeWorkspace';
import {
  WORKSPACE_LANDING_ROUTE,
  type BusinessWorkspace,
} from './businessWorkspace';
import {
  findScopedDriverEvidence,
  type DriverBootstrapEvidenceRow,
} from './bootstrapProfileRole';
import {
  resolveMembershipRole,
  type MembershipRole,
} from './membershipRole';

export const BUSINESS_WORKSPACE_VALUES: readonly BusinessWorkspace[] = [
  'owner_operator',
  'shipper',
  'broker',
  'carrier_fleet',
];

export type SharedUiMembershipOption = {
  membershipId: string;
  membershipRole: MembershipRole;
  companyId: string;
  companyName: string;
  companyType: string | null;
  companyStatus: string;
  enabledWorkspaces: readonly BusinessWorkspace[];
};

export type SharedUiResolvedContext = {
  membershipId: string;
  membershipRole: MembershipRole;
  companyId: string;
  companyName: string;
  companyType: string | null;
  companyStatus: string;
  enabledWorkspaces: readonly BusinessWorkspace[];
  activeWorkspace: BusinessWorkspace;
  landingRoute: string;
  driverId: string | null;
  canAccessDriverMode: boolean;
};

export type SharedUiContextSnapshot = {
  memberships: readonly SharedUiMembershipOption[];
  current: SharedUiResolvedContext | null;
  companySelectionRequired: boolean;
  workspaceSelectionRequired: boolean;
};

export type SharedUiContextError =
  | 'no_active_membership'
  | 'company_not_available'
  | 'workspace_not_enabled'
  | 'driver_context_required';

export type SharedUiContextResolution =
  | { ok: true; snapshot: SharedUiContextSnapshot }
  | { ok: false; error: SharedUiContextError };

export const parseBusinessWorkspace = (
  value: unknown,
): BusinessWorkspace | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return (BUSINESS_WORKSPACE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as BusinessWorkspace)
    : null;
};

const isActive = (value: string | null | undefined): boolean =>
  (value ?? '').trim().toLowerCase() === 'active';

export const buildSharedUiMembershipOptions = (
  memberships: readonly RawMembershipRow[],
): SharedUiMembershipOption[] => {
  const options: SharedUiMembershipOption[] = [];

  for (const membership of memberships) {
    const company = membership.companies;
    const membershipRole = resolveMembershipRole(membership.role_in_company);

    if (
      !company ||
      !isActive(membership.status) ||
      !isActive(company.status ?? 'active') ||
      !membershipRole
    ) {
      continue;
    }

    const enabled = resolveCompanyEnabledWorkspaces({
      companyType: company.company_type ?? null,
    });
    if (!enabled.ok) continue;

    options.push({
      membershipId: membership.id,
      membershipRole,
      companyId: membership.company_id,
      companyName: company.name,
      companyType: company.company_type ?? null,
      companyStatus: (company.status ?? 'active').trim().toLowerCase(),
      enabledWorkspaces: enabled.enabledWorkspaces,
    });
  }

  return options;
};

export const resolveSharedUiContext = (input: {
  memberships: readonly RawMembershipRow[];
  profileCompanyId?: string | null;
  requestedCompanyId?: string | null;
  requestedWorkspace?: BusinessWorkspace | null;
  drivers?: readonly DriverBootstrapEvidenceRow[];
  userId: string;
}): SharedUiContextResolution => {
  const memberships = buildSharedUiMembershipOptions(input.memberships);
  if (memberships.length === 0) {
    return { ok: false, error: 'no_active_membership' };
  }

  const explicitlySelectedCompanyId =
    input.requestedCompanyId?.trim() || input.profileCompanyId?.trim() || null;
  const selectedCompanyId =
    explicitlySelectedCompanyId ?? (memberships.length === 1 ? memberships[0]?.companyId ?? null : null);

  if (!selectedCompanyId) {
    return {
      ok: true,
      snapshot: {
        memberships,
        current: null,
        companySelectionRequired: true,
        workspaceSelectionRequired: false,
      },
    };
  }

  const selected = memberships.find(
    (membership) => membership.companyId === selectedCompanyId,
  );
  if (!selected) {
    return { ok: false, error: 'company_not_available' };
  }

  const activeWorkspace =
    input.requestedWorkspace ??
    (selected.enabledWorkspaces.length === 1
      ? selected.enabledWorkspaces[0] ?? null
      : null);

  if (!activeWorkspace) {
    return {
      ok: true,
      snapshot: {
        memberships,
        current: null,
        companySelectionRequired: false,
        workspaceSelectionRequired: true,
      },
    };
  }

  if (!selected.enabledWorkspaces.includes(activeWorkspace)) {
    return { ok: false, error: 'workspace_not_enabled' };
  }

  const scopedDriver = findScopedDriverEvidence({
    drivers: input.drivers ?? [],
    sessionUserId: input.userId,
    selectedCompanyId,
  });
  const canAccessDriverMode =
    Boolean(scopedDriver?.id) &&
    isActive(scopedDriver?.status) &&
    scopedDriver?.app_access === true;

  if (
    (activeWorkspace === 'owner_operator' || selected.membershipRole === 'driver') &&
    !canAccessDriverMode
  ) {
    return { ok: false, error: 'driver_context_required' };
  }

  const landingRoute =
    canAccessDriverMode &&
    (activeWorkspace === 'owner_operator' || selected.membershipRole === 'driver')
      ? '/driver'
      : WORKSPACE_LANDING_ROUTE[activeWorkspace];

  return {
    ok: true,
    snapshot: {
      memberships,
      current: {
        membershipId: selected.membershipId,
        membershipRole: selected.membershipRole,
        companyId: selected.companyId,
        companyName: selected.companyName,
        companyType: selected.companyType,
        companyStatus: selected.companyStatus,
        enabledWorkspaces: selected.enabledWorkspaces,
        activeWorkspace,
        landingRoute,
        driverId: scopedDriver?.id ?? null,
        canAccessDriverMode,
      },
      companySelectionRequired: false,
      workspaceSelectionRequired: false,
    },
  };
};
