import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasCompletePodEvidence, hasStoredSignature } from '../lib/jobs/podCompletion';
import { canonicalPodEvidence } from '../lib/pod/canonicalPodEvidence';

const drawn = 'data:image/png;base64,iVBORw0KGgoAAAAB';
const photo = 'company/job/photos/delivery.jpg';
const evidence = {
  pod_generated: true,
  delivery_photos: [photo],
  pod_photos: [],
  delivery_signature_data: drawn,
  client_signature_name: 'Receiving person',
};
const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('strict POD contract — recipient, drawn signature, 1-10 photographs', () => {
  it('accepts complete POD only with all mandatory evidence', () => {
    expect(hasCompletePodEvidence(evidence)).toBe(true);
    expect(canonicalPodEvidence(evidence).complete).toBe(true);
    expect(hasCompletePodEvidence({ ...evidence, delivery_photos: Array.from({length: 10}, (_, index) => photo + index) })).toBe(true);
  });

  it('rejects zero photos even with documents, signed recipient and pod_generated', () => {
    const missingPhoto = { ...evidence, delivery_photos: [], pod_photos: ['company/job/documents/receipt.pdf'] };
    expect(hasCompletePodEvidence(missingPhoto)).toBe(false);
    expect(canonicalPodEvidence(missingPhoto).complete).toBe(false);
  });

  it('rejects a missing name, missing signature, ungenerated POD or more than ten photos', () => {
    for (const record of [
      { ...evidence, client_signature_name: '  ' },
      { ...evidence, delivery_signature_data: null },
      { ...evidence, pod_generated: false },
      { ...evidence, delivery_photos: Array.from({length: 11}, (_, index) => photo + index) },
    ]) {
      expect(hasCompletePodEvidence(record)).toBe(false);
      expect(canonicalPodEvidence(record).complete).toBe(false);
    }
  });

  it('never treats typed recipient confirmation as a drawn signature', () => {
    const typed = {
      type: 'recipient_typed_name_attestation',
      signature_method: 'typed_name_attestation',
      recipient_name: 'Receiving person',
      confirmed_at: '2026-11-17T07:00:00Z',
      evidence_path: photo,
      job_id: 'job',
    };
    expect(hasStoredSignature(typed)).toBe(false);
    expect(hasCompletePodEvidence({ ...evidence, delivery_signature_data: typed })).toBe(false);
    expect(canonicalPodEvidence({ ...evidence, delivery_signature_data: typed }).complete).toBe(false);
    expect(hasStoredSignature({ value: 'typed Recipient' })).toBe(false);
  });

  it('retains legacy drawn-signature images and authenticated drawn envelopes', () => {
    expect(hasStoredSignature(drawn)).toBe(true);
    expect(hasStoredSignature('company/job/signature.png')).toBe(true);
    expect(hasStoredSignature({ value: 'company/job/signature.jpg' })).toBe(true);
    expect(hasStoredSignature({type: 'recipient_drawn_signature', signature_method: 'drawn_signature', signature_data: drawn})).toBe(true);
  });

  it('enforces recipient drawing and attached photos on both confirmation APIs', () => {
    for (const channel of ['mobile', 'web']) {
      const code = source('app/api/driver/' + channel + '/jobs/[id]/confirmation/route.ts');
      expect(code).toContain('A drawn recipient signature is required. Typed-name attestation is not accepted.');
      expect(code).toContain('Upload and attach 1-10 delivery photographs');
      expect(code).toContain('persistedEvidence.includes(evidencePath)');
      expect(code).toContain("signature_method: 'drawn_signature'");
      expect(code).not.toContain("signature_method: 'typed_name_attestation'");
    }
  });

  it('blocks unsigned or photograph-free final POD via both Driver APIs', () => {
    for (const channel of ['mobile', 'web']) {
      const code = source('app/api/driver/' + channel + '/jobs/[id]/[action]/route.ts');
      expect(code).toContain('if (!hasStoredSignature(signatureData))');
      expect(code).toContain('deliveryPhotos.length < 1 || deliveryPhotos.length > 10');
      expect(code).toContain("rpc('record_driver_pod_atomic'");
    }
    const transition = source('app/api/admin/jobs/[id]/transition/route.ts');
    expect(transition).toContain('hasCompletePodEvidence(job)');
  });

  it('offers phone camera and saved-photo selection in the workflow', () => {
    const step = source('app/driver-pwa-fresh/bookings/[id]/workflow/OnSiteDeliveryStep.tsx');
    const pod = source('app/driver-pwa-fresh/bookings/[id]/workflow/ProofOfDeliveryStep.tsx');
    const desk = source('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(step).toContain('Take photo');
    expect(step).toContain('Attach saved photos');
    expect(step).toContain('capture="environment"');
    expect(pod).toContain('Take delivery photo (camera)');
    expect(pod).toContain('Add saved delivery photos');
    expect(desk).toContain('deliveryGalleryInput');
    const reserve = source('driver-pwa-reserve/src/DeliveryHandover.tsx');
    expect(reserve).toContain("'Take photo'");
    expect(reserve).toContain('Add Files');
    expect(reserve).toContain('hasDeliveryPhoto');
    expect(reserve).toContain('Maximum 10 delivery images (including saved job photos) and 10 documents per POD.');
    expect(reserve).toContain('Boolean(signature)&&signatureVerified');
  });

  it('lets drivers recover delivered-but-unsigned jobs in the full POD form', () => {
    const app = source('driver-pwa-reserve/src/ReserveApp.tsx');
    expect(app).toContain('if(delivered)return <DeliveryHandover');
    expect(app).toContain('mode="pod"');
    expect(app).toContain('onConfirm={()=>void savePod(job)}');
    expect(app).toContain('onSaveSignature={()=>saveRecipientSignature(job)}');
    expect(app).toContain('if(job.podRecorded||podDone)return');
  });

  it('prepares a database completion trigger hardening review without applying it', () => {
    const patch = source('docs/review/POD_STRICT_DB_COMPLETION_REVIEW_20261117.sql');
    expect(patch).toContain('fn_require_complete_pod_before_completed');
    expect(patch).toContain('jsonb_array_elements_text(NEW.delivery_photos)');
    expect(patch).toContain("'recipient_typed_name_attestation'");
    expect(patch).toContain('proof_of_delivery');
    expect(patch).toContain('REVIEW-ONLY');
  });
});