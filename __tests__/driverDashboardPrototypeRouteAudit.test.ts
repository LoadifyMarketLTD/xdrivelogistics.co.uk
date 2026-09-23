import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver Dashboard prototype and route audit', () => {
  const topShell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
  const page = read('app/driver/page.tsx');
  const css = read('app/driver/driver-dashboard-prototype-exact.css');

  it('keeps Dashboard as the first Driver navbar destination and routes it to /driver', () => {
    const dashboard = "{ id: 'dashboard', label: 'Dashboard', href: '/driver' }";
    const directory = "{ id: 'directory', label: 'Directory', href: '/driver/directory' }";
    expect(topShell).toContain(dashboard);
    expect(topShell).toContain(directory);
    expect(topShell.indexOf(dashboard)).toBeLessThan(topShell.indexOf(directory));
  });

  it('uses the literal 17883 Dashboard V2 structure', () => {
    for (const marker of ['xd2-hero', 'xd2-kpis', 'xd2-primary-grid', 'xd2-workboard', 'xd2-readiness', 'xd2-secondary-grid', 'xd2-finance', 'xd2-bottom-grid']) {
      expect(page).toContain(marker);
    }
    expect(page).toContain('Today at a glance');
    expect(page).toContain('Operational workboard');
    expect(page).toContain('Commercial position');
    expect(page).toContain('Performance & evidence');
    expect(page).toContain('Driver workflow');
    expect(page).toContain('Latest bookings');
    expect(page).not.toContain('<span>Quote activity</span>');
    expect(page).not.toContain('<span>Recent completed work</span>');
    expect(page).not.toContain('<span>Status & availability</span>');
    expect(page).not.toContain('<span>Canonical active vehicle</span>');
    expect(page).not.toContain('<span>Journey & position</span>');
  });

  it('keeps dashboard shortcuts on real Driver routes', () => {
    for (const route of ['/driver/history', '/driver/jobs', '/driver/loads', '/driver/availability', '/driver/vehicles', '/driver/documents', '/driver/returns']) {
      expect(page).toContain(route);
    }
  });

  it('does not move prototype fake data or company-only Fleet content into Driver Dashboard', () => {
    for (const fake of ['Available drivers', 'Sub-contract spend', 'Accounts payable', 'North West Freight Ltd']) {
      expect(page).not.toContain(fake);
    }
    expect(page.toLowerCase()).not.toContain('my fleet');
  });

  it('keeps the approved six-card command strip and functional workboard tabs', () => {
    expect(css).toContain('.xd2-kpis');
    expect(css).toContain('.xd2-kpi');
    for (const label of ['Needs Attention', 'Upcoming Work', 'Live Jobs', 'Matching Loads', 'Document Alerts', 'Exceptions']) {
      expect(page).toContain(label);
    }
    for (const tab of ['Needs attention', 'Upcoming', 'Live jobs', 'Documents', 'Exceptions', 'All work']) {
      expect(page).toContain(tab);
    }
    expect(page).toContain('setWorkboardView');
  });

  it('keeps lifecycle and marketplace authority unchanged', () => {
    expect(page).toContain("supabase.rpc('driver_update_job_status_atomic'");
    expect(page).toContain("fetch('/api/driver/marketplace/loads'");
    expect(page).toContain("fetch('/api/driver/vehicles'");
  });
});
