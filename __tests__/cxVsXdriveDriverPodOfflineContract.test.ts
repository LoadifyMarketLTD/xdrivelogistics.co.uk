import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Driver POD/offline consolidation contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  const client = read('apps/driver-mobile/src/api/jobs.ts');
  const apiClient = read('apps/driver-mobile/src/api/client.ts');
  const app = read('apps/driver-mobile/src/app/DriverMobileApp.tsx');
  const queue = read('apps/driver-mobile/src/offline/queue.ts');
  const evidence = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
  const lifecycle = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const detail = read('app/api/driver/mobile/jobs/[id]/route.ts');
  const damageMigration = read('supabase/migrations/20260830004958_port_driver_pod_damage_evidence.sql');

  it('routes collection and POD files through the device-bound binary API instead of direct Supabase storage', () => {
    expect(client).toContain("import { apiBinaryRequest, apiRequest } from './client'");
    expect(apiClient).toContain("'x-xdrive-installation-id': installationId");
    expect(client).toContain('x-xdrive-evidence-kind');
    expect(client).toContain('x-xdrive-evidence-category');
    expect(client).not.toContain("supabase.storage");
  });

  it('persists offline evidence before queueing and separates delivery, damage and documents', () => {
    expect(queue).toContain('persistQueuedPodPayload');
    expect(queue).toContain('persistQueuedCollectionPayload');
    expect(queue).toContain("retryMode?: 'automatic' | 'manual'");
    expect(client).toContain("type PodEvidenceKind = 'photos' | 'damage' | 'documents'");
    expect(client).toContain('damagePhotoUris,');
    expect(app).toContain('const [damagePhotoUris, setDamagePhotoUris]');
    expect(app).toContain('photoUris,\n      damagePhotoUris,\n      documentUris,');
  });

  it('requires collection evidence before Loaded and replays the same queued payload', () => {
    expect(app).toContain("if (nextStep.endpoint === 'loaded')");
    expect(app).toContain('captureCollectionPhotoPayload()');
    expect(app).toContain('collectionEvidenceId: createCollectionEvidenceId()');
    expect(app).toContain('postJobStatus(item.jobId, item.endpoint, sessionToken, item.payload ?? {})');
    expect(client).toContain("if (endpoint === 'loaded') await uploadCollectionPhoto(jobId, token, payload)");
  });

  it('stages delivery evidence under company/job/category and only links collection evidence during upload', () => {
    expect(evidence).toContain("type DeliveryEvidenceCategory = 'photos' | 'damage' | 'documents'");
    expect(evidence).toContain('`${driver.companyId}/${id}/${category}/${objectName}`');
    expect(evidence).toContain("if (kind === 'collection')");
    expect(evidence).not.toContain('delivery_photos: Array.from');
    expect(evidence).not.toContain('damage_photos: Array.from');
    expect(evidence).not.toContain('pod_photos: Array.from');
  });

  it('makes lifecycle transitions consume persisted server evidence while preserving the PR399 multi-drop final gate', () => {
    expect(lifecycle).toContain('p_collection_photo_url: null');
    expect(lifecycle).toContain('p_delivery_photos: null');
    expect(lifecycle).toContain('p_delivery_signature_data: null');
    expect(lifecycle).toContain('p_client_signature_name: null');
    expect(lifecycle).toContain('requireMultiDropFinalizationReady');
    expect(lifecycle).toContain('Complete all multi-drop stops before capturing POD or marking the job delivered.');
    expect(lifecycle).toContain("damage_photos: Array.from(new Set([...existingDamagePhotos, ...damagePhotoPaths]))");
  });

  it('keeps damage evidence first-class in production schema and projects signed POD back to Expo', () => {
    expect(damageMigration).toContain('ADD COLUMN IF NOT EXISTS damage_photos jsonb');
    expect(detail).toContain('buildSignedPodPresentations');
    expect(detail).toContain('damage_photos,pod_generated_at,driver_notes');
    expect(detail).toContain('podCompleted: Boolean(pod)');
  });

  it('does not auto-retry permanent client errors forever', () => {
    expect(apiClient).toContain('export class ApiRequestError extends Error');
    expect(apiClient).toContain('export function isPermanentClientError');
    expect(queue).toContain("retryMode: retryable ? 'automatic' : 'manual'");
    expect(app).toContain('{ retryable: !isPermanentClientError(error) }');
  });
});
