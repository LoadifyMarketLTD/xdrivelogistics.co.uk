export type AppUserRole = 'customer' | 'driver' | 'company' | 'admin' | 'owner';

export const mapAppRole = (value: string | null | undefined): AppUserRole | null => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'company' || normalized === 'dispatcher') return 'company';
  if (normalized === 'driver') return 'driver';
  if (normalized === 'customer' || normalized === 'client' || normalized === 'viewer') return 'customer';
  return null;
};

export const shouldAutoProvisionCompany = ({
  fallbackRole,
  profileRole,
}: {
  fallbackRole?: string | null;
  profileRole?: string | null;
}) => {
  const candidateRoles = [mapAppRole(fallbackRole), mapAppRole(profileRole)];
  return candidateRoles.some((role) => role === 'company' || role === 'admin' || role === 'owner');
};

export const roleRequiresCompanyContext = (role: AppUserRole | null) =>
  role === 'company' || role === 'admin' || role === 'owner' || role === 'driver';
