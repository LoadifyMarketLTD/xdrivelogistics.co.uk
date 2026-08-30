import fs from 'node:fs';
import path from 'node:path';

describe('CX nearby availability workspace contract', () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/live-availability/page.tsx'),
    'utf8',
  );
  const api = fs.readFileSync(
    path.join(process.cwd(), 'app/api/availability/nearby/route.ts'),
    'utf8',
  );

  it('surfaces the existing nearby availability backend in a dedicated Exchange view', () => {
    expect(page).toContain("fetch('/api/availability/nearby'");
    expect(page).toContain("type Tab = 'live' | 'future' | 'nearby';");
    expect(page).toContain('Nearby Exchange');
    expect(page).toContain("position.scope === 'exchange'");
    expect(page).toContain("title=\"Who's nearby\"");
  });

  it('shows operational vehicle capability without inventing driver identity', () => {
    expect(page).toContain('position.vehicle_type');
    expect(page).toContain('position.payload_kg');
    expect(page).toContain('position.pallets_capacity');
    expect(page).toContain('position.has_tail_lift');
    expect(page).not.toContain('position.driver_id ??');
    expect(page).not.toContain('position.driver_id ||');
  });

  it('explains and preserves the Exchange privacy boundary', () => {
    expect(page).toContain('rounded Exchange area');
    expect(page).toContain('driver identity is not disclosed');
    expect(api).toContain("scope: 'exchange'");
    expect(api).toContain('lat: Number(row.exchange_lat)');
    expect(api).toContain('lng: Number(row.exchange_lng)');
    expect(api).not.toContain("scope: 'exchange',\n      driver_id");
  });

  it('does not broaden eligibility beyond opt-in available resources without active work', () => {
    expect(api).toContain("availability_status ?? '').toLowerCase() === 'available'");
    expect(api).toContain('driversWithActiveJobs.has(driverId)');
    expect(page).toContain('Only opt-in, currently available resources without an active job appear here.');
  });
});
