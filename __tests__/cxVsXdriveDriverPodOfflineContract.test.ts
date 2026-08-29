import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Driver POD/offline contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  const client = read('apps/driver-mobile/src/api/jobs.ts');
  const app = read('apps/driver-mobile/src/app/DriverMobileApp.tsx');
  const evidence = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
  const lifecycle = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const pdfMigration = read('supabase/migrations/20260828130500_driver_pod_pdf_bucket_mime.sql');

  it('routes collection and POD files through the device-bound binary API instead of direct Supabase storage', () => {
    expect(client).toContain("import { apiBinaryRequest, apiRequest } from './client'");
    expect(client).toContain('x-xdrive-evidence-kind');
    expect(client).toContain('x-xdrive-evidence-category');
    expect(client).not.toContain("supabase.storage\n    .from('pod-photos')");
    expect(client).not.toContain("import { supabase } from '../auth/supabase'");
  });

  it('keeps delivery, damage and document evidence separate and replay-idempotent', () => {
    expect(client).toContain("type PodEvidenceKind = 'photos' | 'damage' | 'documents'");
    expect(client).toContain('metadata.evidenceBatchId = batchId');
    expect(client).toContain("persistPodFiles(jobId, normalizedPhotos.damagePhotoUris, 'damage', token, batchId)");
    expect(client).toContain('damagePhotoUris,');
    expect(client).toContain('const refreshed = await fetchJob(jobId, token)');
    expect(client).toContain('await cleanupPersistedPodPayload(metadata)');
    expect(app).toContain('photoUris,\n      damagePhotoUris,\n      documentUris,');
  });

  it('requires collection evidence before Loaded and replays the queued payload', () => {
    expect(app).toContain("if (nextStep.endpoint === 'loaded')");
    expect(app).toContain('captureCollectionPhotoPayload()');
    expect(app).toContain('collectionEvidenceId: createCollectionEvidenceId()');
    expect(app).toContain('postJobStatus(item.jobId, item.endpoint, sessionToken, item.payload ?? {})');
    expect(client).toContain("if (endpoint === 'loaded') await uploadCollectionPhoto(jobId, token, payload)");
  });

  it('stores evidence under company/job/category and does not link delivery evidence before final POD', () => {
    expect(evidence).toContain("type DeliveryEvidenceCategory = 'photos' | 'damage' | 'documents'");
    expect(evidence).toContain('`${driver.companyId}/${id}/${category}/${objectName}`');
    expect(evidence).toContain("if ((category === 'photos' || category === 'damage' || category === 'collection') && contentType === 'application/pdf')");
    expect(evidence).toContain("if (kind === 'collection')");
    expect(evidence).not.toContain('delivery_photos: Array.from');
    expect(evidence).not.toContain('damage_photos: Array.from');
    expect(evidence).not.toContain('pod_photos: Array.from');
  });

  it('makes lifecycle transitions consume persisted server evidence instead of client-supplied physical evidence', () => {
    expect(lifecycle).toContain('p_collection_photo_url: null');
    expect(lifecycle).toContain('p_delivery_photos: null');
    expect(lifecycle).toContain('p_delivery_signature_data: null');
    expect(lifecycle).toContain('p_client_signature_name: null');
    expect(lifecycle).toContain("kind: PodEvidenceKind");
    expect(lifecycle).toContain('path.startsWith(`${companyId}/${jobId}/${kind}/`)');
    expect(lifecycle).toContain('damage_photos: Array.from(new Set([...existingDamagePhotos, ...damagePhotoPaths]))');
    expect(lifecycle).toContain('driver_notes: typeof body.notes');
    expect(lifecycle).toContain('pod_generated_at: now');
  });

  it('requires canonical POD evidence when POD is required', () => {
    expect(lifecycle).toContain("if (job.pod_required !== false)");
    expect(lifecycle).toContain("At least one delivery photo is required for POD.");
    expect(lifecycle).toContain("Recipient signature is required for POD.");
    expect(lifecycle).toContain("if (!recipientName) return respond(400, { error: 'Recipient name is required for POD.' })");
  });

  it('adds PDF MIME support without narrowing an unrestricted private bucket', () => {
    expect(pdfMigration).toContain("WHERE id = 'pod-photos'");
    expect(pdfMigration).toContain("'application/pdf' = ANY(v_allowed_mime_types)");
    expect(pdfMigration).toContain("v_allowed_mime_types IS NOT NULL");
    expect(pdfMigration).toContain("array_append(v_allowed_mime_types, 'application/pdf')");
  });

  it('does not introduce Expo background tracking during the POD/offline phase', () => {
    expect(client).not.toContain("../tracking/operationalTracking");
    expect(app).not.toContain("../tracking/operationalTracking");
  });
});
