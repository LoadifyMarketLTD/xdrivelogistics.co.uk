import { describe, it, expect } from 'vitest';
import { isRoleAllowedForPath } from '../lib/authRole';
import type { AppUserRole } from '../lib/authRole';

// company_admin can access /admin routes; used as the representative admin role
const ADMIN_ROLE: AppUserRole = 'company_admin';
const DRIVER_ROLE: AppUserRole = 'driver';
const BROKER_ROLE: AppUserRole = 'broker';
const CUSTOMER_ROLE: AppUserRole = 'customer';

describe('isRoleAllowedForPath — fail-closed for unknown protected routes', () => {
  it('denies unknown /admin sub-paths (no matching route requirement)', () => {
    expect(isRoleAllowedForPath('/admin/root-shell', ADMIN_ROLE)).toBe(false);
    expect(isRoleAllowedForPath('/admin/unknown/segment', ADMIN_ROLE)).toBe(false);
    expect(isRoleAllowedForPath('/admin/invented-page', ADMIN_ROLE)).toBe(false);
  });

  it('denies unknown /broker sub-paths', () => {
    expect(isRoleAllowedForPath('/broker/invented-route', BROKER_ROLE)).toBe(false);
    expect(isRoleAllowedForPath('/broker/unknown/deep/path', BROKER_ROLE)).toBe(false);
  });

  it('denies unknown /customer sub-paths', () => {
    expect(isRoleAllowedForPath('/customer/invented-route', CUSTOMER_ROLE)).toBe(false);
    expect(isRoleAllowedForPath('/customer/unknown/segment', CUSTOMER_ROLE)).toBe(false);
  });

  it('denies unknown /driver sub-paths', () => {
    expect(isRoleAllowedForPath('/driver/invented-route', DRIVER_ROLE)).toBe(false);
    expect(isRoleAllowedForPath('/driver/unknown/deep', DRIVER_ROLE)).toBe(false);
  });

  it('denies super-admin routes for non-platform_owner roles', () => {
    // 'owner' AppUserRole maps to platform_owner and IS allowed — excluded here
    const nonPlatformOwnerRoles: AppUserRole[] = ['company_admin', 'driver', 'broker', 'customer'];
    for (const role of nonPlatformOwnerRoles) {
      expect(isRoleAllowedForPath('/super-admin/users', role)).toBe(false);
      expect(isRoleAllowedForPath('/super-admin', role)).toBe(false);
    }
  });

  it('denies cross-workspace access', () => {
    // customer role cannot access /admin
    expect(isRoleAllowedForPath('/admin/jobs', CUSTOMER_ROLE)).toBe(false);
    // broker role cannot access /admin
    expect(isRoleAllowedForPath('/admin/jobs', BROKER_ROLE)).toBe(false);
    // admin role cannot access /broker routes
    expect(isRoleAllowedForPath('/broker/loads', ADMIN_ROLE)).toBe(false);
    // admin role cannot access /customer routes
    expect(isRoleAllowedForPath('/customer/loads', ADMIN_ROLE)).toBe(false);
  });

  it('denies URL manipulation / path traversal attempts', () => {
    expect(isRoleAllowedForPath('/admin/%2e%2e/customer/loads', ADMIN_ROLE)).toBe(false);
    expect(isRoleAllowedForPath('/admin/../customer', ADMIN_ROLE)).toBe(false);
  });

  it('keeps query strings and fragments inside the same route boundary', () => {
    expect(isRoleAllowedForPath('/admin/jobs?view=active#today', ADMIN_ROLE)).toBe(true);
    expect(isRoleAllowedForPath('/admin/not-real?x=1#frag', ADMIN_ROLE)).toBe(false);
  });

  it('allows public routes for authenticated roles', () => {
    // Public routes (not under any protected prefix) are allowed regardless of role
    expect(isRoleAllowedForPath('/about', ADMIN_ROLE)).toBe(true);
    expect(isRoleAllowedForPath('/login', ADMIN_ROLE)).toBe(true);
    expect(isRoleAllowedForPath('/', ADMIN_ROLE)).toBe(true);
  });

  it('allows known /admin routes when role has matching capability', () => {
    // company_admin has jobs.view → /admin/jobs is permitted
    expect(isRoleAllowedForPath('/admin/jobs', ADMIN_ROLE)).toBe(true);
    // fleet_manager context via WorkspaceRole — use context override
    expect(
      isRoleAllowedForPath('/admin/fleet/assignments', ADMIN_ROLE, { workspaceRole: 'fleet_manager' }),
    ).toBe(true);
  });

  it('denies /admin routes when role lacks the required capability', () => {
    // viewer has only jobs.view; /admin/operations-centre requires jobs.dispatch → denied
    expect(
      isRoleAllowedForPath('/admin/operations-centre', ADMIN_ROLE, { workspaceRole: 'viewer' }),
    ).toBe(false);
    // viewer cannot access /admin/drivers (requires drivers.manage)
    expect(
      isRoleAllowedForPath('/admin/drivers', ADMIN_ROLE, { workspaceRole: 'viewer' }),
    ).toBe(false);
  });

  it('denies owner-driver and driver personas from fleet administration routes', () => {
    expect(isRoleAllowedForPath('/admin/dispatchers', DRIVER_ROLE)).toBe(false);
    expect(
      isRoleAllowedForPath('/admin/dispatchers', DRIVER_ROLE, {
        workspaceRole: 'owner_driver',
        ownerDriverWorkspace: true,
      }),
    ).toBe(false);
  });
});
