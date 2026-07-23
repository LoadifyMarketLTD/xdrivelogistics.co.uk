import { resolveAuthoritativeRole, type AppUserRole } from '@/lib/authRole';

export type AuthMembershipLike = {
  company_id?: string | null;
  role_in_company?: string | null;
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

/**
 * Select the active membership used for auth and route resolution.
 * A profile company is the explicit active-company hint. If it does not match,
 * preserve the stable database order supplied by the caller.
 */
export const selectDeterministicMembership = <T extends AuthMembershipLike>(
  memberships: readonly T[] | null | undefined,
  profileCompanyId?: string | null
): T | null => {
  if (!memberships?.length) return null;
  const preferredCompanyId = normalizeCompanyId(profileCompanyId);
  if (preferredCompanyId) {
    const preferred = memberships.find(
      (membership) => normalizeCompanyId(membership.company_id) === preferredCompanyId
    );
    if (preferred) return preferred;
  }
  return memberships[0] ?? null;
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
