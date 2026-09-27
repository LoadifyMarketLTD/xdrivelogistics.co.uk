import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver Dashboard prototype and route audit', () => {
  const topShell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
  const page = read('app/driver/page.tsx');
  const css = read('app/driver/driver-prototype-parity.css');

  it('keeps Dashboard as the first Driver navbar destination and routes it to /driver', () => {
    const dashboard = "{ id: 'dashboard', label: 'Dashboard', href: '/driver' }";
    const directory = "{ id: 'directory', label: 'Directory', href: '/driver/directory' }";
    expect(topShell).toContain(dashboard);
    expect(topShell).toContain(directory);
    expect(topShell.indexOf(dashboard)).toBeLessThan(topShell.indexOf(directory));
  });

  it('uses the current compact Driver operational-register structure', () => {
    for (const marker of ['driver-prototype-dashboard', 'driver-dashboard-statusbar', 'driver-dashboard-register', 'driver-dashboard-tabs', 'driver-dashboard-readiness']) {
      expect(page).toContain(marker);
    }
    expect(page).toContain('My Work');
    expect(page).toContain('Recent Bookings');
    expect(page).toContain('Driver & Vehicle Readiness');
    expect(page).not.toContain('xd2-hero');
    expect(page).not.toContain('xd2-kpis');
    expect(page).not.toContain('xd2-primary-grid');
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

  it('keeps the six-signal statusbar and functional workboard tabs', () => {
    expect(css).toContain('.driver-dashboard-statusbar');
    for (const label of ['Availability', 'Active vehicle', 'Needs attention', 'Upcoming work', 'Live jobs', 'Matching loads']) {
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
