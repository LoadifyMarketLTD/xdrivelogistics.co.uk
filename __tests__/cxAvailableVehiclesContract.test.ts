import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark available vehicles discovery', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/availability/nearby/route.ts'),
    'utf8',
  );

  it('exposes business member identity and vehicle capability for exchange discovery', () => {
    expect(source).toContain('member_name: company.name ?? null');
    expect(source).toContain('member_code: company.company_number ?? null');
    expect(source).toContain('vehicle_type: vehicle?.type ?? null');
    expect(source).toContain('pallets_capacity: vehicle?.pallets_capacity ?? null');
    expect(source).toContain('has_tail_lift: vehicle?.has_tail_lift ?? null');
  });

  it('preserves exact-location privacy for other companies', () => {
    expect(source).toContain("scope: 'exchange'");
    expect(source).toContain('lat: Number(row.exchange_lat)');
    expect(source).toContain('lng: Number(row.exchange_lng)');
    expect(source).not.toContain("scope: 'exchange',\n      driver_id");
    expect(source).not.toContain("scope: 'exchange',\n      lat: Number(row.exact_lat)");
  });

  it('suppresses unavailable and actively executing drivers', () => {
    expect(source).toContain("availability_status ?? '').toLowerCase() === 'available'");
    expect(source).toContain('driversWithActiveJobs.has(driverId)');
  });
});
