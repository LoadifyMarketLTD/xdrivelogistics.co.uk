import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-10 canonical Super Admin role coverage', () => {
  it('covers every canonical workspace role defined by the platform', () => {
    const route = readRepoFile('app/api/super-admin/users/canonical/route.ts');
    const rolesRegistry = readRepoFile('app/super-admin/settings/roles-permissions/rolesRegistry.ts');

    for (const role of [
      'platform_owner', 'company_owner', 'company_admin', 'carrier_admin', 'broker', 'customer',
      'fleet_manager', 'dispatcher', 'driver', 'owner_driver', 'finance', 'compliance', 'viewer',
    ]) {
      expect(route).toContain(`'${role}'`);
      expect(rolesRegistry).toContain(`'${role}'`);
    }
  });

  it('derives authority from real identity, membership, workspace-grant and driver sources', () => {
    const route = readRepoFile('app/api/super-admin/users/canonical/route.ts');

    expect(route).toContain(".from('profiles')");
    expect(route).toContain(".from('company_memberships')");
    expect(route).toContain(".from('company_membership_workspace_access')");
    expect(route).toContain(".from('drivers')");
    expect(route).toContain('provenance');
  });

  it('does not allow a company workspace grant named platform to manufacture Platform Owner authority', () => {
    const route = readRepoFile('app/api/super-admin/users/canonical/route.ts');

    expect(route).toContain("owner: 'platform_owner'");
    expect(route).toContain("if (normalizedWorkspace === 'platform')");
    expect(route).toContain('ignoredPlatformWorkspaceGrants.push');
    expect(route).toContain("Platform Owner authority is sourced only from profiles.role=owner.");
    expect(route).not.toContain("platform: 'platform_owner'");
  });

  it('keeps active authority separate from invited or inactive records', () => {
    const route = readRepoFile('app/api/super-admin/users/canonical/route.ts');

    expect(route).toContain('authority_active');
    expect(route).toContain("normalize(membership.status) === 'active'");
    expect(route).toContain('activeRoleCounts');
  });

  it('replaces the five-category legacy landing with all canonical role cards', () => {
    const page = readRepoFile('app/super-admin/users/page.tsx');
    const rolePage = readRepoFile('app/super-admin/users/roles/[workspaceRole]/page.tsx');

    expect(page).toContain('CANONICAL_ROLES.map');
    expect(page).toContain('/api/super-admin/users/canonical?limit=1');
    expect(page).not.toContain('const USER_SECTIONS');
    expect(page).toContain('Counts are not replaced with fabricated zeroes.');
    expect(rolePage).toContain('/api/super-admin/users/canonical?workspaceRole=');
    expect(rolePage).toContain('Rows represent authoritative identity/grant evidence');
  });

  it('drills role rows into canonical User or Driver inspectors', () => {
    const rolePage = readRepoFile('app/super-admin/users/roles/[workspaceRole]/page.tsx');

    expect(rolePage).toContain("entityType: 'driver'");
    expect(rolePage).toContain("entityType: 'user' as PlatformEntityType");
  });
});
