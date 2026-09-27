import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  membershipHasCapability,
  resolvePersistedCompanyRole,
} from '../lib/membershipRole';
import {
  getProtectedRouteRequirement,
} from '../lib/roleCapabilities';
import {
  hasWorkspaceCapability,
  resolveWorkspaceRole,
} from '../lib/workspaceRole';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Fleet Manager persisted role foundation', () => {
  const migration = read('supabase/migrations/20260927110000_fleet_manager_persisted_role_foundation.sql');
  const managerApi = read('app/api/admin/fleet/managers/route.ts');
  const fleetOperator = read('app/api/admin/_lib/requireCompanyFleetOperator.ts');

  it('persists Fleet Manager as a real company membership role', () => {
    expect(resolvePersistedCompanyRole('fleet_manager')).toBe('fleet_manager');
    expect(migration).toContain("'fleet_manager'::text");
    expect(migration).toContain('company_memberships_role_in_company_check');
    expect(resolveWorkspaceRole({
      role: 'company_staff',
      rawRole: 'company_staff',
      membershipRole: 'fleet_manager',
    })).toBe('fleet_manager');
  });

  it('grants Fleet Manager operational fleet capabilities without company ownership controls', () => {
    for (const capability of [
      'jobs.view',
      'jobs.allocate',
      'jobs.dispatch',
      'jobs.track',
      'drivers.manage',
      'vehicles.manage',
      'fleet.positions.view',
      'fleet.maintenance.manage',
      'documents.company.manage',
      'invoices.carrier.manage',
      'incidents.manage',
    ] as const) {
      expect(membershipHasCapability('fleet_manager', capability)).toBe(true);
      expect(hasWorkspaceCapability('fleet_manager', capability)).toBe(true);
    }

    expect(hasWorkspaceCapability('fleet_manager', 'company.members.manage')).toBe(false);
    expect(hasWorkspaceCapability('fleet_manager', 'settings.manage')).toBe(false);
    expect(hasWorkspaceCapability('fleet_manager', 'billing.manage')).toBe(false);
    expect(hasWorkspaceCapability('fleet_manager', 'payments.manage')).toBe(false);
  });

  it('authorizes Fleet allocation and vehicle advertising at the database authority layer', () => {
    expect(migration).toContain("NOT IN ('owner', 'admin', 'fleet_manager', 'dispatcher')");
    expect(migration).toContain("role_in_company IN ('owner', 'admin', 'fleet_manager', 'dispatcher')");
    expect(migration).toContain('assign_job_driver_atomic');
    expect(migration).toContain('set_vehicle_advertising_state');
  });

  it('provides an owner/admin-only Fleet Manager provisioning surface', () => {
    expect(managerApi).toContain("const OWNER_ADMIN_ROLES = ['owner', 'admin'] as const");
    expect(managerApi).toContain("role_in_company: 'fleet_manager'");
    expect(managerApi).toContain("workspace_role: 'fleet_manager'");
    expect(managerApi).toContain("requested_role: 'fleet_manager'");
    expect(managerApi).toContain("role: 'company_staff'");
    expect(getProtectedRouteRequirement('/admin/fleet/managers')?.anyOf).toEqual(['company.members.manage']);
  });

  it('uses a dedicated fleet-operator boundary instead of broad company-admin authority', () => {
    expect(fleetOperator).toContain("const FLEET_OPERATOR_ROLES = ['owner', 'admin', 'fleet_manager', 'dispatcher'] as const");
    expect(fleetOperator).not.toContain("'member'");
    expect(fleetOperator).not.toContain("'viewer'");
    expect(fleetOperator).toContain(".in('role_in_company', [...FLEET_OPERATOR_ROLES])");
  });
});
