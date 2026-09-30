import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement, isCapabilityAllowedForPath } from '../lib/roleCapabilities';

describe('workspace recovery route guards', () => {
  it.each([
    ['/admin', 'company_owner'], ['/broker', 'broker'], ['/customer', 'customer'],
  ] as const)('keeps %s support and billing reachable by its owner', (root, role) => {
    expect(getProtectedRouteRequirement(`${root}/support`)?.prefix).toBe(`${root}/support`);
    expect(getProtectedRouteRequirement(`${root}/settings/billing`)?.anyOf).toEqual(['billing.manage']);
    expect(isCapabilityAllowedForPath(`${root}/support`, 'company_admin', { workspaceRole: role })).toBe(true);
    expect(isCapabilityAllowedForPath(`${root}/settings/billing`, 'company_admin', { workspaceRole: role, membershipRole: 'owner' })).toBe(true);
  });
  const driver = { workspaceRole: 'driver' as const, driverId: 'fixture-driver', accountStatus: 'active', companyStatus: 'active', driverStatus: 'active', appAccess: true, membershipRole: 'driver' as const };
  it('allows employed-driver personal settings and support but not membership billing', () => {
    expect(isCapabilityAllowedForPath('/driver/settings', 'driver', driver)).toBe(true);
    expect(isCapabilityAllowedForPath('/driver/support', 'driver', driver)).toBe(true);
    expect(isCapabilityAllowedForPath('/driver/settings/billing', 'driver', driver)).toBe(false);
  });
  it('allows owner-driver billing without changing workspace', () => {
    expect(isCapabilityAllowedForPath('/driver/settings/billing', 'driver', { ...driver, workspaceRole: 'owner_driver', membershipRole: 'owner' })).toBe(true);
  });
  it('does not give operational staff billing powers', () => {
    expect(isCapabilityAllowedForPath('/admin/support', 'company_staff', { workspaceRole: 'dispatcher' })).toBe(true);
    expect(isCapabilityAllowedForPath('/admin/settings/billing', 'company_staff', { workspaceRole: 'dispatcher' })).toBe(false);
  });
});
