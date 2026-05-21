export type AppUserRole = 'customer' | 'driver' | 'company' | 'admin' | 'owner';

/**
 * Maps any profile.role value (canonical or legacy) to an AppUserRole.
 *
 * Canonical values (stored after migration 031):
 *   owner | admin | company | driver | customer
 *
 * Legacy / alias values accepted as belt-and-suspenders (e.g. environments
 * where migration 031 has not yet run, or rows touched before the migration):
 *
 *   owner    ← superadmin, super_admin, platform_owner
 *   admin    ← company_admin, org_admin, platform_admin
 *   company  ← broker, freight_broker, carrier, dispatcher, company_staff
 *              NOTE — broker maps to company because on a Courier Exchange
 *              platform a freight broker is a company-level operator who posts
 *              loads, manages carrier assignments and invoicing.  This is
 *              identical to the company/dispatcher access model.
 *   driver   ← owner_driver
 *   customer ← shipper, client, viewer
 *
 * Returns null only when the value is empty/null or genuinely unrecognised
 * (triggers 'role_unsupported' error in authSession.ts).
 */
export const mapAppRole = (value: string | null | undefined): AppUserRole | null => {
  const normalized = (value ?? '').toLowerCase().trim();

  // ── Canonical values ──────────────────────────────────────────────────────
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'company') return 'company';
  if (normalized === 'driver') return 'driver';
  if (normalized === 'customer') return 'customer';

  // ── Owner aliases ─────────────────────────────────────────────────────────
  if (normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'platform_owner') return 'owner';

  // ── Admin aliases (incl. company_admin, admin_staff) ─────────────────────
  if (
    normalized === 'admin_staff' ||
    normalized === 'company_admin' ||
    normalized === 'org_admin' ||
    normalized === 'platform_admin'
  ) return 'admin';

  // ── Company/dispatcher aliases (incl. broker) ─────────────────────────────
  if (
    normalized === 'broker' ||
    normalized === 'freight_broker' ||
    normalized === 'carrier' ||
    normalized === 'dispatcher' ||
    normalized === 'company_staff'
  ) return 'company';

  // ── Driver aliases ────────────────────────────────────────────────────────
  if (normalized === 'owner_driver') return 'driver';

  // ── Customer aliases ──────────────────────────────────────────────────────
  if (normalized === 'shipper' || normalized === 'client' || normalized === 'viewer') return 'customer';

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
