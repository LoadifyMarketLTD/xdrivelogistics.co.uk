import { describe, expect, it } from 'vitest';

import { resolveAdminShellSurfaceRole } from '../app/admin/AdminPlatformShell';

describe('Fleet workspace top-bar surface', () => {
  it('promotes company and carrier operators into the Fleet shell on Fleet routes', () => {
    expect(resolveAdminShellSurfaceRole('/admin/fleet', 'company_owner')).toBe('fleet_manager');
    expect(resolveAdminShellSurfaceRole('/admin/fleet/drivers', 'company_admin')).toBe('fleet_manager');
    expect(resolveAdminShellSurfaceRole('/admin/fleet/vehicles', 'carrier_admin')).toBe('fleet_manager');
    expect(resolveAdminShellSurfaceRole('/admin/fleet/availability?view=live', 'fleet_manager')).toBe('fleet_manager');
  });

  it('does not replace the dispatcher Operations workspace on shared Fleet routes', () => {
    expect(resolveAdminShellSurfaceRole('/admin/fleet/assignments', 'dispatcher')).toBeUndefined();
    expect(resolveAdminShellSurfaceRole('/admin/fleet/active-jobs', 'dispatcher')).toBeUndefined();
  });

  it('does not turn the generic company dashboard into Fleet unless the route is a Fleet surface', () => {
    expect(resolveAdminShellSurfaceRole('/admin', 'company_owner')).toBeUndefined();
    expect(resolveAdminShellSurfaceRole('/admin/jobs', 'company_admin')).toBeUndefined();
    expect(resolveAdminShellSurfaceRole('/admin/marketplace', 'carrier_admin')).toBeUndefined();
  });
});
