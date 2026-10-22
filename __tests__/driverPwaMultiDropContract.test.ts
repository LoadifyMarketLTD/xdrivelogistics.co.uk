import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Driver PWA multi-stop execution', () => {
  it('uses ordered persisted stop transitions rather than a simulated UI state', () => {
    const page = source('app/m/driver/bookings/[id]/page.tsx');
    const endpoint = source('app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
    expect(page).toContain("perform('stop-status'");
    expect(page).toContain("status: 'arrived'");
    expect(page).toContain("status: 'completed'");
    expect(page).toContain('earlierComplete');
    expect(page).toContain('stopCompletionBlocked');
    expect(endpoint).toContain("const allowedNext = new Set(['arrived', 'completed'])");
    expect(endpoint).toContain('Complete the earlier stops before arriving at this stop.');
  });

  it('attaches collection-stop photos to the correct stop-scoped storage prefix', () => {
    const evidence = source('app/m/driver/bookings/[id]/BookingEvidence.tsx');
    const endpoint = source('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
    const status = source('app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
    expect(evidence).toContain("'x-xdrive-stop-id'");
    expect(evidence).toContain('stop_id: stopId');
    expect(evidence).toContain('export function StopCollectionHandover');
    expect(endpoint).toContain('`stops/${stopId}/${category}`');
    expect(status).toContain('verifyStopEvidence');
    expect(status).toContain('At least one collection photo is required for this stop.');
  });
});
