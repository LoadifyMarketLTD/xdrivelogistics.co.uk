import { resolveAuthoritativeRole, type AppUserRole } from '@/lib/authRole';

export type AuthMembershipLike = {
  id?: string | null;
  company_id?: string | null;
  role_in_company?: string | null;
  created_at?: string | null;
};

type ResolveAuthContextInput = {
  creatorCompanyId?: string | null;
  creatorCompanyType?: string | null;
  driverCompanyId?: string | null;
  fallbackRole?: string | null;
  isDriver: boolean;
  membershipCompanyId?: string | null;
  membershipRole?: string | null;
  mustChangePassword?: boolean;
  ownerDriverWorkspaceRequested?: boolean;
  profileCompanyId?: string | null;
  profileRole?: string | null;
};

type ResolveAuthContextResult = {
  companyId: string | null;
  mustChangePassword: boolean;
  profileRole: string | null;
  role: AppUserRole | null;
};

export const normalizeCompanyId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const membershipTimestamp = (membership: AuthMembershipLike): number => {
  if (typeof membership.created_at !== 'string') return Number.NEGATIVE_INFINITY;
  const value = Date.parse(membership.created_at);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};

const membershipStableKey = (membership: AuthMembershipLike): string =>
  String(membership.id ?? membership.company_id ?? '').trim();

/**
 * Select the active membership used for auth and route resolution.
 * A profile company is the explicit active-company hint. Otherwise selection
 * is deterministic: newest created_at first, then stable id/company key.
 */
export const selectDeterministicMembership = <T extends AuthMembershipLike>(
  memberships: readonly T[] | null | undefined,
  profileCompanyId?: string | null
): T | null => {
  if (!memberships?.length) return null;

  const ordered = [...memberships].sort((left, right) => {
    const timestampDifference = membershipTimestamp(right) - membershipTimestamp(left);
    if (timestampDifference !== 0) return timestampDifference;
    return membershipStableKey(left).localeCompare(membershipStableKey(right));
  });

  const preferredCompanyId = normalizeCompanyId(profileCompanyId);
  if (preferredCompanyId) {
    const preferred = ordered.find(
      (membership) => normalizeCompanyId(membership.company_id) === preferredCompanyId
    );
    if (preferred) return preferred;
  }

  return ordered[0] ?? null;
};

export const resolveAuthContext = ({
  creatorCompanyId,
  creatorCompanyType,
  driverCompanyId,
  fallbackRole,
  isDriver,
  membershipCompanyId,
  membershipRole,
  mustChangePassword = false,
  ownerDriverWorkspaceRequested = false,
  profileCompanyId,
  profileRole,
}: ResolveAuthContextInput): ResolveAuthContextResult => {
  const resolvedRole = resolveAuthoritativeRole({
    membershipRole,
    profileRole,
    isDriver,
    hasCreatedCompany: Boolean(normalizeCompanyId(creatorCompanyId)),
    creatorCompanyType,
    fallbackRole,
    ownerDriverWorkspaceRequested,
  });

  const companyId =
    normalizeCompanyId(membershipCompanyId) ??
    normalizeCompanyId(profileCompanyId) ??
    normalizeCompanyId(driverCompanyId) ??
    normalizeCompanyId(creatorCompanyId) ??
    null;

  if (!resolvedRole) {
    return {
      role: null,
      companyId,
      mustChangePassword: false,
      profileRole: typeof profileRole === 'string' ? profileRole : null,
    };
  }

  const ownerDriverBusinessRole =
    ownerDriverWorkspaceRequested &&
    isDriver &&
    Boolean(companyId) &&
    resolvedRole === 'driver';
  const finalRole: AppUserRole = ownerDriverBusinessRole ? 'company_staff' : resolvedRole;

  return {
    role: finalRole,
    companyId,
    mustChangePassword: finalRole === 'driver' ? mustChangePassword : false,
    profileRole: typeof profileRole === 'string' ? profileRole : null,
  };
};
