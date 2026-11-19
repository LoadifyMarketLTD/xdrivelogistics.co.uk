/**
 * Resolve the driver's UI role from the authenticated backend profile.
 * Unknown/missing types fail closed; Finance endpoints still enforce company
 * membership, current job ownership and invoice eligibility independently.
 */
export type DriverUiRole = 'Owner Driver' | 'Company Driver';

export function driverRoleFromProfile(value: unknown): DriverUiRole | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const profile = value as Record<string, unknown>;
  const driver = profile.driver;
  if (driver === null || typeof driver !== 'object' || Array.isArray(driver)) return null;
  const kind = (driver as Record<string, unknown>).driver_type;
  if (kind === 'owner_driver') return 'Owner Driver';
  if (kind === 'company_driver') return 'Company Driver';
  return null;
}
