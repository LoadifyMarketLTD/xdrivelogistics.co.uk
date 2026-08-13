import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCanonicalPodPath,
  isLegacyAndroidPodPath,
  LEGACY_ANDROID_POD_BUCKET,
  POD_BUCKET,
} from '../app/api/_lib/pod';

const jobId = '11111111-1111-4111-8111-111111111111';
const driverId = '22222222-2222-4222-8222-222222222222';

describe('POD storage compatibility', () => {
  it('keeps pod-photos as the canonical bucket and accepts only canonical job-scoped paths', () => {
    expect(POD_BUCKET).toBe('pod-photos');
    expect(isCanonicalPodPath(jobId, 'photos', `${jobId}/photos/evidence.jpg`)).toBe(true);
    expect(isCanonicalPodPath(jobId, 'documents', `${jobId}/documents/pod.pdf`)).toBe(true);
    expect(isCanonicalPodPath(jobId, 'signatures', `${jobId}/signatures/signature.png`)).toBe(true);
    expect(isCanonicalPodPath(jobId, 'photos', `other/${jobId}/photos/evidence.jpg`)).toBe(false);
    expect(isCanonicalPodPath(jobId, 'photos', `${jobId}/photos/../secret.jpg`)).toBe(false);
  });

  it('limits legacy Android evidence to driver-{uuid}/{job_id}/... paths', () => {
    expect(LEGACY_ANDROID_POD_BUCKET).toBe('pod-docs');
    expect(isLegacyAndroidPodPath(jobId, `driver-${driverId}/${jobId}/signed-pod.jpg`)).toBe(true);
    expect(isLegacyAndroidPodPath(jobId, `driver-${driverId}/33333333-3333-4333-8333-333333333333/signed-pod.jpg`)).toBe(false);
    expect(isLegacyAndroidPodPath(jobId, `${driverId}/${jobId}/signed-pod.jpg`)).toBe(false);
    expect(isLegacyAndroidPodPath(jobId, `driver-${driverId}/${jobId}/../signed-pod.jpg`)).toBe(false);
  });

  it('keeps the SQL bridge fail-closed and aligned with the Android lifecycle', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260813093000_android_native_pod_compat.sql'),
      'utf8',
    );

    expect(migration).toContain("WHEN 'loaded' THEN 'in_transit'");
    expect(migration).toContain("WHEN 'in_transit' THEN 'on_site_delivery'");
    expect(migration).toContain("WHEN 'on_site_delivery' THEN 'delivered'");
    expect(migration).toContain("'storage_bucket', 'pod-docs'");
    expect(migration).toContain("'compatibility_mode', 'android_native_legacy'");
    expect(migration).toContain("IF NOT public.is_job_pod_valid(p_job_id) THEN");
    expect(migration).toContain('legacy_android_pod_driver_id_from_storage_name(v_evidence_path)');
    expect(migration).toContain('legacy_android_pod_job_id_from_storage_name(v_evidence_path)');
  });
});
