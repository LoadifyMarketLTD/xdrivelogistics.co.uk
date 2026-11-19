import {canonicalWorkspaceJobStatus} from './workspaceJobStage';

export type PodCompletionRecord = {
  pod_generated?: unknown;
  delivery_photos?: unknown;
  pod_photos?: unknown;
  delivery_signature_data?: unknown;
  client_signature_name?: unknown;
};

const nonEmptyEvidence = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

/** A typed recipient name is never a drawn recipient signature. */
export const hasStoredSignature = (value: unknown): boolean => {
  if (typeof value === 'string') {
    const signature = value.trim();
    return /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/i.test(signature)
      || /^[^/\s]+\/[^/\s]+\/(?:[^/\s]+\/)*[^/\s]+\.(png|jpe?g)$/i.test(signature);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.type === 'recipient_typed_name_attestation' || record.signature_method === 'typed_name_attestation') {
    return false;
  }
  return (typeof record.signature_data === 'string' && hasStoredSignature(record.signature_data))
    || (typeof record.value === 'string' && hasStoredSignature(record.value));
};

/** Rejected or requested-for-resubmission PODs are not invoice-ready. */
export function isPodApprovedForInvoicing(reviewStatus: unknown): boolean {
  const status = String(reviewStatus ?? '').trim().toLowerCase();
  return status !== 'rejected' && status !== 'missing_requested';
}

/** Unified read-only POD backlog: delivered jobs with incomplete required evidence. */
export function isDeliveredAwaitingPod(record: PodCompletionRecord & {status?: unknown;current_status?: unknown}): boolean {
  const lifecycle=canonicalWorkspaceJobStatus(record.current_status??record.status);
  return lifecycle==='delivered' && !hasCompletePodEvidence(record);
}

export function hasCompletePodEvidence(record: PodCompletionRecord) {
  const recipientName =
    typeof record.client_signature_name === 'string'
      ? record.client_signature_name.trim()
      : '';

  // A document or damage image cannot replace a delivery photograph.
  const deliveryPhotoCount = new Set(nonEmptyEvidence(record.delivery_photos)).size;
  return (
    record.pod_generated === true &&
    deliveryPhotoCount >= 1 && deliveryPhotoCount <= 10 &&
    hasStoredSignature(record.delivery_signature_data) &&
    recipientName.length > 0
  );
}

/** Explain the same requirements used by hasCompletePodEvidence. Never expose raw evidence. */
export function invoicePodBlocker(record: PodCompletionRecord & {broker_pod_review_status?:unknown}): string | null {
  if (!isPodApprovedForInvoicing(record.broker_pod_review_status)) return 'POD_REVIEW_REQUIRED';
  if (record.pod_generated !== true) return 'POD_NOT_FINALISED';
  if (!hasStoredSignature(record.delivery_signature_data)) return 'DRAWN_SIGNATURE_REQUIRED';
  if (typeof record.client_signature_name !== 'string' || !record.client_signature_name.trim()) return 'RECIPIENT_NAME_REQUIRED';
  const count = new Set(nonEmptyEvidence(record.delivery_photos)).size;
  if (count < 1 || count > 10) return 'DELIVERY_PHOTOS_REQUIRED';
  return null;
}