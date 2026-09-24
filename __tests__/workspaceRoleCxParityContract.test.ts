import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORKSPACE_DEFINITIONS, getVisibleWorkspaceNav, hasWorkspaceCapability, type WorkspaceRole } from '../lib/workspaceRole';

const routeFile = (href: string) => {
  const clean = href.split('?')[0]?.split('#')[0] || '/';
  return path.join(process.cwd(), 'app', ...clean.split('/').filter(Boolean), 'page.tsx');
};

describe('CX-informed XDrive workspace role contract', () => {
  it('keeps account-owner powers separate from company-admin and company-user style access', () => {
    expect(hasWorkspaceCapability('company_owner', 'company.manage')).toBe(true);
    expect(hasWorkspaceCapability('company_owner', 'billing.manage')).toBe(true);
    expect(hasWorkspaceCapability('company_owner', 'drivers.manage')).toBe(true);
    expect(hasWorkspaceCapability('company_owner', 'vehicles.manage')).toBe(true);

    expect(hasWorkspaceCapability('company_admin', 'drivers.manage')).toBe(true);
    expect(hasWorkspaceCapability('company_admin', 'vehicles.manage')).toBe(true);

    expect(hasWorkspaceCapability('carrier_admin', 'company.manage')).toBe(false);
    expect(hasWorkspaceCapability('carrier_admin', 'settings.manage')).toBe(false);
    expect(hasWorkspaceCapability('carrier_admin', 'loads.view.marketplace')).toBe(true);
    expect(hasWorkspaceCapability('carrier_admin', 'quotes.submit')).toBe(true);
  });

  it('gives owner-drivers the business actions a sole trader needs without turning employee drivers into company admins', () => {
    for (const capability of ['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'billing.manage', 'company.manage'] as const) {
      expect(hasWorkspaceCapability('owner_driver', capability)).toBe(true);
    }
    expect(hasWorkspaceCapability('driver', 'loads.create')).toBe(false);
    expect(hasWorkspaceCapability('driver', 'billing.manage')).toBe(false);
    expect(hasWorkspaceCapability('driver', 'company.manage')).toBe(false);
    expect(hasWorkspaceCapability('driver', 'drivers.manage')).toBe(false);
  });

  it('keeps fleet operations connected to allocation, drivers, vehicles and live positions', () => {
    for (const capability of ['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view'] as const) {
      expect(hasWorkspaceCapability('fleet_manager', capability)).toBe(true);
    }
  });

  it('keeps broker and customer commercial flows connected to posting, quotes, awards and tracking', () => {
    for (const role of ['broker', 'customer'] as const) {
      for (const capability of ['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track'] as const) {
        expect(hasWorkspaceCapability(role, capability)).toBe(true);
      }
    }
  });

  it('does not expose dead canonical navigation routes for operational roles', () => {
    const roles: WorkspaceRole[] = ['company_owner', 'company_admin', 'carrier_admin', 'fleet_manager', 'dispatcher', 'driver', 'owner_driver', 'broker', 'customer', 'finance', 'compliance', 'viewer'];
    for (const role of roles) {
      const definition = WORKSPACE_DEFINITIONS[role];
      expect(fs.existsSync(routeFile(definition.homeHref))).toBe(true);
      for (const group of getVisibleWorkspaceNav(role)) {
        for (const item of group.items) expect(fs.existsSync(routeFile(item.href))).toBe(true);
      }
    }
  });

  it('enforces owner-only editing of canonical company identity in Settings', () => {
    const settings = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');
    expect(settings).toContain("const canEditCompany = membershipRole === 'owner';");
    expect(settings).toContain("const canManageCompanyOperations = membershipRole === 'owner' || membershipRole === 'admin';");
    expect(settings).toContain('disabled={!canEditCompany}');
  });
});
