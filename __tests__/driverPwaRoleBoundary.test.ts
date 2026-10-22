import { describe, expect, it } from 'vitest';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const activeDriver = {
  workspaceRole: 'driver' as const,
  driverId: 'test-driver-id',
  appAccess: true,
  accountStatus: 'active',
  companyStatus: 'active',
  driverStatus: 'active',
};

describe('Driver PWA protected-route authorization', () => {
  it('accepts approved company and owner drivers with a bound driver record', () => {
    expect(isCapabilityAllowedForPath('/m/driver/jobs', 'driver', activeDriver)).toBe(true);
    expect(isCapabilityAllowedForPath('/m/driver/quotes', 'company_admin', {
      ...activeDriver, workspaceRole: 'owner_driver'
    })).toBe(true);
  });

  it('denies unapproved, unbound and non-driver sessions', () => {
    expect(isCapabilityAllowedForPath('/m/driver/bookings', 'driver', {
      ...activeDriver, driverId: null,
    })).toBe(false);
    expect(isCapabilityAllowedForPath('/m/driver/bookings', 'driver', {
      ...activeDriver, appAccess: false,
    })).toBe(false);
    expect(isCapabilityAllowedForPath('/m/driver/bookings', 'driver', {
      ...activeDriver, driverStatus: 'pending',
    })).toBe(false);
    expect(isCapabilityAllowedForPath('/m/driver/bookings', 'driver', {
      ...activeDriver, companyStatus: 'suspended',
    })).toBe(false);
    expect(isCapabilityAllowedForPath('/m/driver/bookings', 'broker', {
      ...activeDriver, workspaceRole: 'broker',
    })).toBe(false);
    expect(isCapabilityAllowedForPath('/m/other', 'driver', activeDriver)).toBe(false);
  });
});
