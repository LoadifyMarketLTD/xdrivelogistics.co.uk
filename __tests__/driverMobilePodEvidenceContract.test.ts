import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile persistent POD evidence contract', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const migration = read('supabase/migrations/032_storage_buckets.sql');
  const evidenceRoute = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
  const podRoute = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const mobileJobs = read('apps/driver-mobile/src/api/jobs.ts');
  const offlinePersistence = read('apps/driver-mobile/src/offline/podEvidencePersistence.ts');

  it('preserves tenant-scoped pod-photos storage as the first path segment', () => {
    expect(migration).toContain('pod-photos/{company_id}/{job_id}/{filename}');
    expect(evidenceRoute).toContain('`${driver.companyId}/${id}/${category}/${objectName}`');
    expect(podRoute).toContain('`${companyId}/${jobId}/${kind}/`');
  });

  it('separates delivery evidence kind from photo/document category', () => {
    expect(evidenceRoute).toContain("x-xdrive-evidence-category");
    expect(evidenceRoute).toContain("category === 'photos' || category === 'documents'");
    expect(mobileJobs).toContain("'x-xdrive-evidence-kind': 'delivery'");
    expect(mobileJobs).toContain("'x-xdrive-evidence-category': kind");
    expect(mobileJobs).not.toContain("'x-xdrive-evidence-kind': kind === 'documents' ? 'document' : 'delivery'");
  });

  it('does not link delivery evidence until final POD submission validates it', () => {
    expect(evidenceRoute).toContain("if (kind === 'collection')");
    expect(evidenceRoute).not.toContain("delivery_photos: Array.from(new Set([...deliveryPhotos, storagePath]))");
    expect(evidenceRoute).not.toContain("pod_photos: Array.from(new Set([...podPhotos, storagePath]))");
    expect(podRoute).toContain('delivery_photos: Array.from(new Set([...existingPhotos, ...photoPaths]))');
    expect(podRoute).toContain('pod_photos: Array.from(new Set([...existingDocuments, ...documentPaths]))');
  });

  it('persists every offline POD evidence category outside cache before queueing', () => {
    expect(offlinePersistence).toContain("const uriFields = ['photoUris', 'damagePhotoUris', 'documentUris'] as const");
    expect(offlinePersistence).toContain('FileSystem.documentDirectory');
    expect(offlinePersistence).toContain('FileSystem.copyAsync');
    expect(mobileJobs).toContain("persistPodFiles(jobId, metadata.damagePhotoUris, 'photos', token)");
    expect(mobileJobs).toContain('cleanupPersistedPodPayload(metadata)');
  });

  it('rejects a server path that does not round-trip through the canonical job/category layout', () => {
    expect(mobileJobs).toContain("segments[1] === jobId && segments[2] === kind");
    expect(mobileJobs).toContain("throw new Error('XDrive returned an invalid POD storage path. Please retry the upload.')");
  });
});
