import { describe, expect, it } from 'vitest';

import { resolveSafeBootstrapProfileRole } from '../lib/bootstrapProfileRole';

describe('resolveSafeBootstrapProfileRole', () => {
  it('does not allow user-metadata-only privileged fallback roles', () => {
    expect(resolveSafeBootstrapProfileRole({
      membershipRole: null,
      hasScopedDriver: false,
      fallbackRole: 'owner',
    })).toBe('customer');

    expect(resolveSafeBootstrapProfileRole({
      membershipRole: null,
      hasScopedDriver: false,
      fallbackRole: 'company_admin',
    })).toBe('customer');

    expect(resolveSafeBootstrapProfileRole({
      membershipRole: null,
      hasScopedDriver: false,
      fallbackRole: 'driver',
    })).toBe('customer');
  });

  it('allows bootstrap to driver only when scoped driver evidence exists', () => {
    expect(resolveSafeBootstrapProfileRole({
      membershipRole: null,
      hasScopedDriver: true,
      fallbackRole: 'customer',
    })).toBe('driver');
  });

  it('derives company roles from membership evidence', () => {
    expect(resolveSafeBootstrapProfileRole({
      membershipRole: 'owner',
      hasScopedDriver: false,
      fallbackRole: null,
    })).toBe('company_admin');

    expect(resolveSafeBootstrapProfileRole({
      membershipRole: 'dispatcher',
      hasScopedDriver: false,
      fallbackRole: null,
    })).toBe('company_staff');
  });
});
