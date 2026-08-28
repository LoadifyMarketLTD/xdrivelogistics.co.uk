import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'apps/driver-mobile/src/app/DriverMobileApp.tsx'), 'utf8');
const jobsClient = fs.readFileSync(path.join(root, 'apps/driver-mobile/src/api/jobs.ts'), 'utf8');
const queue = fs.readFileSync(path.join(root, 'apps/driver-mobile/src/offline/queue.ts'), 'utf8');
const persistence = fs.readFileSync(
  path.join(root, 'apps/driver-mobile/src/offline/collectionEvidencePersistence.ts'),
  'utf8',
);
const evidenceRoute = fs.readFileSync(
  path.join(root, 'app/api/driver/mobile/jobs/[id]/evidence/route.ts'),
  'utf8',
);
const actionRoute = fs.readFileSync(
  path.join(root, 'app/api/driver/mobile/jobs/[id]/[action]/route.ts'),
  'utf8',
);
const lifecycleMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260827052500_preserve_driver_pod_signature_json.sql'),
  'utf8',
);

describe('driver collection evidence lifecycle contract', () => {
  it('captures a loading photo before attempting Loaded', () => {
    expect(app).toContain('captureCollectionPhotoPayload');
    expect(app).toContain("if (nextStep.endpoint === 'loaded')");
    expect(app).toContain('collectionPhotoUri: uri');
    expect(app).toContain('collectionEvidenceId: createCollectionEvidenceId()');
    expect(app).toContain('endpoint: nextStep.endpoint, payload: actionPayload');
  });

  it('persists queued Loaded evidence outside picker cache and clears it on logout', () => {
    expect(queue).toContain("action.endpoint === 'loaded'");
    expect(queue).toContain('persistQueuedCollectionPayload(userId, action.jobId, action.payload)');
    expect(queue).toContain('clearPersistedCollectionEvidenceForUser(userId)');
    expect(persistence).toContain("COLLECTION_QUEUE_FOLDER = 'xdrive-collection-offline'");
    expect(persistence).toContain('FileSystem.documentDirectory');
    expect(persistence).toContain('FileSystem.copyAsync');
  });

  it('uploads collection evidence with a stable object name before the status request', () => {
    const uploadIndex = jobsClient.indexOf("if (endpoint === 'loaded') await uploadCollectionPhoto(jobId, token, payload)");
    const statusIndex = jobsClient.indexOf('const response = await apiRequest', uploadIndex);
    const cleanupIndex = jobsClient.indexOf("if (endpoint === 'loaded') await cleanupPersistedCollectionPayload(payload)", statusIndex);

    expect(uploadIndex).toBeGreaterThan(-1);
    expect(statusIndex).toBeGreaterThan(uploadIndex);
    expect(cleanupIndex).toBeGreaterThan(statusIndex);
    expect(jobsClient).toContain('payload.collectionEvidenceId = evidenceId');
    expect(jobsClient).toContain('`${evidenceId}-collection-01.${extension}`');
    expect(jobsClient).toContain("'x-xdrive-evidence-kind': 'collection'");
    expect(jobsClient).toContain('/api/driver/mobile/jobs/${jobId}/evidence');
  });

  it('keeps the private evidence endpoint assignment-gated and storage-authoritative', () => {
    expect(evidenceRoute).toContain('requireDriver(request)');
    expect(evidenceRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(evidenceRoute).toContain(".from('pod-photos')");
    expect(evidenceRoute).toContain('collection_photo_url: storagePath');
    expect(evidenceRoute).toContain('upsert: false');
  });

  it('does not trust physical evidence supplied to the lifecycle status request', () => {
    expect(actionRoute).toContain('p_collection_photo_url: null');
    expect(actionRoute).toContain('p_delivery_photos: null');
    expect(actionRoute).toContain('p_delivery_signature_data: null');
    expect(actionRoute).toContain('p_client_signature_name: null');
    expect(actionRoute).not.toContain('body.collectionPhotoUrl');
    expect(actionRoute).not.toContain('body.deliveryPhotos');
    expect(actionRoute).not.toContain('body.deliverySignatureData');
    expect(actionRoute).not.toContain('body.clientSignatureName');
  });

  it('keeps collection proof mandatory in the authoritative database transition', () => {
    expect(lifecycleMigration).toContain("v_next_status = 'loaded'");
    expect(lifecycleMigration).toContain('v_effective_collection_photo is null');
    expect(lifecycleMigration).toContain('A loading photo is required before marking the job loaded.');
  });
});
