import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const layout = source('app/super-admin/layout.tsx');
const visualContract = source('app/super-admin/super-admin-visual-contract.css');
const masterContract = source('app/super-admin/super-admin-master-contract.css');
const directoryCss = source('app/super-admin/_components/SuperAdminCardNavigationShell.module.css');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
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
const globalSettings = source('app/super-admin/settings/global/page.tsx');

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

  it('locks radius, shadow, internal padding, titles and card-links to the exact enterprise values', () => {
    expect(visualContract).toContain('--enterprise-radius: 8px');
    expect(visualContract).toContain('--enterprise-shadow: 0px 2px 6px rgba(0,0,0,0.08)');
    expect(visualContract).toContain('--enterprise-padding: 24px');
    expect(masterContract).toContain('--sa-master-radius: 8px');
    expect(masterContract).toContain('--sa-master-shadow: 0px 2px 6px rgba(0,0,0,0.08)');
    expect(masterContract).toContain('--sa-master-padding: 24px');
    expect(masterContract).toContain('font-family: Inter, Roboto, Arial, sans-serif !important');
    expect(masterContract).toContain('font-size: 20px !important');
    expect(masterContract).toContain('font-weight: 700 !important');
    expect(masterContract).toContain('main a[data-card]');
    expect(masterContract).toContain('a[style*="min-height: 88px"][style*="border"]');
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

  it('locks Jobs Management, Drivers Center and Fleet Overview to their fixed layout contracts', () => {
    expect(cockpitCss).toContain('.jobGrid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr))');
    expect(cockpitCss).toContain('.driverGrid { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr))');
    expect(cockpitCss).toContain('.fleetGrid { display: grid; grid-template-columns: repeat(4, minmax(280px, 1fr))');
    const media = cockpitCss.slice(cockpitCss.indexOf('@media'));
    expect(media).not.toContain('.jobGrid');
    expect(media).not.toContain('.driverGrid');
    expect(media).not.toContain('.fleetGrid');
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

  it('enforces the exact All Jobs status and table contract', () => {
    expect(allJobs).toContain("new Set(['posted', 'cancelled', 'delivered'])");
    for (const label of ['Route', 'Status', 'Posting company', 'Awarded company', 'Bids', 'Created']) {
      expect(allJobs).toContain(`label: '${label}'`);
    }
    expect(formatters).toContain('posted: { bg: BLUE, text: WHITE }');
    expect(formatters).toContain('cancelled: { bg: RED, text: WHITE }');
    expect(formatters).toContain('delivered: { bg: GREEN, text: WHITE }');
    expect(formatters).toContain('available: { bg: GREEN, text: WHITE }');
    expect(formatters).toContain('offline: { bg: GREY, text: WHITE }');
    expect(formatters).toContain('ready: { bg: GREEN, text: WHITE }');
    expect(formatters).toContain('attention: { bg: YELLOW, text: TEXT }');
    expect(formatters).toContain('critical: { bg: RED, text: WHITE }');
  });

  it('completes Vehicle Registry and restricts Driver Availability', () => {
    expect(vehicleRegistry).toContain('WAITING FOR NEXT JOB (AVAILABLE)');
    expect(vehicleRegistry).toContain('function TailLiftIcon()');
    expect(vehicleRegistry).toContain('function GpsIcon()');
    expect(vehicleRegistry).toContain("label: 'Health'");
    expect(driverAvailability).toContain("new Set(['available', 'offline'])");
    expect(driverAvailability).toContain('<StatusChip value={normalized.toUpperCase()} />');
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

  it('keeps the Super Admin Support ticket DTO clean and the visible columns exact', () => {
    const dto = supportTickets.slice(supportTickets.indexOf('type Row ='), supportTickets.indexOf('const actionButtonStyle'));
    for (const forbidden of ['subject:', 'category:', 'priority:', 'resolved_at:', 'closed_at:']) {
      expect(dto).not.toContain(forbidden);
    }
    for (const required of ['type:', 'severity:', 'status:', 'created_at:']) expect(dto).toContain(required);
    for (const label of ['Ticket ID', 'Company', 'Type', 'Severity', 'Status', 'Created']) expect(supportTickets).toContain(`label: '${label}'`);
    for (const action of ['Open', 'Assign', 'Resolve']) expect(supportTickets).toContain(action);
  });

  it('locks Platform navigation to exactly five pages and fixes the Global Settings title', () => {
    const platform = workspace.slice(workspace.indexOf("{ id: 'platform'"), workspace.indexOf('  ],\n};'));
    for (const label of ['Global Settings', 'Legal & Agreements', 'Access Matrix', 'Feature Flags', 'Audit Logs']) {
      expect(platform).toContain(`label: '${label}'`);
    }
    expect(platform).not.toContain('All Users');
    expect(platform).not.toContain('Platform Admins');
    expect((platform.match(/href: '\/super-admin\//g) ?? []).length).toBe(5);
    expect(globalSettings).toContain('>Global Settings</h1>');
  });

  it('contains no cross-workspace selector or mutation behaviour in the master CSS layer', () => {
    for (const forbidden of ['/broker', '/customer', '/driver', 'fetch(', 'supabase']) {
      expect(masterContract).not.toContain(forbidden);
    }
  });
});
