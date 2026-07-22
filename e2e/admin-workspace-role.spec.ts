import { expect, test } from '@playwright/test';
import { resolveAdminDashboardKind } from '../lib/adminWorkspaceRole';

test.describe('admin dashboard role resolution', () => {
  test('preserves specialised dashboards', () => {
    expect(resolveAdminDashboardKind('fleet_manager', true)).toBe('fleet');
    expect(resolveAdminDashboardKind('finance', true)).toBe('finance');
    expect(resolveAdminDashboardKind('compliance', true)).toBe('compliance');
  });

  test('routes verified company administration roles to Admin Workspace', () => {
    expect(resolveAdminDashboardKind('company_owner', true)).toBe('admin');
    expect(resolveAdminDashboardKind('company_admin', true)).toBe('admin');
    expect(resolveAdminDashboardKind('carrier_admin', true)).toBe('admin');
    expect(resolveAdminDashboardKind('dispatcher', true)).toBe('admin');
  });

  test('requires company context for platform owner company view', () => {
    expect(resolveAdminDashboardKind('platform_owner', true)).toBe('admin');
    expect(resolveAdminDashboardKind('platform_owner', false)).toBe('carrier');
  });

  test('does not route broker, customer or driver to Admin Workspace', () => {
    expect(resolveAdminDashboardKind('broker', true)).toBe('carrier');
    expect(resolveAdminDashboardKind('customer', true)).toBe('carrier');
    expect(resolveAdminDashboardKind('driver', true)).toBe('carrier');
    expect(resolveAdminDashboardKind('owner_driver', true)).toBe('carrier');
  });
});
