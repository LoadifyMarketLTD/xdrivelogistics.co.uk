import { expect, test } from '@playwright/test';

import { mapAppRole, resolveAuthoritativeRole } from '../lib/authRole';
import { resolvePreferredCompanyId } from '../lib/activeCompany';
import { resolveBusinessWorkspaces } from '../lib/businessWorkspace';
import {
  getCapabilitiesForRole,
  getDriverWorkspaceCapabilities,
  isCapabilityAllowedForPath,
} from '../lib/roleCapabilities';
import { resolveWorkspaceRole } from '../lib/workspaceRole';

test.describe('role alias contract', () => {
  const cases = [
    ['platform_owner', 'owner'],
    ['super_admin', 'owner'],
    ['transport_broker', 'broker'],
    ['fleet_operator', 'company_admin'],
    ['dispatcher', 'company_staff'],
    ['owner_operator', 'driver'],
    ['customer_shipper', 'customer'],
  ] as const;

  for (const [stored, expected] of cases) {
    test(`${stored} maps to ${expected}`, () => {
      expect(mapAppRole(stored)).toBe(expected);
    });
  }

  test('unknown role never falls back to customer', () => {
    expect(mapAppRole('unexpected_role')).toBeNull();
  });
});

test.describe('workspace resolution contract', () => {
  test('platform owner remains platform scoped', () => {
    expect(resolveWorkspaceRole({ role: 'owner' })).toBe('platform_owner');
  });

  test('ordinary driver resolves to driver workspace', () => {
    expect(
      resolveWorkspaceRole({
        role: 'driver',
        rawRole: 'individual_driver',
        ownerDriverWorkspace: false,
      })
    ).toBe('driver');
  });

  test('owner operator with explicit provider workspace resolves to owner-driver', () => {
    expect(
      resolveWorkspaceRole({
        role: 'driver',
        rawRole: 'owner_operator',
        ownerDriverWorkspace: true,
      })
    ).toBe('owner_driver');
  });

  test('customer and broker cannot be promoted by company membership aliases', () => {
    expect(resolveWorkspaceRole({ role: 'customer', membershipRole: 'owner' })).toBe('customer');
    expect(resolveWorkspaceRole({ role: 'broker', membershipRole: 'admin' })).toBe('broker');
  });

  test('business workspace resolution keeps workspace distinct from membership role', () => {
    expect(
      resolveBusinessWorkspaces({
        role: 'company_staff',
        membershipRoles: ['dispatcher', 'finance'],
      })
    ).toContain('carrier_fleet');
    expect(
      resolveBusinessWorkspaces({
        role: 'driver',
        ownerDriverWorkspace: true,
      })
    ).toContain('owner_operator');
  });
});

test.describe('driver capability regression contract', () => {
  test('fleet driver receives execution capabilities but no commercial marketplace capabilities', () => {
    const capabilities = getDriverWorkspaceCapabilities('fleet_driver');

    expect(capabilities.canExecuteJobs).toBe(true);
    expect(capabilities.canUploadPod).toBe(true);
    expect(capabilities.canViewExchangeLoads).toBe(false);
    expect(capabilities.canQuoteLoads).toBe(false);
    expect(capabilities.canViewInvoices).toBe(false);
    expect(capabilities.canUseReturnJourneys).toBe(false);
  });

  test('provider driver receives owner-driver commercial capabilities', () => {
    const capabilities = getDriverWorkspaceCapabilities('provider_driver');

    expect(capabilities.canExecuteJobs).toBe(true);
    expect(capabilities.canViewExchangeLoads).toBe(true);
    expect(capabilities.canQuoteLoads).toBe(true);
    expect(capabilities.canViewInvoices).toBe(true);
    expect(capabilities.canManageOwnVehicle).toBe(true);
    expect(capabilities.canUseReturnJourneys).toBe(true);
  });

  test('business admin mode receives company administration capabilities', () => {
    const capabilities = getDriverWorkspaceCapabilities('admin_business', {
      membershipRole: 'admin',
    });

    expect(capabilities.canManageFleet).toBe(true);
    expect(capabilities.canManageCompanyUsers).toBe(true);
    expect(capabilities.canAllocateDrivers).toBe(true);
  });

  test('owner-driver context does not leak into fleet-driver mode', () => {
    const capabilities = getDriverWorkspaceCapabilities('fleet_driver', {
      ownerDriverWorkspace: true,
    });

    expect(capabilities.canViewExchangeLoads).toBe(false);
    expect(capabilities.canQuoteLoads).toBe(false);
    expect(capabilities.canViewInvoices).toBe(false);
  });
});

test.describe('authoritative role contract', () => {
  test('driver without provider workspace remains driver despite owner-like metadata absence', () => {
    expect(
      resolveAuthoritativeRole({
        membershipRole: null,
        profileRole: 'driver',
        isDriver: true,
        hasCreatedCompany: false,
        fallbackRole: 'owner_operator',
        ownerDriverWorkspaceRequested: false,
      })
    ).toBe('driver');
  });

  test('approved owner-driver company owner resolves to company admin authority', () => {
    expect(
      resolveAuthoritativeRole({
        membershipRole: 'owner',
        profileRole: 'driver',
        isDriver: true,
        hasCreatedCompany: true,
        creatorCompanyType: 'carrier',
        fallbackRole: 'owner_operator',
        ownerDriverWorkspaceRequested: true,
      })
    ).toBe('company_admin');
  });
});

test.describe('portal isolation contract', () => {
  test('driver cannot enter admin, broker, customer or super-admin portals', () => {
    for (const path of ['/admin', '/broker', '/customer', '/super-admin']) {
      expect(isCapabilityAllowedForPath(path, 'driver')).toBe(false);
    }
  });

  test('customer cannot enter driver, broker, admin or super-admin portals', () => {
    for (const path of ['/driver/jobs', '/broker', '/admin', '/super-admin']) {
      expect(isCapabilityAllowedForPath(path, 'customer')).toBe(false);
    }
  });

  test('broker cannot enter customer, driver or super-admin portals', () => {
    for (const path of ['/customer', '/driver/jobs', '/super-admin']) {
      expect(isCapabilityAllowedForPath(path, 'broker')).toBe(false);
    }
  });

  test('company admin cannot enter platform-owner portal', () => {
    expect(isCapabilityAllowedForPath('/super-admin', 'company_admin')).toBe(false);
  });

  test('platform owner can enter platform-owner portal', () => {
    expect(isCapabilityAllowedForPath('/super-admin', 'owner')).toBe(true);
  });

  test('customer capability set never includes carrier execution or fleet management', () => {
    const capabilities = getCapabilitiesForRole('customer');
    expect(capabilities.canExecuteJobs).toBe(false);
    expect(capabilities.canManageFleet).toBe(false);
    expect(capabilities.canAllocateDrivers).toBe(false);
  });
});

test.describe('active company selection contract', () => {
  test('preferred company is used only when membership includes it', () => {
    expect(
      resolvePreferredCompanyId({
        membershipCompanyIds: ['a', 'b'],
        preferredCompanyId: 'b',
        fallbackCompanyId: 'a',
      })
    ).toBe('b');

    expect(
      resolvePreferredCompanyId({
        membershipCompanyIds: ['a', 'b'],
        preferredCompanyId: 'z',
        fallbackCompanyId: 'a',
      })
    ).toBe('a');
  });
});
