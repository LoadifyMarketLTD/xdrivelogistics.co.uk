import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261027231500_optional_pickup_photos_mandatory_handover.sql');
const mobileHandover = read('app/api/driver/mobile/jobs/[id]/handover/route.ts');
const mobileStop = read('app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
const webStop = read('app/api/driver/web/jobs/[id]/webStopStatus.ts');

describe('optional collection photos with mandatory handover and protected delivery', () => {
  it('allows zero collection photos but still requires a recorded handover', () => {
    expect(migration).toContain("IF NEW.collection_handover IS NULL OR jsonb_typeof(NEW.collection_handover) <> 'object'");
    expect(migration).toContain("IF jsonb_typeof(v_handover_photos) <> 'array' THEN");
    expect(migration).not.toContain('IF v_photo_count < 1 THEN');
    expect(migration).not.toContain('OR jsonb_array_length(v_handover_photos) < 1');
    expect(migration).toContain("IF NOT COALESCE(NEW.pickup_photos, '[]'::jsonb) @> v_handover_photos THEN");
    expect(migration).toContain('IF v_photo_count > 10 THEN');
  });

  it('preserves accepted/completed audit events and required delivery POD fields', () => {
    expect(migration).toContain("WHEN 'accepted' THEN 'accepted'");
    expect(migration).toContain("WHEN 'completed' THEN 'completed'");
    expect(migration).not.toContain("WHEN 'accepted' THEN 'note'");
    expect(migration).not.toContain("WHEN 'completed' THEN 'note'");
    expect(migration).toContain('At least one delivery photo is required.');
    expect(migration).toContain('Recipient signature is required.');
    expect(migration).toContain('Recipient name is required.');
  });

  it('requires collection handover on web and mobile stops, not a collection photo', () => {
    for (const route of [mobileStop, webStop]) {
      expect(route).toContain('Collection stop handover is required.');
      expect(route).not.toContain('At least one collection photo is required for this stop.');
      expect(route).toContain('verifyStopEvidence');
      expect(route).toContain('if (handover) update.handover = handover');
    }
    expect(mobileHandover).toContain('collection_handover: handover');
    expect(mobileHandover).toContain('...(photoPaths.length ? { collection_photo_url: photoPaths[0] } : {})');
  });

  it('rejects malformed evidence and ensures driver ownership remains server-side', () => {
    expect(mobileHandover).toContain('Too many or invalid collection evidence files.');
    expect(mobileStop).toContain('Too many or invalid stop evidence files.');
    expect(webStop).toContain('Too many or invalid stop evidence files.');
    for (const route of [mobileHandover, mobileStop, webStop]) {
      expect(route).toContain("path.includes('..')");
      expect(route).toContain("path.includes('://')");
      expect(route).toContain('.eq(\'assigned_driver_id\', driver.driverId)');
    }
  });
});
