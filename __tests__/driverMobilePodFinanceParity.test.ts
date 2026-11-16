import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasCompletePodEvidence, hasStoredSignature } from '../lib/jobs/podCompletion';

const serverMapper = readFileSync('app/api/driver/mobile/_lib.ts', 'utf8');
const clientMapper = readFileSync('driver-pwa-reserve/src/liveApi.ts', 'utf8');

describe('Mobile Signed POD must agree with Finance POD completion', () => {
  const delivered = {
    pod_generated: true,
    delivery_photos: ['secure/delivery/evidence.jpg'],
    pod_photos: [],
    delivery_signature_data: 'data:image/png;base64,QUJD',
    client_signature_name: 'Test Recipient',
  };

  it('recognizes complete evidence for official POD and finance', () => {
    expect(hasCompletePodEvidence(delivered)).toBe(true);
  });

  it('does not archive merely because photos and signature exist', () => {
    expect(hasCompletePodEvidence({ ...delivered, pod_generated: false })).toBe(false);
  });

  it('does not archive with a generated flag but without photos', () => {
    expect(hasCompletePodEvidence({ ...delivered, delivery_photos: [], pod_photos: [] })).toBe(false);
  });

  it('does not archive with a generated flag but without verified signature or signer', () => {
    expect(hasCompletePodEvidence({ ...delivered, delivery_signature_data: '' })).toBe(false);
    expect(hasCompletePodEvidence({ ...delivered, client_signature_name: '' })).toBe(false);
  });

  it('retains legacy typed-name POD attestation compatibility', () => {
    const legacy = { type:'recipient_typed_name_attestation', recipient_name:'Test Recipient', confirmed_at:'2026-11-16T12:00:00.000Z', evidence_path:'secure/test/pod.png', job_id:'test-job-id' };
    expect(hasStoredSignature(legacy)).toBe(true);
    expect(hasCompletePodEvidence({ ...delivered, delivery_signature_data: legacy })).toBe(true);
  });

  it('uses exactly the Finance completion predicate in the API response', () => {
    expect(serverMapper).toContain("import { hasCompletePodEvidence } from '../../../../lib/jobs/podCompletion';");
    expect(serverMapper).toContain('podGenerated: hasCompletePodEvidence(row)');
    expect(serverMapper).not.toContain('podGenerated: hasPod(row)');
  });

  it('only marks PWA as POD archived after authoritative server confirmation', () => {
    expect(clientMapper).toContain('podRecorded: r.podGenerated === true');
    expect(clientMapper).toContain('Boolean(r.deliverySignatureData)');
    expect(clientMapper).toContain('Boolean(str(r.clientSignatureName))');
  });
});
