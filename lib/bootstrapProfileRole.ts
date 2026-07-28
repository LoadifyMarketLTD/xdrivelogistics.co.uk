import { mapAppRole } from './authRole';

export type BootstrapProfileRole =
  | 'guest'
  | 'owner'
  | 'broker'
  | 'company_admin'
  | 'company_staff'
  | 'driver'
  | 'customer';

export type DriverBootstrapEvidenceRow = {
  id?: string | null;
  user_id: string | null;
  company_id: string | null;
  must_change_password?: boolean | null;
  status?: string | null;
  app_access?: boolean | null;
  driver_type?: string | null;
  can_commercial_bid?: boolean | null;
};

export const findScopedDriverEvidence = (input: {
  drivers: readonly DriverBootstrapEvidenceRow[];
  sessionUserId: string;
  selectedCompanyId: string | null;
}): DriverBootstrapEvidenceRow | null => {
  if (!input.selectedCompanyId) return null;
  return (
    input.drivers.find(
      (driver) =>
        driver.user_id === input.sessionUserId &&
        driver.company_id === input.selectedCompanyId,
    ) ?? null
  );
};

export const hasScopedDriverBootstrapEvidence = (input: {
  drivers: readonly DriverBootstrapEvidenceRow[];
  sessionUserId: string;
  selectedCompanyId: string | null;
  activeMembershipCompanyIds?: readonly string[] | null;
}): boolean => {
  if (!input.selectedCompanyId) return false;

  const activeMembershipCompanyIds = input.activeMembershipCompanyIds ?? [];
  if (
    activeMembershipCompanyIds.length > 0 &&
    !activeMembershipCompanyIds.includes(input.selectedCompanyId)
  ) {
    return false;
  }

  return Boolean(
    findScopedDriverEvidence({
      drivers: input.drivers,
      sessionUserId: input.sessionUserId,
      selectedCompanyId: input.selectedCompanyId,
    }),
  );
};

export const resolveSafeBootstrapProfileRole = (input: {
  membershipRole?: string | null;
  hasScopedDriver: boolean;
  fallbackRole?: string | null;
}): BootstrapProfileRole => {
  if (input.hasScopedDriver) return 'driver';

  const membershipRole = (input.membershipRole ?? '').trim().toLowerCase();
  if (membershipRole === 'owner' || membershipRole === 'admin') return 'company_admin';
  if (
    membershipRole === 'dispatcher' ||
    membershipRole === 'member' ||
    membershipRole === 'finance' ||
    membershipRole === 'compliance'
  ) {
    return 'company_staff';
  }

  const fallback = mapAppRole(input.fallbackRole ?? null);
  if (fallback === 'broker') return 'broker';
  if (fallback === 'customer') return 'customer';

  return 'customer';
};