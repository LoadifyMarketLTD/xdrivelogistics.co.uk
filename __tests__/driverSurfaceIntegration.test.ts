import { describe, expect, it } from 'vitest';

import { isRoleAllowedForPath } from '../lib/authRole';
import {
  getVisibleWorkspaceNav,
  resolveWorkspaceRole,
  resolveWorkspaceSurfaceRole,
} from '../lib/workspaceRole';

const DRIVER_ROLE = 'driver' as const;

const navHrefs = (role: Parameters<typeof getVisibleWorkspaceNav>[0]) =>
  getVisibleWorkspaceNav(role)
    .flatMap((group) => group.items.map((item) => item.href))
    .sort();

describe('driver surface integration', () => {
  it('forces shared Driver shell surface for all /driver routes', () => {
    expect(resolveWorkspaceSurfaceRole('/driver', 'company_owner')).toBe('driver');
    expect(resolveWorkspaceSurfaceRole('/driver/jobs', 'company_admin')).toBe('driver');
    expect(resolveWorkspaceSurfaceRole('/driver/quotes?tab=open', 'company_owner')).toBe('driver');
  });

  it('shows identical Driver nav hrefs for owner+driver, admin+driver and company driver entering /driver', () => {
    const contexts = [
      { membershipRole: 'owner', ownerDriverWorkspace: true },
      { membershipRole: 'admin', ownerDriverWorkspace: true },
      { membershipRole: 'driver', ownerDriverWorkspace: false },
    ];

    const expectedDriverHrefs = navHrefs('driver');

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
          driverId: 'drv-1',
          appAccess: true,
          driverStatus: 'active',
          accountStatus: 'active',
          companyStatus: 'active',
        }),
      ).toBe(true);

      expect(resolveWorkspaceSurfaceRole('/driver/jobs', workspaceRole)).toBe('driver');
      expect(navHrefs(resolveWorkspaceSurfaceRole('/driver/jobs', workspaceRole))).toEqual(expectedDriverHrefs);
    }
  });

  it('keeps company navigation in /admin for owner/admin identities', () => {
    const ownerWorkspaceRole = resolveWorkspaceRole({
      role: 'driver',
      rawRole: 'driver',
      membershipRole: 'owner',
      ownerDriverWorkspace: true,
    });
    const adminWorkspaceRole = resolveWorkspaceRole({
      role: 'driver',
      rawRole: 'driver',
      membershipRole: 'admin',
      ownerDriverWorkspace: true,
    });

    expect(ownerWorkspaceRole).toBe('company_owner');
    expect(adminWorkspaceRole).toBe('company_admin');
    expect(resolveWorkspaceSurfaceRole('/admin/jobs', ownerWorkspaceRole)).toBe('company_owner');
    expect(resolveWorkspaceSurfaceRole('/admin/jobs', adminWorkspaceRole)).toBe('company_admin');
    expect(navHrefs(ownerWorkspaceRole)).toContain('/admin/jobs');
    expect(navHrefs(adminWorkspaceRole)).toContain('/admin/jobs');
  });

  it('does not grant /admin access from driver identity alone', () => {
    expect(
      isRoleAllowedForPath('/admin/jobs', DRIVER_ROLE, {
        workspaceRole: 'driver',
        driverId: 'drv-1',
        appAccess: true,
        driverStatus: 'active',
        accountStatus: 'active',
        companyStatus: 'active',
      }),
    ).toBe(false);
  });
});
