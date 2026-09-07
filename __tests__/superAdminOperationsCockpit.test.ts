import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const route = source('app/api/super-admin/operations-cockpit/route.ts');
const page = source('app/super-admin/operations/control-centre/page.tsx');
const map = source('app/super-admin/_components/SuperAdminOperationalMap.tsx');
const shell = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');

describe('Super Admin operations cockpit', () => {
  it('requires the canonical active Platform Owner guard', () => {
    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain('Forbidden: active Platform Owner required.');
  });

  it('exposes the requested visual operations modules from live platform sources', () => {
    for (const text of [
      'Active Jobs', 'Drivers Online', 'Fleet Health', 'Late Deliveries', 'Revenue Today', 'Urgent Requests',
      'Live Operational Map', 'Job Management', 'Driver Control Center', 'Fleet Overview', 'Finance & Reports', 'Admin Tools', 'Quick Actions',
    ]) expect(page).toContain(text);
    expect(shell).toContain("href: '/super-admin/operations/control-centre'");
  });

  it('uses real location and cached traffic-ETA data without dashboard provider calls', () => {
    expect(route).toContain(".from('driver_locations')");
    expect(route).toContain(".from('job_tracking_eta_snapshots')");
    expect(route).toContain('providerCallsTriggered: false');
    expect(route).not.toContain('api.mapbox.com');
    expect(route).not.toContain('api.postcodes.io');
    expect(page).toContain('this page triggers no routing-provider calls');
  });

  it('does not fabricate unsupported mechanical or profitability data', () => {
    expect(route).toContain('mileage: null');
    expect(route).toContain('service_due: null');
    expect(route).toContain('driverPayments: null');
    expect(route).toContain('profitabilityPerRoute: null');
    expect(page).toContain('Mileage <strong>Unavailable</strong>');
    expect(page).toContain('Service due <strong>Unavailable</strong>');
  });

  it('does not expose direct reassignment, cancellation or backup restore mutations', () => {
    expect(page).toContain("<button disabled title='No governed Platform Owner reassignment mutation");
    expect(page).toContain("<button disabled title='Cancellation must use the governed job workflow");
    expect(route).toContain('backupRestoreDirectAction: false');
    expect(page).not.toContain("method:'PATCH'");
    expect(page).not.toContain("method:'POST'");
    expect(page).not.toContain("method:'DELETE'");
  });

  it('renders status-aware vehicle pins, active-job pins, routes and regional zoom presets', () => {
    expect(map).toContain("online: '#16A34A'");
    expect(map).toContain("busy: '#F5A300'");
    expect(map).toContain("offline: '#DC2626'");
    expect(map).toContain("const JOB_COLOR = '#1D57D8'");
    expect(map).toContain('L.polyline');
    for (const region of ['London', 'Midlands', 'North', 'UK']) expect(map).toContain(`label: '${region}'`);
  });
});
