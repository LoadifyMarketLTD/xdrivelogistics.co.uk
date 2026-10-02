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

const hasStoredSignature = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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
