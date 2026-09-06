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
const navbar = source('app/super-admin/_components/SuperAdminNavbar.tsx');
const commandCentre = source('app/super-admin/page.tsx');
const cockpit = source('app/super-admin/operations/control-centre/page.tsx');
const cockpitCss = source('app/super-admin/operations/control-centre/page.module.css');
const operationalMap = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');
const allJobs = source('app/super-admin/operations/jobs/page.tsx');
const liveTable = source('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
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

const v2ForbiddenOnTouchedSurfaces = ['#F5F7FA', '#4A4A4A', '#E0E3E7'] as const;

describe('MASTER CONTRACT FINAL v2 — Super Admin visual/source compliance', () => {
  it('loads the normative v2 master layer after earlier Super Admin layers', () => {
    const lightIndex = layout.indexOf("import './super-admin-light.css'");
    const hardeningIndex = layout.indexOf("import './super-admin-light-hardening.css'");
    const visualIndex = layout.indexOf("import './super-admin-visual-contract.css'");
    const masterIndex = layout.indexOf("import './super-admin-master-contract.css'");
    expect(lightIndex).toBeGreaterThanOrEqual(0);
    expect(hardeningIndex).toBeGreaterThan(lightIndex);
    expect(visualIndex).toBeGreaterThan(hardeningIndex);
    expect(masterIndex).toBeGreaterThan(visualIndex);
  });

  it('locks exact v2 geometry, typography, spacing and palette', () => {
    for (const required of [
      '--sa-v2-radius: 8px',
      '--sa-v2-shadow: 0px 2px 6px rgba(0,0,0,0.08)',
      '--sa-v2-container: 24px',
      '--sa-v2-button: 12px 18px',
      '--sa-v2-chip: 4px 10px',
      '--sa-v2-pager: 0 14px',
      '--sa-v2-table-action: 0 12px',
      '#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#8A9099', '#FFFFFF',
    ]) expect(masterContract).toContain(required);
    expect(masterContract).toContain('font-size: 20px !important');
    expect(masterContract).toContain('font-weight: 700 !important');
    expect(masterContract).toContain('font-size: 16px !important');
    expect(masterContract).toContain('font-weight: 500 !important');
    expect(masterContract).toContain('width: 24px !important');
    expect(masterContract).toContain('height: 24px !important');
    expect(visualContract).toContain('--enterprise-button-padding: 12px 18px');
    expect(visualContract).toContain('--enterprise-pager-padding: 0 14px');
    expect(visualContract).toContain('--enterprise-table-action-padding: 0 12px');
  });

  it('does not re-emit pre-v2 neutral tokens on the v2-touched surfaces', () => {
    for (const [name, file] of [
      ['master', masterContract],
      ['visual', visualContract],
      ['directory', directoryCss],
      ['cockpit', cockpitCss],
      ['live table', liveTable],
      ['support', supportTickets],
      ['finance', finance],
    ] as const) {
      for (const forbidden of v2ForbiddenOnTouchedSurfaces) {
        expect(file, `${name} still emits ${forbidden}`).not.toContain(forbidden);
      }
    }
    expect(masterDocument).toContain('Legacy value removal is progressive across historical source');
  });

  it('makes Command Centre KPI cards non-navigable enterprise divs in every state', () => {
    const start = commandCentre.indexOf('data-contract-surface="command-centre-kpis"');
    const end = commandCentre.indexOf('<section', start + 1);
    const kpiSection = commandCentre.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(kpiSection).toContain('data-testid="kpi-loading"');
    expect(kpiSection).toContain('data-testid="kpi-ready"');
    expect(kpiSection).toContain('data-testid="kpi-unavailable"');
    expect(kpiSection).toContain('<div key={label} data-card="true" data-testid="kpi-ready"');
    expect(kpiSection).not.toContain('<Link key={label}');
    for (const label of ['Critical attention', 'Operational queue', 'Administrative activity']) expect(commandCentre).toContain(label);
  });

  it('keeps navbar and Directory fixed without mobile navigation or responsive Directory collapse', () => {
    expect(navbar).not.toContain('Hamburger');
    expect(navbar).not.toContain('MobileHamburgerMenu');
    expect(masterContract).not.toContain('@media');
    expect(directoryCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(directoryCss).toContain('grid-template-rows: repeat(3, auto)');
    expect(directoryCss).not.toContain('@media');
    expect(directoryCss).toContain('.areaIcon svg { width: 24px; height: 24px; }');
    for (const label of ['Dashboard', 'Marketplace', 'Operations', 'Fleet', 'Companies', 'Finance', 'Compliance', 'Support', 'Platform']) {
      expect(workspace).toContain(`label: '${label}'`);
    }
  });

  it('keeps Operations Control Centre exact and prevents Jobs/Drivers/Fleet one-column collapse', () => {
    for (const label of ['Active Jobs', 'Drivers Online', 'Fleet Health', 'Late Deliveries', 'Revenue Today', 'Urgent Requests']) expect(cockpit).toContain(`label="${label}"`);
    for (const label of ['Driver Accepted Job', 'Pickup Completed', 'Delivery Late', 'Vehicle Idle', 'Customer Changed Address']) expect(cockpit).toContain(`label: '${label}'`);
    expect(cockpit).toContain('Quick Actions');
    expect(operationalMap).toContain('Live operational map UK and Ireland');
    expect(cockpitCss).toContain('.jobGrid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr))');
    expect(cockpitCss).toContain('.driverGrid { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr))');
    expect(cockpitCss).toContain('.fleetGrid { display: grid; grid-template-columns: repeat(4, minmax(280px, 1fr))');
    const media = cockpitCss.slice(cockpitCss.indexOf('@media'));
    expect(media).not.toContain('.jobGrid');
    expect(media).not.toContain('.driverGrid');
    expect(media).not.toContain('.fleetGrid');
    const controls = cockpitCss.slice(cockpitCss.indexOf('.button,'), cockpitCss.indexOf('.alert'));
    expect(controls).toContain('padding: 12px 18px;');
    expect(controls).toContain('font-size: 16px;');
    expect(controls).toContain('font-weight: 500;');
  });

  it('keeps All Jobs, status allowlists and Vehicle Registry truth-preserving', () => {
    expect(allJobs).toContain('<SuperAdminLiveTablePage<Row>');
    for (const label of ['Route', 'Status', 'Posting company', 'Awarded company', 'Bids', 'Created']) expect(allJobs).toContain(`label: '${label}'`);
    expect(allJobs).toContain("new Set(['posted', 'cancelled', 'delivered'])");
    expect(driverAvailability).toContain("new Set(['available', 'offline'])");
    expect(vehicleRegistry).toContain("import { vehicleStatus } from '@/app/super-admin/fleet/vehicleStatus'");
    expect(vehicleStatus({ current_status: null, status: 'inactive', is_available: true })).toBe('WAITING FOR NEXT JOB (AVAILABLE)');
    expect(vehicleStatus({ current_status: 'maintenance', status: 'active', is_available: false })).toBe('MAINTENANCE');
    expect(vehicleStatus({ current_status: null, status: null, is_available: null })).toBe('UNKNOWN');
  });

  it('locks Active Companies, Finance, Compliance and Support v2 surfaces', () => {
    expect(activeCompanies).toContain("['Company Name', 'Reg. Number', 'Email', 'Type', 'Status', 'Created']");
    for (const label of ["Today's Revenue", 'Expenses', 'Profit', 'Pending Invoices', 'Weekly Earnings', 'Expense Breakdown', 'Top Clients']) expect(finance).toContain(label);
    expect(insurance).toContain('title="Insurance"');
    expect(licences).toContain('title="Operator Licences"');
    for (const file of [insurance, licences]) {
      expect(file).toContain('>Review docs</Link>');
      expect(file).toContain('>Request update</button>');
    }
    const dto = supportTickets.slice(supportTickets.indexOf('type Row ='), supportTickets.indexOf('const actionButtonStyle'));
    for (const forbidden of ['subject:', 'category:', 'priority:', 'resolved_at:', 'closed_at:']) expect(dto).not.toContain(forbidden);
    for (const label of ['Ticket ID', 'Company', 'Type', 'Severity', 'Status', 'Created']) expect(supportTickets).toContain(`label: '${label}'`);
    for (const action of ['Open', 'Assign', 'Resolve']) expect(supportTickets).toContain(action);
    expect(supportTickets).toContain("padding: '0 12px'");
    expect(supportTickets).toContain("action: 'resolve'");
    expect(supportApi).toContain("action: z.enum(['investigating', 'resolve', 'close', 'reopen'])");
  });

  it('locks Platform navigation to five pages and preserves the users redirect', () => {
    const platform = workspace.slice(workspace.indexOf("{ id: 'platform'"), workspace.indexOf('  ],\n};'));
    for (const label of ['Global Settings', 'Legal & Agreements', 'Access Matrix', 'Feature Flags', 'Audit Logs']) expect(platform).toContain(`label: '${label}'`);
    expect(platform).not.toContain('All Users');
    expect(platform).not.toContain('Platform Admins');
    expect(accessMatrix).not.toContain('href="/super-admin/users"');
    expect(usersIndex).toContain("redirect('/super-admin/settings/roles-permissions')");
    expect(globalSettings).toContain('>Global Settings</h1>');
  });

  it('keeps the visual master presentation-only', () => {
    for (const forbidden of ['/broker', '/customer', '/driver', 'fetch(', 'supabase']) expect(masterContract).not.toContain(forbidden);
  });
});
