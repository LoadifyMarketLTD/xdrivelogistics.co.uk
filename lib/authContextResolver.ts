import { resolveAuthoritativeRole, type AppUserRole } from '@/lib/authRole';

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

const normalizeId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
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
    hasCreatedCompany: Boolean(normalizeId(creatorCompanyId)),
    creatorCompanyType,
    fallbackRole,
    ownerDriverWorkspaceRequested,
  });

  const companyId =
    normalizeId(membershipCompanyId) ??
    normalizeId(profileCompanyId) ??
    normalizeId(driverCompanyId) ??
    normalizeId(creatorCompanyId) ??
    null;

  if (!resolvedRole) {
    return {
      role: null,
      companyId,
      mustChangePassword: false,
      profileRole: typeof profileRole === 'string' ? profileRole : null,
    };
  }

  // A company record provides tenancy for an Owner Driver, but it does not turn
  // that user into company staff. The role remains driver; workspace selection
  // separately distinguishes Owner Driver from an invited Fleet Driver.
  return {
    role: resolvedRole,
    companyId,
    mustChangePassword: resolvedRole === 'driver' ? mustChangePassword : false,
    profileRole: typeof profileRole === 'string' ? profileRole : null,
  };
};
