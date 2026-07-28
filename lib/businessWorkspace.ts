import type { AppUserRole } from './authRole';
import type { CompanyRole } from './types/database';

export type BusinessWorkspace =
  | 'owner_operator'
  | 'shipper'
  | 'broker'
  | 'carrier_fleet';

export type MembershipRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'driver'
  | 'member'
  | 'viewer';

type WorkspaceAccessContext = {
  role?: AppUserRole | string | null;
  rawRole?: string | null;
  membershipRole?: CompanyRole | string | null;
  membershipRoles?: Array<CompanyRole | string | null> | null;
  ownerDriverWorkspace?: boolean | null;
  canAccessDriverMode?: boolean | null;
};

const normalize = (value: string | null | undefined) =>
  (value ?? '').toLowerCase().trim().replace(/[-\s]+/g, '_');

export const BUSINESS_WORKSPACE_HOME: Record<BusinessWorkspace, string> = {
  owner_operator: '/driver',
  shipper: '/customer',
  broker: '/broker',
  carrier_fleet: '/admin',
};

export const BUSINESS_WORKSPACE_LABEL: Record<BusinessWorkspace, string> = {
  owner_operator: 'Owner Operator',
  shipper: 'Customer / Shipper',
  broker: 'Transport / Broker',
  carrier_fleet: 'Fleet Operator',
};

export const resolveBusinessWorkspaces = ({
  role,
  rawRole,
  membershipRole,
  membershipRoles,
  ownerDriverWorkspace,
  canAccessDriverMode,
}: WorkspaceAccessContext): BusinessWorkspace[] => {
  const workspaces = new Set<BusinessWorkspace>();
  const normalizedRole = normalize(typeof role === 'string' ? role : null);
  const normalizedRawRole = normalize(rawRole);
  const normalizedMembershipRoles = [
    normalize(typeof membershipRole === 'string' ? membershipRole : null),
    ...(membershipRoles ?? []).map((entry) => normalize(typeof entry === 'string' ? entry : null)),
  ];

  if (
    normalizedRole === 'driver' ||
    normalizedRawRole === 'owner_operator' ||
    normalizedRawRole === 'owner_driver' ||
    ownerDriverWorkspace === true ||
    canAccessDriverMode === true
  ) {
    workspaces.add('owner_operator');
  }

  if (normalizedRole === 'customer' || normalizedRawRole === 'customer' || normalizedRawRole === 'shipper') {
    workspaces.add('shipper');
  }

  if (normalizedRole === 'broker' || normalizedRawRole.includes('broker')) {
    workspaces.add('broker');
  }

  if (
    normalizedRole === 'owner' ||
    normalizedRole === 'company_admin' ||
    normalizedRole === 'company_staff' ||
    normalizedMembershipRoles.some((entry) =>
      ['owner', 'admin', 'dispatcher', 'finance', 'compliance', 'driver', 'member', 'viewer'].includes(entry)
    )
  ) {
    workspaces.add('carrier_fleet');
  }

  if (workspaces.size === 0) {
    workspaces.add('carrier_fleet');
  }

  return Array.from(workspaces);
};

