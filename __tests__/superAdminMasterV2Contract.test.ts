import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vehicleStatus } from '../app/super-admin/fleet/vehicleStatus';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const master = source('docs/super-admin/MASTER_CONTRACT_FINAL.md');
const masterCss = source('app/super-admin/super-admin-master-contract.css');
const visualCss = source('app/super-admin/super-admin-visual-contract.css');
const directoryCss = source('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');
const commandCentre = source('app/super-admin/page.tsx');
const cockpit = source('app/super-admin/operations/control-centre/page.tsx');
const cockpitCss = source('app/super-admin/operations/control-centre/page.module.css');
const operationalMap = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');
const allJobs = source('app/super-admin/operations/jobs/page.tsx');
const driverAvailability = source('app/super-admin/operations/driver-availability/page.tsx');
const vehicleRegistry = source('app/super-admin/fleet/vehicles/page.tsx');
const activeCompanies = source('app/super-admin/companies/active/page.tsx');
const finance = source('app/super-admin/finance/page.tsx');
const insurance = source('app/super-admin/compliance/insurance/page.tsx');
const licences = source('app/super-admin/compliance/operator-licences/page.tsx');
const support = source('app/super-admin/support/tickets/page.tsx');
const supportApi = source('app/api/super-admin/support/route.ts');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const globalSettings = source('app/super-admin/settings/global/page.tsx');
const usersIndex = source('app/super-admin/users/page.tsx');
const liveTable = source('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
const releaseGate = source('scripts/netlify-release-gate.mjs');

describe('MASTER CONTRACT FINAL v2 — integrated Super Admin contract', () => {
  it('locks the exact v2 design tokens and spacing hierarchy', () => {
    for (const token of [
      '--sa-v2-radius: 8px',
      '--sa-v2-shadow: 0px 2px 6px rgba(0,0,0,0.08)',
      '--sa-v2-container: 24px',
      '--sa-v2-button: 12px 18px',
      '--sa-v2-chip: 4px 10px',
      '--sa-v2-pager: 0 14px',
      '--sa-v2-table-action: 0 12px',
      '--sa-v2-blue: #1A73E8',
      '--sa-v2-green: #34A853',
      '--sa-v2-yellow: #FBBC05',
      '--sa-v2-red: #EA4335',
      '--sa-v2-grey: #8A9099',
      '--sa-v2-white: #FFFFFF',
    ]) expect(masterCss).toContain(token);

    expect(masterCss).toContain('font-size: 16px !important;');
    expect(masterCss).toContain('font-weight: 500 !important;');
    expect(masterCss).toContain('.super-admin-light-root svg');
    expect(masterCss).toContain('width: 24px !important;');
    expect(masterCss).toContain('height: 24px !important;');
    expect(masterCss).not.toContain('#F5F7FA');
    expect(masterCss).not.toContain('#4A4A4A');
    expect(masterCss).not.toContain('#E0E3E7');
    expect(visualCss).toContain('--enterprise-button-padding: 12px 18px');
    expect(visualCss).toContain('--enterprise-table-action-padding: 0 12px');
  });

  it('keeps Directory fixed at exactly 3 x 3 without a breakpoint', () => {
    expect(directoryCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(directoryCss).toContain('grid-template-rows: repeat(3, auto)');
    expect(directoryCss).toContain('.areaIcon svg { width: 24px; height: 24px; }');
    expect(directoryCss).not.toContain('@media');
    for (const label of ['Dashboard', 'Marketplace', 'Operations', 'Fleet', 'Companies', 'Finance', 'Compliance', 'Support', 'Platform']) {
      expect(workspace).toContain(`label: '${label}'`);
    }
  });

  it('keeps Command Centre enterprise KPIs as divs and retains all required sections', () => {
    const start = commandCentre.indexOf('data-contract-surface="command-centre-kpis"');
    const end = commandCentre.indexOf('<section', start + 1);
    const kpiBlock = commandCentre.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(kpiBlock).toContain('data-testid="kpi-loading"');
    expect(kpiBlock).toContain('data-testid="kpi-ready"');
    expect(kpiBlock).toContain('data-testid="kpi-unavailable"');
    expect(kpiBlock).not.toContain('<Link key={label}');
    expect(commandCentre).toContain('Critical attention');
    expect(commandCentre).toContain('Operational queue');
    expect(commandCentre).toContain('Administrative activity');
    expect(commandCentre).toContain("const KPI_LABELS = ['Active companies', 'Open jobs', 'Pending approvals', 'Unpaid invoices'] as const;");
  });

  it('locks Operations Control Centre, Jobs, Drivers and Fleet without forbidden one-column grid collapse', () => {
    for (const label of ['Active Jobs', 'Drivers Online', 'Fleet Health', 'Late Deliveries', 'Revenue Today', 'Urgent Requests']) {
      expect(cockpit).toContain(`label="${label}"`);
    }
    for (const label of ['Driver Accepted Job', 'Pickup Completed', 'Delivery Late', 'Vehicle Idle', 'Customer Changed Address']) {
      expect(cockpit).toContain(`label: '${label}'`);
    }
    expect(cockpit).toContain('Quick Actions');
    expect(operationalMap).toContain('Live operational map UK and Ireland');
    expect(cockpit).toContain('View details');
    expect(cockpit).toContain('Assign driver');
    expect(cockpit).toContain('View profile');
    expect(cockpit).toContain('Assign job');
    expect(cockpitCss).toContain('.jobGrid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr))');
    expect(cockpitCss).toContain('.driverGrid { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr))');
    expect(cockpitCss).toContain('.fleetGrid { display: grid; grid-template-columns: repeat(4, minmax(280px, 1fr))');
    const media = cockpitCss.slice(cockpitCss.indexOf('@media'));
    expect(media).not.toContain('.jobGrid');
    expect(media).not.toContain('.driverGrid');
    expect(media).not.toContain('.fleetGrid');
    expect(masterCss).toContain('--sa-v2-button: 12px 18px');
  });

  it('preserves the full All Jobs table and restricted status allowlists', () => {
    expect(allJobs).toContain('<SuperAdminLiveTablePage<Row>');
    for (const label of ['Route', 'Status', 'Posting company', 'Awarded company', 'Bids', 'Created']) {
      expect(allJobs).toContain(`label: '${label}'`);
    }
    expect(allJobs).toContain("new Set(['posted', 'cancelled', 'delivered'])");
    expect(driverAvailability).toContain("new Set(['available', 'offline'])");
  });

  it('preserves truthful vehicle status', () => {
    expect(vehicleRegistry).toContain("import { vehicleStatus } from '@/app/super-admin/fleet/vehicleStatus'");
    expect(vehicleStatus({ current_status: null, status: 'inactive', is_available: true })).toBe('WAITING FOR NEXT JOB (AVAILABLE)');
    expect(vehicleStatus({ current_status: 'maintenance', status: 'active', is_available: false })).toBe('MAINTENANCE');
    expect(vehicleStatus({ current_status: null, status: 'suspended', is_available: false })).toBe('SUSPENDED');
    expect(vehicleStatus({ current_status: null, status: null, is_available: null })).toBe('UNKNOWN');
  });

  it('keeps Active Companies exact labels', () => {
    expect(activeCompanies).toContain("['Company Name', 'Reg. Number', 'Email', 'Type', 'Status', 'Created']");
  });

  it('renders every required Finance v2 surface without inventing absent datasets', () => {
    for (const label of ["Today's Revenue", 'Expenses', 'Profit', 'Pending Invoices', 'Weekly Earnings', 'Expense Breakdown', 'Top Clients']) {
      expect(finance).toContain(label);
    }
    expect(finance).toContain("gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'");
    expect(finance).toContain('No authoritative platform expense ledger');
    expect(finance).toContain('No authoritative ranked client dataset');
    expect(finance).toContain('Unavailable');
  });

  it('keeps Compliance and Support exact visible contracts', () => {
    expect(insurance).toContain('title="Insurance"');
    expect(licences).toContain('title="Operator Licences"');
    for (const file of [insurance, licences]) {
      expect(file).toContain('>Review docs</Link>');
      expect(file).toContain('>Request update</button>');
    }
    for (const label of ['Ticket ID', 'Company', 'Type', 'Severity', 'Status', 'Created']) expect(support).toContain(`label: '${label}'`);
    for (const action of ['Open', 'Assign', 'Resolve']) expect(support).toContain(action);
    expect(support).toContain("action: 'resolve'");
    expect(support).not.toContain("action: 'close'");
    expect(support).not.toContain("action: 'reopen'");
    expect(supportApi).toContain("action: z.enum(['investigating', 'resolve', 'close', 'reopen'])");
    expect(masterCss).toContain('--sa-v2-table-action: 0 12px');
  });

  it('locks Platform navigation to five visible destinations and Global Settings', () => {
    const platform = workspace.slice(workspace.indexOf("{ id: 'platform'"), workspace.indexOf('  ],\n};'));
    for (const label of ['Global Settings', 'Legal & Agreements', 'Access Matrix', 'Feature Flags', 'Audit Logs']) {
      expect(platform).toContain(`label: '${label}'`);
    }
    expect(platform).not.toContain("label: 'All Users'");
    expect(platform).not.toContain("label: 'Platform Admins'");
    expect(globalSettings).toContain('Global Settings');
    expect(usersIndex).toContain("redirect('/super-admin/settings/roles-permissions')");
  });

  it('locks pager and compact table-action spacing separately', () => {
    expect(liveTable).toContain('data-pager-button="true"');
    expect(liveTable).toContain("padding: '0 14px'");
    expect(masterCss).toContain('--sa-v2-pager: 0 14px');
    expect(masterCss).toContain('--sa-v2-table-action: 0 12px');
  });

  it('runs the v2 checker for PR 505, 506 and validation PR 509', () => {
    expect(releaseGate).toContain("['505', '506', '509']");
    expect(releaseGate).toContain("'__tests__/superAdminMasterV2Contract.test.ts'");
    expect(master).toContain('MASTER CONTRACT FINAL v2');
    expect(master).toContain('PR #509 este validation-only');
  });
});
