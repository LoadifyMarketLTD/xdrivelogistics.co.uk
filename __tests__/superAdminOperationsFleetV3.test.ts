import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { telemetryFreshness } from '../lib/telemetryFreshness';

const root = process.cwd();
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const liveTable = source('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
const jobLedger = source('app/super-admin/_components/SuperAdminOperationsJobLedger.tsx');
const operationsApi = source('app/api/super-admin/operations/route.ts');
const governanceApi = source('app/api/super-admin/governance/route.ts');
const fleetPositions = source('app/super-admin/operations/fleet-positions/page.tsx');
const vehicles = source('app/super-admin/fleet/vehicles/page.tsx');
const returnJourneys = source('app/super-admin/fleet/return-journeys/page.tsx');

describe('Super Admin Operations and Fleet v3', () => {
  it('classifies telemetry freshness deterministically', () => {
    const now = Date.parse('2026-09-07T16:00:00Z');
    expect(telemetryFreshness('2026-09-07T15:58:00Z', now).state).toBe('fresh');
    expect(telemetryFreshness('2026-09-07T15:50:00Z', now).state).toBe('aging');
    expect(telemetryFreshness('2026-09-07T15:00:00Z', now).state).toBe('stale');
    expect(telemetryFreshness(null, now).state).toBe('unavailable');
  });
  it('uses one canonical jobs ledger for the six operational lifecycle pages', () => {
    for (const mode of ['jobs', 'active-jobs', 'pending-jobs', 'completed-jobs', 'allocations', 'deliveries']) {
      expect(jobLedger).toContain(`'${mode}'`);
    }
    expect(jobLedger).toContain('PlatformEntityLink');
    expect(jobLedger).toContain('entityType="job"');
  });

  it('sets pagination parameters instead of appending duplicates', () => {
    expect(liveTable).toContain("url.searchParams.set('page'");
    expect(liveTable).toContain("url.searchParams.set('limit'");
    expect(liveTable).not.toContain('separator}page=');
  });

  it('exposes real telemetry fields and freshness from the owner operations API', () => {
    for (const field of ['heading', 'speed_mph', 'source', 'source_provider', 'job_id', 'vehicle_id']) {
      expect(operationsApi).toContain(field);
    }
    expect(operationsApi).toContain('telemetryFreshness');
    expect(fleetPositions).toContain('telemetry_freshness');
  });
  it('marks vehicle tracking health using telemetry freshness', () => {
    expect(governanceApi).toContain('telemetryFreshness');
    expect(vehicles).toContain("telemetry_freshness.state === 'stale'");
    expect(vehicles).toContain('Last fix');
  });

  it('preserves Return Journeys as the existing governance read model', () => {
    expect(returnJourneys).toContain('endpoint="/api/super-admin/governance?section=return-journeys"');
    expect(returnJourneys).toContain('Global carrier return-capacity register');
  });
});
