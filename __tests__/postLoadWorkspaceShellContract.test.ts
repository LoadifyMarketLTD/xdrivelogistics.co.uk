import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasWorkspaceCapability, type WorkspaceRole } from '../lib/workspaceRole';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const css = read('app/components/workspace/load-posting-exchange.css');
const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
const createApi = read('app/api/jobs/create/route.ts');

const postingSurfaces = [
  { role: 'platform_owner' as WorkspaceRole, route: '/admin/post-load', page: 'app/admin/post-load/page.tsx' },
  { role: 'company_owner' as WorkspaceRole, route: '/admin/post-load', page: 'app/admin/post-load/page.tsx' },
  { role: 'company_admin' as WorkspaceRole, route: '/admin/post-load', page: 'app/admin/post-load/page.tsx' },
  { role: 'carrier_admin' as WorkspaceRole, route: '/admin/post-load', page: 'app/admin/post-load/page.tsx' },
  { role: 'dispatcher' as WorkspaceRole, route: '/admin/post-load', page: 'app/admin/post-load/page.tsx' },
  { role: 'broker' as WorkspaceRole, route: '/broker/post-load', page: 'app/broker/post-load/page.tsx' },
  { role: 'customer' as WorkspaceRole, route: '/customer/post-load', page: 'app/customer/post-load/page.tsx' },
  { role: 'owner_driver' as WorkspaceRole, route: '/driver/post-load', page: 'app/driver/post-load/page.tsx' },
];

describe('Post Load workspace width and access contract', () => {
  it('forces the shared Post Load form to fill every workspace shell', () => {
    expect(css).toContain('width:100%');
    expect(css).toContain('min-width:0');
    expect(css).toContain('max-width:none');
    expect(css).toContain('grid-template-columns:minmax(0,1fr)');
    expect(css).toContain('justify-self:stretch');
    expect(css).toContain('align-self:stretch');
    expect(css).toContain('.xdrive-post-load-form>section');
    expect(css).toContain('.xdrive-post-load-form .xdrive-panel__body');
  });

  it.each(postingSurfaces)('$role has a real Post Load page at $route', ({ page, route }) => {
    expect(fs.existsSync(path.join(root, page)), page).toBe(true);
    expect(getProtectedRouteRequirement(route), route).not.toBeNull();
  });

  it.each(postingSurfaces.filter(({ role }) => role !== 'owner_driver'))(
    '$role exposes loads.create consistently with its posting surface',
    ({ role }) => {
      expect(hasWorkspaceCapability(role, 'loads.create')).toBe(true);
    },
  );

  it('keeps Owner Driver posting explicitly role-scoped while using the shared form', () => {
    expect(read('app/driver/post-load/page.tsx')).toContain('<LoadPostingForm mode="owner" />');
    expect(getProtectedRouteRequirement('/driver/post-load')?.roles).toContain('owner_driver');
  });

  it('keeps Customer, Broker and Admin shells on the same shared LoadPostingForm', () => {
    expect(read('app/admin/post-load/page.tsx')).toContain('<LoadPostingForm mode="admin" />');
    expect(read('app/broker/post-load/page.tsx')).toContain('<LoadPostingForm mode="broker" />');
    expect(read('app/customer/CustomerWorkspaceModules.tsx')).toContain('<LoadPostingForm mode="customer"/>');
  });

  it('routes dispatcher and platform/company carrier roles to the admin Post Load surface', () => {
    expect(shell).toContain('showCarrierPostLoadAction');
    expect(shell).toContain("role === 'dispatcher' || role === 'platform_owner'");
    expect(shell).toContain("const postLoadHref = CARRIER_NAV_ROLES.has(role) ? '/admin/post-load' : '/driver/post-load';");
    expect(shell).toContain("const postLoadTargetHref = showAdminStaffPostLoadAction ? '/admin/post-load' : postLoadHref;");
    expect(shell).toContain('router.push(postLoadTargetHref)');
  });

  it('matches the server-side company posting membership contract', () => {
    expect(createApi).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
  });

  it('does not grant load creation to non-posting operational roles', () => {
    for (const role of ['fleet_manager', 'driver', 'finance', 'compliance', 'viewer'] as WorkspaceRole[]) {
      expect(hasWorkspaceCapability(role, 'loads.create')).toBe(false);
    }
  });
});
