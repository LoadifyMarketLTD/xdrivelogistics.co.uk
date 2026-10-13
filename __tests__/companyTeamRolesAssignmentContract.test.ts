import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('company Team & Roles assignment contract', () => {
  const teamPage = read('app/admin/team/page.tsx');
  const managerPage = read('app/admin/fleet/managers/page.tsx');
  const carrierCss = read('app/admin/carrier-workspace-canonical.css');
  const dispatcherPage = read('app/admin/dispatchers/page.tsx');
  const managerApi = read('app/api/admin/fleet/managers/route.ts');
  const dispatcherApi = read('app/api/admin/dispatchers/route.ts');
  const settings = read('app/components/workspace/RoleSettingsWorkspace.tsx');

  it('gives Company Owner/Admin one discoverable Team & Roles entry point', () => {
    expect(teamPage).toContain('title="Team & Roles"');
    expect(teamPage).toContain("membershipRole === 'owner' || membershipRole === 'admin'");
    expect(settings).toContain("team: '/admin/team'");
    expect(getProtectedRouteRequirement('/admin/team')?.anyOf).toEqual(['company.members.manage']);
  });

  it('offers Fleet Manager as an assignable company function', () => {
    expect(teamPage).toContain('Add / Manage Fleet Managers');
    expect(teamPage).toContain("router.push('/admin/fleet/managers')");
    expect(managerPage).toContain("'Add Fleet Manager'");
    expect(managerApi).toContain("role_in_company: 'fleet_manager'");
    expect(managerApi).toContain("requested_role: 'fleet_manager'");
    expect(getProtectedRouteRequirement('/admin/fleet/managers')?.anyOf).toEqual(['company.members.manage']);
  });

  it('keeps Fleet Manager onboarding on the shared Carrier register visual system', () => {
    for (const hook of [
      'carrier-register-page--fleet-managers',
      'carrier-register-toolbar',
      'carrier-register-title',
      'carrier-register-manager-form',
      'carrier-register-results',
      'carrier-register-table-wrap',
      'OperationalTable<ManagerRow>',
      'carrier-register-action',
    ]) expect(managerPage).toContain(hook);
    expect(managerPage).not.toContain('rounded-2xl');
    expect(managerPage).not.toContain('h-11');
    expect(carrierCss).toContain('.carrier-register-manager-form');
    expect(carrierCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(managerPage).toContain('StatusBadge value={manager.status}');
  });

  it('offers Dispatcher as an assignable company function', () => {
    expect(teamPage).toContain('Add / Manage Dispatchers');
    expect(teamPage).toContain("router.push('/admin/dispatchers')");
    expect(dispatcherPage).toContain('+ Add Dispatcher');
    expect(dispatcherApi).toContain("role_in_company: 'dispatcher'");
    expect(dispatcherApi).toContain("requested_role: 'dispatcher'");
    expect(getProtectedRouteRequirement('/admin/dispatchers')?.anyOf).toEqual(['company.members.manage']);
  });

  it('does not let Fleet Managers or Dispatchers grant these roles themselves', () => {
    expect(teamPage).toContain('only Company Owners and Admins can assign operational roles');
    expect(managerApi).toContain("const OWNER_ADMIN_ROLES = ['owner', 'admin'] as const");
    expect(dispatcherApi).toContain("const ADMIN_ROLES = new Set(['owner', 'admin'])");
  });
});
