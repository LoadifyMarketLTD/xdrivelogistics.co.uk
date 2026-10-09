export type CanonicalPodState =
  | 'not_required'
  | 'missing'
  | 'incomplete'
  | 'complete'
  | 'approved'
  | 'rejected'
  | 'missing_requested';

export type CanonicalPodRecord = {
  pod_required?: boolean | null;
  pod_generated?: boolean | null;
  delivery_photos?: unknown;
  pod_photos?: unknown;
  delivery_signature_data?: unknown;
  client_signature_name?: string | null;
  broker_pod_review_status?: string | null;
};

const nonEmptyStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const hasSignature = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value && typeof value === 'object');
};

export function canonicalPodEvidence(record: CanonicalPodRecord) {
  const required = record.pod_required !== false;
  const deliveryPhotos = nonEmptyStrings(record.delivery_photos);
  const documents = nonEmptyStrings(record.pod_photos);
  const signatureRecorded = hasSignature(record.delivery_signature_data);
  const recipientRecorded = Boolean(record.client_signature_name?.trim());
  const generated = record.pod_generated === true;
  const evidenceReady = deliveryPhotos.length > 0 && signatureRecorded && recipientRecorded;
  const complete = generated && evidenceReady;
  const hasAnyEvidence = generated || deliveryPhotos.length > 0 || documents.length > 0 || signatureRecorded || recipientRecorded;

  const review = String(record.broker_pod_review_status ?? '').trim().toLowerCase();
  let state: CanonicalPodState;
  if (!required && !generated && !evidenceReady) state = 'not_required';
  else if (review === 'approved' && complete) state = 'approved';
  else if (review === 'rejected') state = 'rejected';
  else if (review === 'missing_requested') state = 'missing_requested';
  else if (complete) state = 'complete';
  else if (generated || deliveryPhotos.length > 0 || signatureRecorded || recipientRecorded || documents.length > 0) state = 'incomplete';
  else state = 'missing';

  return {
    required,
    generated,
    deliveryPhotos,
    documents,
    deliveryPhotoCount: deliveryPhotos.length,
    documentCount: documents.length,
    signatureRecorded,
    recipientRecorded,
    evidenceReady,
    complete,
    hasAnyEvidence,
    reviewStatus: review || null,
    state,
  };
}

export function canonicalPodStateLabel(state: CanonicalPodState) {
  const labels: Record<CanonicalPodState, string> = {
    not_required: 'POD not required',
    missing: 'POD missing',
    incomplete: 'POD incomplete',
    complete: 'POD complete',
    approved: 'POD approved',
    rejected: 'POD rejected',
    missing_requested: 'POD requested',
  };
  return labels[state];
}

export function canonicalPodStateTone(state: CanonicalPodState) {
  if (state === 'approved' || state === 'complete' || state === 'not_required') return 'green' as const;
  if (state === 'rejected') return 'red' as const;
  if (state === 'missing' || state === 'incomplete' || state === 'missing_requested') return 'orange' as const;
  return 'grey' as const;
}
