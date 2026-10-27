export type PodCompletionRecord = {
  pod_generated?: unknown;
  delivery_photos?: unknown;
  pod_photos?: unknown;
  delivery_signature_data?: unknown;
  client_signature_name?: unknown;
};

export function hasCompletePodEvidence(record: PodCompletionRecord) {
  const evidenceCount = Array.isArray(record.delivery_photos) ? record.delivery_photos.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).length : 0;
  const hasStoredSignature = (value: unknown) => typeof value === 'string' ? value.trim().length > 0 : Boolean(value && typeof value === 'object');
  const recipientName = typeof record.client_signature_name === 'string' ? record.client_signature_name.trim() : '';
  return record.pod_generated === true && evidenceCount > 0 && hasStoredSignature(record.delivery_signature_data) && recipientName.length > 0;
}
