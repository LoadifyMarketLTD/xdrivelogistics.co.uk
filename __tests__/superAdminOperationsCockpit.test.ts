import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const route = source('app/api/super-admin/operations-cockpit/route.ts');
const page = source('app/super-admin/operations/control-centre/page.tsx');
const map = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');
const shell = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');

describe('Super Admin operations cockpit current contract', () => {
  it('requires the canonical active Platform Owner guard', () => {
    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain('Forbidden: active Platform Owner required.');
  });

  it('exposes current live operational modules and navigation', () => {
    for (const label of [
      'Active Jobs', 'Drivers Online', 'Fleet Health', 'Late Deliveries', 'Revenue Today', 'Urgent Requests',
      'Live Operational Map', 'Jobs Management', 'Drivers Center', 'Fleet Overview', 'Finance Dashboard', 'Quick Actions',
    ]) expect(page).toContain(label);
    expect(shell).toContain("href: '/super-admin/operations/control-centre'");
  });

  it('uses canonical location and cached ETA sources without provider calls', () => {
    expect(route).toContain(".from('driver_locations')");
    expect(route).toContain(".from('driver_availability_presence')");
    expect(route).toContain(".from('job_tracking_eta_snapshots')");
    expect(route).toContain('providerCallsTriggered: false');
    expect(route).not.toContain('api.mapbox.com');
    expect(route).not.toContain('api.postcodes.io');
  });

  it('reports unsupported mechanical and profitability data as unavailable', () => {
    expect(route).toContain('mileage: null');
    expect(route).toContain('service_due: null');
    expect(route).toContain('driverPayments: null');
    expect(route).toContain('profitabilityPerRoute: null');
    expect(page).toContain('Mileage');
    expect(page).toContain('Service Due');
    expect(page).toContain('Unavailable');
  });

  it('keeps dangerous direct mutations out of the cockpit', () => {
    expect(route).toContain('backupRestoreDirectAction: false');
    expect(page).not.toContain("method:'PATCH'");
    expect(page).not.toContain("method:'POST'");
    expect(page).not.toContain("method:'DELETE'");
  });

  it('renders privacy-safe operational map states and regional presets', () => {
    for (const color of ['#1A73E8', '#34A853', '#FBBC05', '#EA4335']) expect(map).toContain(color);
    expect(map).toContain('driverOperationalColor');
    expect(map).toContain('L.polyline');
    for (const region of ['London', 'Midlands', 'North', 'UK']) expect(map).toContain(`label: '${region}'`);
  });
});
