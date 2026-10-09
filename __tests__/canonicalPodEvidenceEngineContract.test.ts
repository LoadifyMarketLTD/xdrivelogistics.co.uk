import { describe, expect, it } from 'vitest';
import { canonicalPodEvidence, canonicalPodStateLabel } from '../lib/pod/canonicalPodEvidence';

describe('canonical POD evidence engine', () => {
  it('requires generated POD, delivery photo, recipient signature and recipient name', () => {
    expect(canonicalPodEvidence({
      pod_generated: true,
      delivery_photos: ['company/job/delivery/photo.jpg'],
      delivery_signature_data: 'signature',
      client_signature_name: 'Receiver',
    }).complete).toBe(true);

    expect(canonicalPodEvidence({
      pod_generated: true,
      delivery_photos: ['company/job/delivery/photo.jpg'],
      delivery_signature_data: null,
      client_signature_name: 'Receiver',
    }).state).toBe('incomplete');
  });

  it('keeps broker review state separate from evidence completeness', () => {
    const approved = canonicalPodEvidence({
      pod_generated: true,
      delivery_photos: ['photo'],
      delivery_signature_data: { value: 'signature' },
      client_signature_name: 'Receiver',
      broker_pod_review_status: 'approved',
    });
    expect(approved.complete).toBe(true);
    expect(approved.state).toBe('approved');

    const staleApproval = canonicalPodEvidence({
      pod_generated: false,
      delivery_photos: [],
      delivery_signature_data: null,
      client_signature_name: null,
      broker_pod_review_status: 'approved',
    });
    expect(staleApproval.complete).toBe(false);
    expect(staleApproval.state).toBe('missing');
  });

  it('recognises not-required and review follow-up states', () => {
    expect(canonicalPodEvidence({ pod_required: false }).state).toBe('not_required');
    expect(canonicalPodEvidence({ pod_required: true, broker_pod_review_status: 'missing_requested' }).state).toBe('missing_requested');
    expect(canonicalPodStateLabel('rejected')).toBe('POD rejected');
  });
});
