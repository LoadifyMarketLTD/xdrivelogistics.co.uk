import { describe, expect, it } from 'vitest';
import { isRoleAllowedForPath } from '../lib/authRole';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

const customer = { workspaceRole: 'customer' as const, membershipRole: 'owner', accountStatus: 'active', companyStatus: 'active' };
const broker = { workspaceRole: 'broker' as const, membershipRole: 'owner', accountStatus: 'active', companyStatus: 'active' };

const routes = {
  customer: [
    '/customer/fleet', '/customer/drivers', '/customer/directory', '/customer/live-availability',
    '/customer/returns', '/customer/freight-vision', '/customer/reports',
  ],
  broker: [
    '/broker/fleet', '/broker/drivers', '/broker/directory', '/broker/live-availability',
    '/broker/returns', '/broker/freight-vision',
  ],
};

describe('production route access for all authenticated Master data pages', () => {
  it('registers every new Customer/Broker route instead of redirecting to the workspace root', () => {
    for (const path of [...routes.customer, ...routes.broker]) {
      expect(getProtectedRouteRequirement(path), path).not.toBeNull();
    }
  });

  it('permits active Customer membership to access read-only Customer modules', () => {
    for (const path of routes.customer) expect(isRoleAllowedForPath(path, 'customer', customer), path).toBe(true);
  });

  it('permits active Broker membership to access read-only Broker modules', () => {
    for (const path of routes.broker) expect(isRoleAllowedForPath(path, 'broker', broker), path).toBe(true);
  });

  it('never allows Customer and Broker to cross each other\'s workspace', () => {
    for (const path of routes.broker) expect(isRoleAllowedForPath(path, 'customer', customer), path).toBe(false);
    for (const path of routes.customer) expect(isRoleAllowedForPath(path, 'broker', broker), path).toBe(false);
  });

  it('keeps unknown paths and inactive memberships denied', () => {
    expect(isRoleAllowedForPath('/customer/unknown-new-page', 'customer', customer)).toBe(false);
    expect(isRoleAllowedForPath('/broker/unknown-new-page', 'broker', broker)).toBe(false);
    expect(isRoleAllowedForPath('/customer/fleet', 'customer', { ...customer, accountStatus: 'suspended' })).toBe(false);
    expect(isRoleAllowedForPath('/broker/fleet', 'broker', { ...broker, companyStatus: 'inactive' })).toBe(false);
  });

  it('registers reports for the administrative and driver workspaces', () => {
    expect(getProtectedRouteRequirement('/admin/reports')?.workspace).toBe('carrier_fleet');
    expect(getProtectedRouteRequirement('/driver/reports')?.workspace).toBe('owner_operator');
    const driverContext = {
      workspaceRole: 'driver' as const,
      driverId: 'driver-test-id',
      appAccess: true,
      accountStatus: 'active',
      companyStatus: 'active',
      driverStatus: 'active',
    };
    expect(isRoleAllowedForPath('/driver/reports', 'driver', driverContext)).toBe(true);
  });
});
