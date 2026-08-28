import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark driver booking history', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/jobs/route.ts'),
    'utf8',
  );

  it('defaults completed booking history to the past year', () => {
    expect(source).toContain("searchParams.get('historyDays') ?? 365");
    expect(source).toContain('Math.min(365');
    expect(source).toContain("query.gte('updated_at', since)");
  });

  it('supports cursor pagination for high-volume drivers', () => {
    expect(source).toContain("searchParams.get('cursor')");
    expect(source).toContain("query.lt('updated_at', cursor)");
    expect(source).toContain('nextCursor');
  });

  it('keeps history assignment-gated to the authenticated driver', () => {
    expect(source).toContain(".eq('assigned_driver_id', driver.driverId)");
  });
});
