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

export const hasStoredSignature = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/i.test(value.trim())
      || /^[^/\s]+\/[^/\s]+\/[^\s]+$/.test(value.trim());
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.type === 'recipient_typed_name_attestation') {
    return typeof record.recipient_name === 'string' && Boolean(record.recipient_name.trim())
      && typeof record.confirmed_at === 'string' && Number.isFinite(Date.parse(record.confirmed_at))
      && typeof record.evidence_path === 'string' && Boolean(record.evidence_path.trim())
      && typeof record.job_id === 'string' && Boolean(record.job_id.trim());
  }
  return typeof record.value === 'string' && hasStoredSignature(record.value);
};

export function hasCompletePodEvidence(record: PodCompletionRecord) {
  const recipientName =
    typeof record.client_signature_name === 'string'
      ? record.client_signature_name.trim()
      : '';

  const evidenceCount =
    nonEmptyEvidence(record.delivery_photos).length +
    nonEmptyEvidence(record.pod_photos).length;

  return (
    record.pod_generated === true &&
    evidenceCount > 0 &&
    hasStoredSignature(record.delivery_signature_data) &&
    recipientName.length > 0
  );
}
