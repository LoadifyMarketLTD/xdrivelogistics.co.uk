export type PodCompletionRecord = {
  pod_generated?: unknown;
  delivery_photos?: unknown;
  pod_photos?: unknown;
  delivery_signature_data?: unknown;
  client_signature_name?: unknown;
};

export function hasCompletePodEvidence(record: PodCompletionRecord) {
  return record.pod_generated === true;
}
