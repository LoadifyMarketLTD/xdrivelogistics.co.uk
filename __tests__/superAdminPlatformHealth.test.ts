import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { summarizePlatformHealth, type PlatformHealthCheck } from '../app/api/super-admin/_lib/platformHealth';

const check = (service: string, status: PlatformHealthCheck['status']): PlatformHealthCheck => ({
  service,
  status,
  latencyMs: 10,
  detail: `${service} ${status}`,
});

describe('Super Admin canonical platform health summary', () => {
  it('reports a real zero only when all canonical health checks are healthy', () => {
    const summary = summarizePlatformHealth([
      check('Database', 'healthy'),
      check('Storage', 'healthy'),
      check('Notifications', 'healthy'),
    ]);

    expect(summary).toMatchObject({
      determined: true,
      totalChecks: 3,
      healthyCount: 3,
      degradedCount: 0,
      errorCount: 0,
      unhealthyCount: 0,
      overall: 'healthy',
    });
  });

  it('counts degraded and error checks instead of masking them as healthy', () => {
    const summary = summarizePlatformHealth([
      check('Database', 'healthy'),
      check('Storage', 'degraded'),
      check('Notifications', 'error'),
    ]);

    expect(summary).toMatchObject({
      determined: true,
      totalChecks: 3,
      healthyCount: 1,
      degradedCount: 1,
      errorCount: 1,
      unhealthyCount: 2,
      overall: 'error',
    });
  });

  it('fails closed to unknown when no health sources can be evaluated', () => {
    const summary = summarizePlatformHealth([]);

    expect(summary).toMatchObject({
      determined: false,
      totalChecks: 0,
      unhealthyCount: null,
      overall: 'unknown',
    });
  });

  it('keeps Command Centre wired to the canonical health runner and removes the stale placeholder', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/super-admin/command-centre/route.ts'), 'utf8');
    expect(route).toContain("runPlatformHealthChecks");
    expect(route).toContain("Platform health snapshot unavailable — not reported as zero.");
    expect(route).not.toContain('Health-check integration pending (PR-4.1)');
  });

  it('keeps the Platform Health endpoint on the same canonical runner', () => {
    const route = readFileSync(resolve(process.cwd(), 'app/api/super-admin/health/route.ts'), 'utf8');
    expect(route).toContain('runPlatformHealthChecks');
    expect(route).toContain('summary');
  });
});
