import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark market intelligence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/market-intelligence/route.ts'),
    'utf8',
  );

  it('keeps Who is Nearby privacy-safe and aggregate-only', () => {
    expect(source).toContain('MIN_CLUSTER_SIZE = 3');
    expect(source).toContain('GRID_DEGREES = 0.1');
    expect(source).toContain(".eq('visibility', 'exchange')");
    expect(source).toContain('cluster.count >= MIN_CLUSTER_SIZE');
    expect(source).not.toContain('display_name');
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
