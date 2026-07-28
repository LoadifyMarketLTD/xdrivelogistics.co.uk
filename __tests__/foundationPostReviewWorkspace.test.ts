import { describe, expect, it } from 'vitest';

import {
  resolveActiveCompanyContext,
  resolveCompanyEnabledWorkspaces,
  resolveWorkspaceForCompany,
  type RawMembershipRow,
} from '../lib/activeWorkspace';
import { isRoleAllowedForPath } from '../lib/authRole';

const membership = (companyType: string): RawMembershipRow => ({
  id: 'membership-owner-driver',
  company_id: 'company-owner-driver',
  user_id: 'user-1',
  role_in_company: 'owner',
  status: 'active',
  companies: {
    id: 'company-owner-driver',
    name: 'Owner Driver Company',
    company_type: companyType,
    status: 'active',
  },
});

const activeContext = {
  accountStatus: 'active',
  companyStatus: 'active',
} as const;

const driverContext = {
  ...activeContext,
  workspaceRole: 'driver' as const,
  driverId: 'driver-1',
  driverStatus: 'active',
  appAccess: true,
  canCommercialBid: true,
};

describe('post-review workspace blockers', () => {
  it('maps canonical owner_driver company type to owner_operator', () => {
    expect(resolveWorkspaceForCompany('owner_driver')).toBe('owner_operator');
    expect(resolveCompanyEnabledWorkspaces({ companyType: 'owner_driver' })).toEqual({
      ok: true,
      enabledWorkspaces: ['owner_operator'],
    });
  });

  it('resolves an owner-driver membership onto /driver without granting /admin', () => {
    const driverResult = resolveActiveCompanyContext([membership('owner_driver')], {
      targetPathname: '/driver/jobs',
    });

    expect(driverResult.ok).toBe(true);
    if (driverResult.ok) {
      expect(driverResult.context.activeWorkspace).toBe('owner_operator');
      expect(driverResult.context.enabledWorkspaces).toEqual(['owner_operator']);
    }

    expect(
      resolveActiveCompanyContext([membership('owner_driver')], {
        targetPathname: '/admin/jobs',
      }),
    ).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('keeps unknown company types fail-closed', () => {
    expect(resolveWorkspaceForCompany('invented-company-type')).toBeNull();
    expect(resolveCompanyEnabledWorkspaces({ companyType: 'invented-company-type' })).toEqual({
      ok: false,
      error: 'unsupported_company_type',
    });
  });

  it('preserves authorised access to existing admin, broker and customer pages', () => {
    for (const path of [
      '/admin/companies',
      '/admin/broker-invitations',
      '/admin/drivers-vehicles',
      '/admin/notifications',
    ]) {
      expect(
        isRoleAllowedForPath(path, 'company_admin', {
          ...activeContext,
          workspaceRole: 'company_admin',
        }),
      ).toBe(true);
    }

    for (const path of ['/broker/carrier-network', '/broker/team', '/broker/notifications']) {
      expect(
        isRoleAllowedForPath(path, 'broker', {
          ...activeContext,
          workspaceRole: 'broker',
        }),
      ).toBe(true);
    }

    for (const path of ['/customer/updates', '/customer/notifications']) {
      expect(
        isRoleAllowedForPath(path, 'customer', {
          ...activeContext,
          workspaceRole: 'customer',
        }),
      ).toBe(true);
    }
  });

  it('preserves authorised access to existing driver utility pages with full driver facts', () => {
    expect(isRoleAllowedForPath('/driver/more', 'driver', driverContext)).toBe(true);
    expect(isRoleAllowedForPath('/driver/notifications', 'driver', driverContext)).toBe(true);
  });

  it('retains route-specific and cross-workspace restrictions', () => {
    expect(
      isRoleAllowedForPath('/driver/quotes', 'driver', {
        ...driverContext,
        canCommercialBid: false,
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/admin/companies', 'customer', {
        ...activeContext,
        workspaceRole: 'customer',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/broker/team', 'company_admin', {
        ...activeContext,
        workspaceRole: 'company_admin',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/customer/updates', 'broker', {
        ...activeContext,
        workspaceRole: 'broker',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/admin/../customer/updates', 'company_admin', {
        ...activeContext,
        workspaceRole: 'company_admin',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/admin/invented-page', 'company_admin', {
        ...activeContext,
        workspaceRole: 'company_admin',
      }),
    ).toBe(false);
  });
});
