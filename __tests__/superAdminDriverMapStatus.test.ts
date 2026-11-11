import { deriveDriverMapStatus } from '../app/api/super-admin/_lib/deriveDriverMapStatus';

describe('Super Admin driver map status: a recent GPS fix is not availability', () => {
  const fresh = { driverStatus: 'active', isActive: true, locationFresh: true };

  it('reports online only for an active, available driver with a fresh location', () => {
    expect(deriveDriverMapStatus({ ...fresh, availabilityStatus: 'available' })).toBe('online');
  });

  it('reports a tracked active driver who is busy as busy, not online', () => {
    expect(deriveDriverMapStatus({ ...fresh, availabilityStatus: 'busy' })).toBe('busy');
  });

  it.each(['offline', 'unavailable', 'paused', '', null])(
    'does not report a GPS-tracked, explicitly non-available driver as online: %s',
    (availabilityStatus) => {
      expect(deriveDriverMapStatus({ ...fresh, availabilityStatus })).toBe('offline');
    },
  );

  it.each(['inactive', 'suspended', 'pending', '', null])(
    'does not report a non-active driver as live: %s',
    (driverStatus) => {
      expect(deriveDriverMapStatus({ ...fresh, driverStatus, availabilityStatus: 'available' })).toBe('offline');
    },
  );

  it('respects the separately revoked is_active flag', () => {
    expect(deriveDriverMapStatus({ ...fresh, isActive: false, availabilityStatus: 'available' })).toBe('offline');
  });

  it('treats an old or missing location as offline even for an available or busy driver', () => {
    expect(deriveDriverMapStatus({ ...fresh, locationFresh: false, availabilityStatus: 'available' })).toBe('offline');
    expect(deriveDriverMapStatus({ ...fresh, locationFresh: false, availabilityStatus: 'busy' })).toBe('offline');
  });
});
