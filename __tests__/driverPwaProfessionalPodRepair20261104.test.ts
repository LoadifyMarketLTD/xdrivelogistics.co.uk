import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasCompletePodEvidence } from '../lib/jobs/podCompletion';

const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const signature = 'data:image/png;base64,aGVsbG8=';

describe('Driver PWA professional booking/POD repair', () => {
  it('accepts a genuine saved PDF document as sole POD evidence, without a duplicate photograph', () => {
    expect(hasCompletePodEvidence({
      pod_generated: true,
      delivery_photos: [],
      pod_photos: ['company/job/documents/signed-pod.pdf'],
      delivery_signature_data: signature,
      client_signature_name: 'Recipient',
    })).toBe(true);
  });

  it('requires evidence, recipient and signature even after the status is delivered', () => {
    const base = { pod_generated: true, delivery_photos: [], pod_photos: [], delivery_signature_data: signature, client_signature_name: 'Recipient' };
    expect(hasCompletePodEvidence(base)).toBe(false);
    expect(hasCompletePodEvidence({ ...base, delivery_photos: ['company/job/photos/pod.jpg'], client_signature_name: '' })).toBe(false);
    expect(hasCompletePodEvidence({ ...base, delivery_photos: ['company/job/photos/pod.jpg'], delivery_signature_data: null })).toBe(false);
    expect(hasCompletePodEvidence({ ...base, delivery_photos: ['company/job/photos/pod.jpg'] })).toBe(true);
  });

  it('prevents pickup photo validation from blocking zero-evidence collection stops', () => {
    const handler = source('app/api/driver/web/jobs/[id]/webStopStatus.ts');
    expect(handler).not.toContain('At least one collection photo is required for this stop');
    expect(handler).toContain('photoPaths: [], documentPaths: []');
    const execution = source('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(execution).toContain('Both are optional.');
    expect(execution).toContain('stopDocumentPaths[nextStop.id]');
    expect(execution).toContain("category: 'photos' | 'documents'");
  });

  it('keeps evidence authentication, assignment, stop scope, file-content checks and persisted upload verification', () => {
    const evidence = source('app/api/driver/web/jobs/[id]/evidence/route.ts');
    expect(evidence).toContain('requireActiveWebDriver(request)');
    expect(evidence).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(evidence).toContain(".eq('job_id', id)");
    expect(evidence).toContain('hasExpectedMagicBytes(payload, contentType)');
    expect(evidence).toContain('photoPaths: paths.photos, documentPaths: paths.documents');
  });

  it('requires one of photo or document but never both for final POD API', () => {
    const api = source('app/api/driver/web/jobs/[id]/[action]/route.ts');
    expect(api).toContain('effectiveEvidenceCount === 0');
    expect(api).not.toContain('effectivePhotoCount === 0');
    expect(api).toContain('storageObjectExists(path)');
    expect(api).toContain('alreadySubmitted: true');
    expect(api).toContain("rpc('record_driver_pod_atomic'");
  });

  it('keeps database release gated behind a reversible migration with genuine POD before completion', () => {
    const migration = source('supabase/migrations/20261104153000_driver_pwa_optional_pickup_verified_pod.sql');
    const rollback = source('docs/rollbacks/20261104153000_driver_pwa_optional_pickup_verified_pod.rollback.sql');
    expect(migration).toContain('Submit a verified POD before completing the booking.');
    expect(migration).toContain('Verified POD must be submitted before completion.');
    expect(migration).toContain('Unexpected production function revision');
    expect(rollback).toContain('A loading photo is required before marking the job loaded.');
  });
});
