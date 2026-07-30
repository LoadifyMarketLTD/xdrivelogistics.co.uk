import { describe, it, expect } from 'vitest';
import { isRoleAllowedForPath } from '../lib/authRole';
import type { AppUserRole } from '../lib/authRole';
import { resolveWorkspaceRole } from '../lib/workspaceRole';

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

  it('denies /driver for owner/admin personas without a valid driver context', () => {
    expect(
      isRoleAllowedForPath('/driver/jobs', ADMIN_ROLE, {
        workspaceRole: 'company_admin',
        driverId: null,
        appAccess: null,
        driverStatus: null,
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(false);
  });

  it('allows identical /driver access for owner/admin/company-driver memberships with valid scoped driver facts', () => {
    const contexts = [
      { membershipRole: 'owner', ownerDriverWorkspace: true },
      { membershipRole: 'admin', ownerDriverWorkspace: true },
      { membershipRole: 'driver', ownerDriverWorkspace: false },
    ];

    for (const context of contexts) {
      const workspaceRole = resolveWorkspaceRole({
        role: 'driver',
        rawRole: 'driver',
        membershipRole: context.membershipRole,
        ownerDriverWorkspace: context.ownerDriverWorkspace,
      });

      expect(
        isRoleAllowedForPath('/driver/jobs', DRIVER_ROLE, {
          workspaceRole,
          driverId: 'drv-dual',
          appAccess: true,
          driverStatus: 'active',
          accountStatus: 'active',
          companyStatus: 'active',
        }),
      ).toBe(true);

      expect(
        isRoleAllowedForPath('/driver/loads', DRIVER_ROLE, {
          workspaceRole,
          driverId: 'drv-dual',
          appAccess: true,
          driverStatus: 'active',
          accountStatus: 'active',
          companyStatus: 'active',
        }),
      ).toBe(true);

      expect(
        isRoleAllowedForPath('/driver/quotes', DRIVER_ROLE, {
          workspaceRole,
          driverId: 'drv-dual',
          appAccess: true,
          driverStatus: 'active',
          accountStatus: 'active',
          companyStatus: 'active',
          canCommercialBid: true,
        }),
      ).toBe(true);
    }
  });

  it('allows both company driver and owner driver on the same commercial driver routes', () => {
    expect(
      isRoleAllowedForPath('/driver/jobs', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-10',
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(true);

    expect(
      isRoleAllowedForPath('/driver/loads', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-10',
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(true);

    expect(
      isRoleAllowedForPath('/driver/loads', DRIVER_ROLE, {
        workspaceRole: 'owner_driver',
        driverId: 'drv-10',
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(true);
  });

  it('denies quotes when commercial bidding or driver context is missing', () => {
    expect(
      isRoleAllowedForPath('/driver/quotes', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-11',
        canCommercialBid: false,
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/driver/quotes', DRIVER_ROLE, {
        workspaceRole: 'owner_driver',
        driverId: null,
        canCommercialBid: true,
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/driver/quotes', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-11',
        canCommercialBid: true,
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(true);

    expect(
      isRoleAllowedForPath('/driver/quotes', DRIVER_ROLE, {
        workspaceRole: 'owner_driver',
        driverId: 'drv-11',
        canCommercialBid: true,
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(true);
  });

  it('allows /admin only through valid membership-derived admin workspace, not owner-driver metadata', () => {
    expect(
      isRoleAllowedForPath('/admin/jobs', DRIVER_ROLE, {
        workspaceRole: 'owner_driver',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/admin/jobs', DRIVER_ROLE, {
        workspaceRole: 'company_owner',
      }),
    ).toBe(true);
  });

  it('denies /driver routes when driver/account/company state is inactive or app access is blocked', () => {
    expect(
      isRoleAllowedForPath('/driver/jobs', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-12',
        appAccess: false,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/driver/jobs', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-12',
        appAccess: true,
        driverStatus: 'suspended',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/driver/jobs', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-12',
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'blocked',
        companyStatus: 'active',
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/driver/jobs', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-12',
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'suspended',
      }),
    ).toBe(false);
  });
});
