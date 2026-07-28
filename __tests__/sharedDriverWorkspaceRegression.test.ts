import { describe, expect, it } from 'vitest';

import {
  resolveActiveCompanyContext,
  type RawMembershipRow,
} from '../lib/activeWorkspace';
import { resolveWorkspacePermission } from '../lib/workspacePermissionResolver';

const membership = (companyType: string, role = 'driver'): RawMembershipRow => ({
  id: 'membership-1',
  company_id: 'company-1',
  user_id: 'user-1',
  role_in_company: role,
  status: 'active',
  companies: {
    id: 'company-1',
    name: 'Company One',
    company_type: companyType,
    status: 'active',
  },
});

describe('shared /driver workspace regression', () => {
  it('derives carrier_fleet from the selected standard company before evaluating /driver', () => {
    const result = resolveActiveCompanyContext([membership('standard')], {
      preferredCompanyId: 'company-1',
      targetPathname: '/driver/jobs',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
      expect(result.context.enabledWorkspaces).toEqual(['carrier_fleet']);
      expect(result.context.membershipRole).toBe('driver');
    }
  });

  it('continues to derive owner_operator for a canonical owner-driver company', () => {
    const result = resolveActiveCompanyContext([membership('owner_driver')], {
      preferredCompanyId: 'company-1',
      targetPathname: '/driver/jobs',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('owner_operator');
      expect(result.context.enabledWorkspaces).toEqual(['owner_operator']);
    }
  });

  it('allows a valid Company Driver on /driver while denying the same driver-only identity on /admin', () => {
    const driverResult = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      pathname: '/driver/jobs',
      driverId: 'driver-1',
      driverStatus: 'active',
      appAccess: true,
      accountStatus: 'active',
      companyStatus: 'active',
    });

    expect(driverResult).toEqual({
      allowed: true,
      membershipRole: 'driver',
      activeWorkspace: 'carrier_fleet',
    });

    const adminResult = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      workspaceRole: 'driver',
      pathname: '/admin/jobs',
      accountStatus: 'active',
      companyStatus: 'active',
    });

    expect(adminResult).toEqual({
      allowed: false,
      reason: 'capability_not_permitted',
    });
  });
});
