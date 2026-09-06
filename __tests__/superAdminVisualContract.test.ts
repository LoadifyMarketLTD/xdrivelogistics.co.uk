import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vehicleStatus } from '../app/super-admin/fleet/vehicleStatus';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const layout = source('app/super-admin/layout.tsx');
const visualContract = source('app/super-admin/super-admin-visual-contract.css');
const masterContract = source('app/super-admin/super-admin-master-contract.css');
const masterDocument = source('docs/super-admin/MASTER_CONTRACT_FINAL.md');
const directoryCss = source('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const commandCentre = source('app/super-admin/page.tsx');
const cockpit = source('app/super-admin/operations/control-centre/page.tsx');
const cockpitCss = source('app/super-admin/operations/control-centre/page.module.css');
const operationalMap = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');
const formatters = source('app/super-admin/_components/superAdminFormatters.tsx');
const allJobs = source('app/super-admin/operations/jobs/page.tsx');
const vehicleRegistry = source('app/super-admin/fleet/vehicles/page.tsx');
const driverAvailability = source('app/super-admin/operations/driver-availability/page.tsx');
const activeCompanies = source('app/super-admin/companies/active/page.tsx');
const finance = source('app/super-admin/finance/page.tsx');
const insurance = source('app/super-admin/compliance/insurance/page.tsx');
const licences = source('app/super-admin/compliance/operator-licences/page.tsx');
const supportTickets = source('app/super-admin/support/tickets/page.tsx');
const supportApi = source('app/api/super-admin/support/route.ts');
const accessMatrix = source('app/super-admin/settings/roles-permissions/page.tsx');
const usersIndex = source('app/super-admin/users/page.tsx');
const globalSettings = source('app/super-admin/settings/global/page.tsx');

const forbiddenLegacyEmittedTokens = [
  '#0B2F6B',
  '#1D57D8',
  '#F5A300',
  '#1A1F2B',
  '#F4F6F8',
  '#D9E1EA',
  '#64748B',
  '#16A34A',
  '#DC2626',
  "borderRadius: '4px'",
  "fontSize: '22px'",
] as const;

describe('MASTER CONTRACT FINAL — Super Admin', () => {
  it('loads the final master layer after all earlier Super Admin visual layers', () => {
    const lightIndex = layout.indexOf("import './super-admin-light.css'");
    const hardeningIndex = layout.indexOf("import './super-admin-light-hardening.css'");
    const visualIndex = layout.indexOf("import './super-admin-visual-contract.css'");
    const masterIndex = layout.indexOf("import './super-admin-master-contract.css'");
    expect(lightIndex).toBeGreaterThanOrEqual(0);
    expect(hardeningIndex).toBeGreaterThan(lightIndex);
    expect(visualIndex).toBeGreaterThan(hardeningIndex);
    expect(masterIndex).toBeGreaterThan(visualIndex);
  });

  it('locks canonical enterprise tokens and the explicit compact-control exceptions', () => {
    expect(visualContract).toContain('--enterprise-radius: 8px');
    expect(visualContract).toContain('--enterprise-shadow: 0px 2px 6px rgba(0,0,0,0.08)');
    expect(visualContract).toContain('--enterprise-padding: 24px');
    expect(visualContract).toContain('--enterprise-control-padding: 0 14px');
    expect(visualContract).toContain('--enterprise-chip-padding: 4px 10px');
    expect(masterContract).toContain('--sa-master-radius: 8px');
    expect(masterContract).toContain('--sa-master-shadow: 0px 2px 6px rgba(0,0,0,0.08)');
    expect(masterContract).toContain('--sa-master-padding: 24px');
    expect(masterContract).toContain('--sa-master-control-padding: 0 14px');
    expect(masterContract).toContain('--sa-master-chip-padding: 4px 10px');
    expect(masterContract).toContain('font-family: Inter, Roboto, Arial, sans-serif !important');
    expect(masterContract).toContain('font-size: 20px !important');
    expect(masterContract).toContain('font-weight: 700 !important');
    expect(masterDocument).toContain('`24px` is NOT a universal padding value for compact interactive controls.');
    expect(masterDocument).toContain('Status chips/badges: `4px 10px`');
    expect(masterDocument).toContain('Standard compact action/pager buttons: `0 14px`');
  });

  it('makes Command Centre KPI cards non-navigable enterprise divs in every state', () => {
    const start = commandCentre.indexOf('data-contract-surface="command-centre-kpis"');
    const end = commandCentre.indexOf('<section style={{ marginBottom: \'24px\' }}>', start);
    const kpiSection = commandCentre.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(kpiSection).toContain('data-testid="kpi-loading"');
    expect(kpiSection).toContain('data-testid="kpi-ready"');
    expect(kpiSection).toContain('data-testid="kpi-unavailable"');
    expect(kpiSection).toContain('<div key={label} data-card="true" data-testid="kpi-ready"');
    expect(kpiSection).not.toContain('<Link key={label}');
    expect(masterDocument).toContain('Command Centre KPI cards MUST NOT render as `<a>` or Next.js `<Link>`.');
  });

  it('removes known legacy emitted values from the final patched Super Admin surfaces', () => {
    for (const [name, file] of [
      ['Command Centre', commandCentre],
      ['Access Matrix', accessMatrix],
      ['Vehicle Registry', vehicleRegistry],
    ] as const) {
      for (const forbidden of forbiddenLegacyEmittedTokens) {
        expect(file, `${name} still emits forbidden legacy token ${forbidden}`).not.toContain(forbidden);
      }
    }
    expect(masterDocument).toContain('Legacy values appearing only inside compatibility-selector match expressions are not emitted design values');
  });

  it('keeps the Super Admin Directory at exactly 3 × 3 with enterprise cards and 24px icons', () => {
    expect(directoryCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(directoryCss).toContain('grid-template-rows: repeat(3, auto)');
    expect(directoryCss).toContain('.areaCard');
    expect(directoryCss).toContain('padding: 24px');
    expect(directoryCss).toContain('border-radius: 8px');
    expect(directoryCss).toContain('box-shadow: 0px 2px 6px rgba(0,0,0,0.08)');
    expect(directoryCss).toContain('.areaIcon svg { width: 24px; height: 24px; }');
    const media = directoryCss.slice(directoryCss.indexOf('@media'));
    expect(media).not.toContain('.areaGrid');
    for (const label of ['Dashboard', 'Marketplace', 'Operations', 'Fleet', 'Companies', 'Finance', 'Compliance', 'Support', 'Platform']) {
      expect(workspace).toContain(`label: '${label}'`);
    }
  });

  it('enforces the exact Operations Control Centre enterprise surfaces', () => {
    for (const label of ['Active Jobs', 'Drivers Online', 'Fleet Health', 'Late Deliveries', 'Revenue Today', 'Urgent Requests']) {
      expect(cockpit).toContain(`label="${label}"`);
    }
    for (const label of ['Jobs Management', 'Drivers Center', 'Fleet Overview', 'Finance Dashboard', 'Manage Roles', 'View Logs']) {
      expect(cockpit).toContain(`>${label}<`);
    }
    for (const label of ['Driver Accepted Job', 'Pickup Completed', 'Delivery Late', 'Vehicle Idle', 'Customer Changed Address']) {
      expect(cockpit).toContain(`label: '${label}'`);
    }
    expect(cockpit).toContain('View details');
    expect(cockpit).toContain('Assign driver');
    expect(cockpit).toContain('View profile');
    expect(cockpit).toContain('Assign job');
    expect(cockpit).toContain('No driver photo on record');
    expect(cockpit).toContain('No vehicle photo on record');
    expect(cockpit).toContain("Today's Revenue");
    expect(cockpit).toContain('Pending Invoices');
    expect(cockpit).toContain('Weekly Earnings');
  });

  it('treats Jobs Management preview and All Jobs workspace as two distinct layout contracts', () => {
    expect(cockpitCss).toContain('.jobGrid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr))');
    expect(cockpitCss).toContain('.driverGrid { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr))');
    expect(cockpitCss).toContain('.fleetGrid { display: grid; grid-template-columns: repeat(4, minmax(280px, 1fr))');
    const media = cockpitCss.slice(cockpitCss.indexOf('@media'));
    expect(media).not.toContain('.jobGrid');
    expect(media).not.toContain('.driverGrid');
    expect(media).not.toContain('.fleetGrid');
    expect(allJobs).toContain('<SuperAdminLiveTablePage<Row>');
    for (const label of ['Route', 'Status', 'Posting company', 'Awarded company', 'Bids', 'Created']) {
      expect(allJobs).toContain(`label: '${label}'`);
    }
    expect(masterDocument).toContain('Operations Control Centre — Jobs Management Preview');
    expect(masterDocument).toContain('All Jobs — Full Workspace');
  });

  it('keeps the operational map UK + Ireland with the four exact region controls', () => {
    expect(operationalMap).toContain('Live operational map UK and Ireland');
    expect(operationalMap).toContain("{ label: 'London'");
    expect(operationalMap).toContain("{ label: 'Midlands'");
    expect(operationalMap).toContain("{ label: 'North'");
    expect(operationalMap).toContain("{ label: 'UK'");
    expect(operationalMap).toContain("padding: '24px'");
    expect(operationalMap).toContain("borderRadius: '8px'");
  });

  it('enforces page-specific status allowlists while keeping StatusChip generic', () => {
    expect(formatters).toContain('allowedValues?: StatusAllowlist');
    expect(formatters).toContain('if (allowedValues && !normalizeAllowlist(allowedValues).has(normalized))');
    expect(formatters).toContain('data-status-chip="true"');
    expect(allJobs).toContain("new Set(['posted', 'cancelled', 'delivered'])");
    expect(allJobs).toContain('allowedValues={ALL_JOBS_ALLOWED_STATUSES}');
    expect(driverAvailability).toContain("new Set(['available', 'offline'])");
    expect(driverAvailability).toContain('allowedValues={DRIVER_AVAILABILITY_ALLOWED_STATUSES}');
    for (const mapping of [
      'posted: { bg: BLUE, text: WHITE }',
      'cancelled: { bg: RED, text: WHITE }',
      'delivered: { bg: GREEN, text: WHITE }',
      'available: { bg: GREEN, text: WHITE }',
      'offline: { bg: GREY, text: WHITE }',
      'ready: { bg: GREEN, text: WHITE }',
      'attention: { bg: YELLOW, text: TEXT }',
      'critical: { bg: RED, text: WHITE }',
    ]) expect(formatters).toContain(mapping);
  });

  it('keeps Vehicle Registry status truth-preserving for every canonical branch', () => {
    expect(vehicleRegistry).toContain("import { vehicleStatus } from '@/app/super-admin/fleet/vehicleStatus'");
    expect(vehicleRegistry).toContain("label: 'Health'");
    expect(vehicleRegistry).toContain('function TailLiftIcon()');
    expect(vehicleRegistry).toContain('function GpsIcon()');

    expect(vehicleStatus({ current_status: null, status: 'inactive', is_available: true })).toBe('WAITING FOR NEXT JOB (AVAILABLE)');
    expect(vehicleStatus({ current_status: 'waiting for next job (available)', status: 'inactive', is_available: false })).toBe('WAITING FOR NEXT JOB (AVAILABLE)');
    expect(vehicleStatus({ current_status: 'maintenance', status: 'active', is_available: false })).toBe('MAINTENANCE');
    expect(vehicleStatus({ current_status: null, status: 'suspended', is_available: false })).toBe('SUSPENDED');
    expect(vehicleStatus({ current_status: null, status: null, is_available: null })).toBe('UNKNOWN');
    expect(masterDocument).toContain('A non-available vehicle MUST NOT be relabelled AVAILABLE.');
  });

  it('uses the exact Active Companies labels', () => {
    expect(activeCompanies).toContain("['Company Name', 'Reg. Number', 'Email', 'Type', 'Status', 'Created']");
  });

  it('unifies Finance into four enterprise KPIs plus Weekly Earnings', () => {
    for (const label of ["Today's Revenue", 'Expenses', 'Profit', 'Pending Invoices', 'Weekly Earnings']) {
      expect(finance).toContain(label);
    }
    expect(finance).toContain("gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'");
    expect(finance).toContain('boxShadow: T.shadow');
  });

  it('uses the exact Compliance titles and actions without inventing a request-update mutation', () => {
    expect(insurance).toContain('title="Insurance"');
    expect(licences).toContain('title="Operator Licences"');
    for (const file of [insurance, licences]) {
      expect(file).toContain('>Review docs</Link>');
      expect(file).toContain('>Request update</button>');
      expect(file).toContain('aria-disabled="true"');
    }
  });

  it('keeps Support visible scope exact while permitting the richer audited backend lifecycle', () => {
    const dto = supportTickets.slice(supportTickets.indexOf('type Row ='), supportTickets.indexOf('const actionButtonStyle'));
    for (const forbidden of ['subject:', 'category:', 'priority:', 'resolved_at:', 'closed_at:']) {
      expect(dto).not.toContain(forbidden);
    }
    for (const required of ['type:', 'severity:', 'status:', 'created_at:']) expect(dto).toContain(required);
    for (const label of ['Ticket ID', 'Company', 'Type', 'Severity', 'Status', 'Created']) expect(supportTickets).toContain(`label: '${label}'`);
    for (const action of ['Open', 'Assign', 'Resolve']) expect(supportTickets).toContain(action);
    for (const hiddenAction of ['investigating', "action: 'close'", "action: 'reopen'"]) expect(supportTickets).not.toContain(hiddenAction);
    expect(supportTickets).toContain("action: 'resolve'");
    expect(supportApi).toContain("action: z.enum(['investigating', 'resolve', 'close', 'reopen'])");
    expect(masterDocument).toContain('Backend governance may retain audited lifecycle actions `investigating`, `resolve`, `close`, `reopen`.');
  });

  it('locks Platform navigation to exactly five pages and removes the legacy users aggregation from visible navigation', () => {
    const platform = workspace.slice(workspace.indexOf("{ id: 'platform'"), workspace.indexOf('  ],\n};'));
    for (const label of ['Global Settings', 'Legal & Agreements', 'Access Matrix', 'Feature Flags', 'Audit Logs']) {
      expect(platform).toContain(`label: '${label}'`);
    }
    expect(platform).not.toContain('All Users');
    expect(platform).not.toContain('Platform Admins');
    expect((platform.match(/href: '\/super-admin\//g) ?? []).length).toBe(5);
    expect(accessMatrix).not.toContain('href="/super-admin/users"');
    expect(usersIndex).toContain("redirect('/super-admin/settings/roles-permissions')");
    expect(globalSettings).toContain('>Global Settings</h1>');
    expect(masterDocument).toContain('`Removed from nav` does NOT require physical deletion');
  });

  it('contains no cross-workspace selector or mutation behaviour in the master CSS layer', () => {
    for (const forbidden of ['/broker', '/customer', '/driver', 'fetch(', 'supabase']) {
      expect(masterContract).not.toContain(forbidden);
    }
  });
});
