import fs from 'node:fs';
import path from 'node:path';

describe('Android On My Way tracking readiness contract', () => {
  const routePath = path.join(
    process.cwd(),
    'app/api/driver/mobile/jobs/[id]/[action]/route.ts'
  );
  const route = fs.readFileSync(routePath, 'utf8');

  test('gates pickup departure on a fresh location for the same job and driver', () => {
    expect(route).toContain("if (action === 'on-my-way-pickup')");
    expect(route).toContain('ON_MY_WAY_TRACKING_FRESHNESS_MS = 2 * 60_000');
    expect(route).toContain(".from('driver_locations')");
    expect(route).toContain(".eq('job_id', id)");
    expect(route).toContain(".eq('driver_id', driver.driverId)");
    expect(route).toContain(".gte('recorded_at', freshSince)");
    expect(route).toContain(".order('recorded_at', { ascending: false })");
  });

  test('fails closed before lifecycle mutation when tracking is not ready', () => {
    const readinessGate = route.indexOf("if (action === 'on-my-way-pickup')");
    const lifecycleMutation = route.indexOf("scoped.rpc('driver_update_job_status_atomic'");

    expect(readinessGate).toBeGreaterThanOrEqual(0);
    expect(lifecycleMutation).toBeGreaterThan(readinessGate);
    expect(route).toContain('Live tracking is not ready. Enable Precise Location and Android Location Services');
    expect(route).toContain('return respond(409');
  });
});
