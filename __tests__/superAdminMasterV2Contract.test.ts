import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vehicleStatus } from '../app/super-admin/fleet/vehicleStatus';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const masterCss = source('app/super-admin/super-admin-master-contract.css');
const directoryCss = source('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');
const commandCentre = source('app/super-admin/page.tsx');
const cockpit = source('app/super-admin/operations/control-centre/page.tsx');
const cockpitApi = source('app/api/super-admin/operations-cockpit/route.ts');
const allJobs = source('app/super-admin/operations/jobs/page.tsx');
const jobLedger = source('app/super-admin/_components/SuperAdminOperationsJobLedger.tsx');
const vehicleRegistry = source('app/super-admin/fleet/vehicles/page.tsx');
const activeCompanies = source('app/super-admin/companies/active/page.tsx');
const companyLedger = source('app/super-admin/_components/SuperAdminCompanyStatusLedger.tsx');
const finance = source('app/super-admin/finance/page.tsx');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const liveTable = source('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
const enterprisePrimitives = source('app/super-admin/_components/SuperAdminEnterprisePrimitives.tsx');

describe('Super Admin integrated current contract', () => {
  it('retains the enterprise design-token layer', () => {
    for (const token of [
      '--sa-v2-radius: 8px', '--sa-v2-shadow: 0px 2px 6px rgba(0,0,0,0.08)',
      '--sa-v2-container: 24px', '--sa-v2-button: 12px 18px',
      '--sa-v2-pager: 0 14px', '--sa-v2-table-action: 0 12px',
      '--sa-v2-blue: #1A73E8', '--sa-v2-green: #34A853',
      '--sa-v2-yellow: #FBBC05', '--sa-v2-red: #EA4335',
    ]) expect(masterCss).toContain(token);
  });

  it('keeps the Super Admin directory responsive instead of desktop-only', () => {
    expect(directoryCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(directoryCss).toContain('@media (max-width: 1200px)');
    expect(directoryCss).toContain('@media (max-width: 900px)');
    expect(directoryCss).toContain('@media (max-width: 640px)');
    expect(directoryCss).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('keeps Command Centre source-backed and fail-closed', () => {
    expect(commandCentre).toContain('Critical attention');
    expect(commandCentre).toContain('Operational queue');
    expect(commandCentre).toContain('Administrative activity');
    expect(commandCentre).toContain('Unavailable — not reported as healthy.');
    expect(commandCentre).toContain('No zero or healthy state has been inferred.');
  });

  it('keeps Operations Control Centre on canonical live sources', () => {
    for (const label of ['Active Jobs', 'Drivers Online', 'Fleet Health', 'Late Deliveries', 'Revenue Today', 'Urgent Requests']) {
      expect(cockpit).toContain(`label="${label}"`);
    }
    expect(cockpitApi).toContain(".from('driver_locations')");
    expect(cockpitApi).toContain(".from('driver_availability_presence')");
    expect(cockpitApi).toContain(".from('job_tracking_eta_snapshots')");
    expect(cockpitApi).toContain('providerCallsTriggered: false');
  });

  it('delegates All Jobs to the canonical operations ledger', () => {
    expect(allJobs).toContain('SuperAdminOperationsJobLedger');
    expect(allJobs).toContain('mode="all"');
    for (const label of ['Route', 'Status', 'Posting company', 'Bids']) {
      expect(jobLedger).toContain(`label: '${label}'`);
    }
    expect(jobLedger).toContain("label: mode === 'pending' ? 'Posted' : 'Created'");
  });

  it('preserves truthful vehicle status', () => {
    expect(vehicleRegistry).toContain('vehicleStatus');
    expect(vehicleStatus({ current_status: null, status: 'inactive', is_available: true })).toBe('WAITING FOR NEXT JOB (AVAILABLE)');
    expect(vehicleStatus({ current_status: 'maintenance', status: 'active', is_available: false })).toBe('MAINTENANCE');
    expect(vehicleStatus({ current_status: null, status: null, is_available: null })).toBe('UNKNOWN');
  });

  it('delegates Active Companies to the canonical company ledger', () => {
    expect(activeCompanies).toContain('SuperAdminCompanyStatusLedger');
    expect(activeCompanies).toContain('mode="active"');
    for (const label of ['Company', 'Registration', 'Email', 'Type', 'Status', 'Created']) {
      expect(companyLedger).toContain(`label:'${label}'`);
    }
  });

  it('keeps Finance truthful when datasets do not exist', () => {
    expect(finance).toContain('Finance Overview');
    expect(finance).toContain('No authoritative platform expense ledger');
    expect(finance).toContain('Cannot infer profit without expenses');
    expect(finance).toContain('Top Clients remains unavailable');
    expect(finance).toContain("fetch('/api/super-admin/finance/summary'");
  });

  it('keeps current Platform navigation and governed settings destinations', () => {
    for (const label of [
      'Users & Access', 'Roles & Permissions', 'Notifications', 'Platform Health',
      'Audit Logs', 'Global Settings', 'Legal & Agreements', 'Feature Flags',
    ]) expect(workspace).toContain(`label: '${label}'`);
    expect(workspace).toContain("href: '/super-admin/action-centre'");
    expect(workspace).toContain("href: '/super-admin/search'");
  });

  it('keeps pager and table actions distinct in shared primitives', () => {
    expect(liveTable).toContain('onPrevPage');
    expect(liveTable).toContain('onNextPage');
    expect(enterprisePrimitives).toContain('data-pager-button="true"');
    expect(masterCss).toContain('--sa-v2-pager: 0 14px');
    expect(masterCss).toContain('--sa-v2-table-action: 0 12px');
  });
});
