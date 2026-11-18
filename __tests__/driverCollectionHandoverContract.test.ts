import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20260917221950_driver_collection_handover.sql');
const handoverRoute = read('../app/api/driver/mobile/jobs/[id]/handover/route.ts');
const evidenceRoute = read('../app/api/driver/mobile/jobs/[id]/evidence/route.ts');
const actionRoute = read('../app/api/driver/mobile/jobs/[id]/[action]/route.ts');
const stopRoute = read('../app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
const jobsRoute = read('../app/api/driver/mobile/jobs/route.ts');
const mobileLib = read('../app/api/driver/mobile/_lib.ts');

describe('driver collection handover contract', () => {
  it('persists structured job and stop handover snapshots', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS collection_handover jsonb');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS handover jsonb');
    expect(handoverRoute).toContain('At least one collection photo is required.');
    expect(handoverRoute).toContain('collection_handover: handover');
    expect(handoverRoute).toContain('pickup_photos: [...new Set');
  });

  it('keeps evidence server-authoritative and stop-scoped', () => {
    expect(evidenceRoute).toContain("request.headers.get('x-xdrive-stop-id')");
    expect(evidenceRoute).toContain('collection-${category}');
    expect(evidenceRoute).toContain('stops/${stopId}/${category}');
    expect(handoverRoute).toContain('verifyStoragePaths');
    expect(stopRoute).toContain('verifyStopEvidence');
    expect(stopRoute).toContain('if (handover) update.handover = handover');
  });

  it('requires handover before the Driver Mobile loaded transition and exposes it on reads', () => {
    expect(actionRoute).toContain('Complete the collection handover before marking the job loaded.');
    expect(mobileLib).toContain("'collection_handover'");
    expect(mobileLib).toContain('collectionHandover:');
    expect(jobsRoute).toContain('handover: stop.handover');
  });
});
