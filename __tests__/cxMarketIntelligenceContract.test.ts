import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark market intelligence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/market-intelligence/route.ts'),
    'utf8',
  );

  it('keeps Who is Nearby privacy-safe, aggregate-only and reciprocal', () => {
    expect(source).toContain('MIN_CLUSTER_SIZE = 3');
    expect(source).toContain('GRID_DEGREES = 0.1');
    expect(source).toContain(".select('exact_lat,exact_lng,available_until')");
    expect(source).toContain(".eq('visibility', 'exchange')");
    expect(source).toContain('cluster.count >= MIN_CLUSTER_SIZE');
    expect(source).toContain("reason: ownLocation ? null : 'Set Exchange availability to enable nearby competition intelligence.'");
    expect(source).not.toContain('display_name');
    expect(source).not.toContain('exact_lat,exact_lng,driver_id');
  });

  it('reads competitor locations only from exchange-rounded coordinates', () => {
    expect(source).toContain(".select('driver_id,company_id,exchange_lat,exchange_lng,available_until')");
    expect(source).toContain('validCoordinate(row.exchange_lat, row.exchange_lng)');
    expect(source).not.toContain('row.exact_lat');
    expect(source).not.toContain('row.exact_lng');
  });

  it('uses accepted commercial agreements for seven-day PPM intelligence', () => {
    expect(source).toContain(".from('job_commercial_agreements')");
    expect(source).toContain(".select('job_id,agreed_amount,currency,created_at')");
    expect(source).toContain('MIN_RATE_SAMPLES = 5');
    expect(source).toContain("unit: 'per_mile'");
  });

  it('supports a market-intelligence radius up to 300 miles', () => {
    expect(source).toContain('Math.min(300');
    expect(source).toContain('radiusMiles');
  });
});
