import { describe, it, expect } from 'vitest';
import { resolveWorkspacePermission } from '../lib/workspacePermissionResolver';

describe('resolveWorkspacePermission', () => {
  it('fails closed for null/empty/unknown company types', () => {
    for (const companyType of [null, '', 'unknown'] as const) {
      const result = resolveWorkspacePermission({
        companyType,
        membershipStatus: 'active',
        membershipRole: 'owner',
        pathname: '/admin/jobs',
      });
      expect(result).toEqual({ allowed: false, reason: 'unsupported_company_type' });
    }
  });

  it('denies when workspace is disabled', () => {
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['broker'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
    });
    expect(result).toEqual({ allowed: false, reason: 'workspace_not_enabled' });
  });

  it('denies explicitly requested workspace when not permitted', () => {
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      requestedWorkspace: 'broker',
      pathname: '/admin/jobs',
    });
    expect(result).toEqual({ allowed: false, reason: 'requested_workspace_not_permitted' });
  });

  it('denies unknown protected routes', () => {
    const result = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/invented-route',
    });
    expect(result).toEqual({ allowed: false, reason: 'unmapped_route' });
  });

  it('denies cross-workspace paths and URL manipulation', () => {
    const crossWorkspace = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/customer/loads',
    });
    expect(crossWorkspace).toEqual({ allowed: false, reason: 'route_workspace_mismatch' });

    const manipulated = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'owner',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/%2e%2e/customer/loads',
    });
    expect(manipulated).toEqual({ allowed: false, reason: 'malformed_route' });
  });

  it('keeps full membership role identity (finance/compliance/driver)', () => {
    const finance = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'finance',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/invoices',
    });
    expect(finance).toEqual({
      allowed: true,
      membershipRole: 'finance',
      activeWorkspace: 'carrier_fleet',
    });

    const compliance = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'compliance',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/documents',
    });
    expect(compliance).toEqual({
      allowed: true,
      membershipRole: 'compliance',
      activeWorkspace: 'carrier_fleet',
    });

    const driver = resolveWorkspacePermission({
      companyType: 'standard',
      membershipStatus: 'active',
      membershipRole: 'driver',
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      pathname: '/admin/jobs',
    });
    expect(driver).toEqual({
      allowed: true,
      membershipRole: 'driver',
      activeWorkspace: 'carrier_fleet',
    });
  });
});
