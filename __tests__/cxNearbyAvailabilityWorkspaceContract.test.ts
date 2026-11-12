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
    expect(page).toContain('/api/availability/nearby?');
    expect(page).toContain("type Tab = Exclude<AvailabilityTab, 'future'> | 'all';");
    expect(page).toContain("matchesAvailabilityFilters, type AvailabilityTab");
    expect(page).toContain('Nearby Exchange');
    expect(page).toContain("position.scope === 'exchange'");
    expect(page).toContain('Other Drivers');
  });

  it('shows operational vehicle capability without inventing driver identity', () => {
    expect(page).toContain('position.vehicle_type');
    expect(api).toContain('payload_kg: vehicle?.payload_kg');
    expect(api).toContain('pallets_capacity: vehicle?.pallets_capacity');
    expect(api).toContain('has_tail_lift: vehicle?.has_tail_lift');
    expect(page).not.toContain('position.driver_id ??');
    expect(page).not.toContain('position.driver_id ||');
  });

  it('explains and preserves the Exchange privacy boundary', () => {
    expect(api).toContain('lat: Number(row.exchange_lat)');
    expect(api).toContain('never the driver');
    expect(api).toContain("scope: 'exchange'");
    expect(api).toContain('lat: Number(row.exchange_lat)');
    expect(api).toContain('lng: Number(row.exchange_lng)');
    expect(api).not.toContain("scope: 'exchange',\n      driver_id");
  });

  it('allows opted-in available drivers with active work while preserving consent', () => {
    expect(api).toContain("availability_status ?? '').toLowerCase() === 'available'");
    expect(api).toContain('driversWithActiveJobs.has(driverId)');
    expect(api).toContain('on_job: driversWithActiveJobs.has(driverId)');
    expect(api).not.toContain('|| driversWithActiveJobs.has(driverId)');
  });
});
