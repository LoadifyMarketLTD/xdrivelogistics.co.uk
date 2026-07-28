import { mapAppRole } from './authRole';

export type BootstrapProfileRole =
  | 'guest'
  | 'owner'
  | 'broker'
  | 'company_admin'
  | 'company_staff'
  | 'driver'
  | 'customer';

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