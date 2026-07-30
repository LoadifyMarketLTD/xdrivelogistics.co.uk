import { describe, expect, it } from 'vitest';

import {
  findScopedDriverEvidence,
  hasScopedDriverBootstrapEvidence,
  resolveSafeBootstrapProfileRole,
} from '../lib/bootstrapProfileRole';

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

  it('permits scoped driver evidence only when company and user match', () => {
    expect(
      hasScopedDriverBootstrapEvidence({
        drivers: [
          { user_id: 'user-1', company_id: 'company-a' },
        ],
        sessionUserId: 'user-1',
        selectedCompanyId: 'company-a',
        activeMembershipCompanyIds: ['company-a'],
      }),
    ).toBe(true);
  });

  it('rejects driver evidence from another company', () => {
    expect(
      hasScopedDriverBootstrapEvidence({
        drivers: [
          { user_id: 'user-1', company_id: 'company-a' },
        ],
        sessionUserId: 'user-1',
        selectedCompanyId: 'company-b',
        activeMembershipCompanyIds: ['company-b'],
      }),
    ).toBe(false);
  });

  it('does not use arbitrary first driver row when selecting scoped evidence', () => {
    const scoped = findScopedDriverEvidence({
      drivers: [
        { user_id: 'user-1', company_id: 'company-a' },
        { user_id: 'user-1', company_id: 'company-b' },
      ],
      sessionUserId: 'user-1',
      selectedCompanyId: 'company-b',
    });

    expect(scoped?.company_id).toBe('company-b');
  });

  it('does not treat missing company context as scoped evidence', () => {
    expect(
      hasScopedDriverBootstrapEvidence({
        drivers: [
          { user_id: 'user-1', company_id: 'company-a' },
        ],
        sessionUserId: 'user-1',
        selectedCompanyId: null,
        activeMembershipCompanyIds: ['company-a'],
      }),
    ).toBe(false);
  });
});
