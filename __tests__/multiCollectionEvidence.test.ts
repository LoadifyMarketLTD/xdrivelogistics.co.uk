import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926170659_require_canonical_multi_collection_evidence.sql'),'utf8');
const evidenceApi = readFileSync(join(process.cwd(),'app/api/driver/mobile/jobs/[id]/evidence/route.ts'),'utf8');
const handoverApi = readFileSync(join(process.cwd(),'app/api/driver/mobile/jobs/[id]/handover/route.ts'),'utf8');
const driverPage = readFileSync(join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
const adminPage = readFileSync(join(process.cwd(),'app/admin/jobs/[id]/page.tsx'),'utf8');
const dbTypes = readFileSync(join(process.cwd(),'lib/types/database.ts'),'utf8');

describe('multi-photo collection evidence', () => {
  it('uses pickup_photos as the canonical collection evidence list', () => {
    expect(dbTypes).toContain('pickup_photos: string[] | null;');
    expect(dbTypes).toContain('collection_handover: {');
    expect(evidenceApi).toContain('pickup_photos: [...new Set([...existingCollectionPhotos, storagePath])]');
    expect(evidenceApi).toContain('existingCollectionPhotos.length >= 10');
    expect(evidenceApi).toContain('collection_photo_url: existingCollectionPhotos[0] ?? storagePath');
  });

  it('supports up to 10 verified collection photos in handover', () => {
    expect(handoverApi).toContain('const MAX_PHOTOS = 10;');
    expect(handoverApi).toContain('const photoPaths = stringPaths(body.photoPaths, MAX_PHOTOS);');
    expect(handoverApi).toContain('Collection photo evidence could not be verified.');
    expect(handoverApi).toContain('pickup_photos: [...new Set([...existingPhotos, ...photoPaths])]');
  });

  it('requires canonical photo array and verified handover before loaded', () => {
    expect(migration).toContain("v_new_status <> 'loaded'");
    expect(migration).toContain("jsonb_typeof(COALESCE(NEW.pickup_photos, '[]'::jsonb)) <> 'array'");
    expect(migration).toContain('v_photo_count < 1');
    expect(migration).toContain('v_photo_count > 10');
    expect(migration).toContain("NEW.collection_handover IS NULL OR jsonb_typeof(NEW.collection_handover) <> 'object'");
    expect(migration).toContain("NEW.pickup_photos, '[]'::jsonb) @> v_handover_photos");
  });

  it('keeps collection_photo_url only as a compatibility pointer', () => {
    expect(migration).toContain('Legacy consumers may still read collection_photo_url');
    expect(migration).toContain('NEW.collection_photo_url := NEW.pickup_photos ->> 0;');
  });

  it('web driver can take a photo or choose multiple saved images', () => {
    expect(driverPage).toContain('collectionCameraInput');
    expect(driverPage).toContain('collectionGalleryInput');
    expect(driverPage).toContain('multiple hidden onChange={selectCollectionPhotos}');
    expect(driverPage).toContain('Take photo');
    expect(driverPage).toContain('Add photos');
    expect(driverPage).toContain('10 - collectionPhotos.length');
  });

  it('web driver uploads collection evidence through the server-authoritative endpoint', () => {
    expect(driverPage).toContain('/api/driver/mobile/jobs/${encodeURIComponent(jobId)}/evidence');
    expect(driverPage).toContain("'x-xdrive-evidence-kind': 'collection'");
    expect(driverPage).toContain("'x-xdrive-evidence-category': 'photos'");
    expect(driverPage).not.toContain("setCollectionPhoto(await uploadImage(file, 'collection'))");
  });

  it('web loaded transition persists handover then uses the guarded loaded endpoint', () => {
    expect(driverPage).toContain('/api/driver/mobile/jobs/${encodeURIComponent(job.id)}/handover');
    expect(driverPage).toContain('JSON.stringify({ photoPaths: collectionPhotos');
    expect(driverPage).toContain('/api/driver/mobile/jobs/${encodeURIComponent(job.id)}/loaded');
    expect(driverPage).not.toContain('fields.p_collection_photo_url = collectionPhoto');
  });

  it('admin job detail shows the full pickup_photos list with legacy fallback', () => {
    expect(adminPage).toContain('collection_photo_url, pickup_photos, delivery_photos');
    expect(adminPage).toContain('const pickupPhotos = Array.isArray(row.pickup_photos)');
    expect(adminPage).toContain('(row.pickup_photos as unknown[]).filter');
  });
});
