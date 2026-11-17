/**
 * Selects a real recorded handwritten signature image for the immutable official
 * POD PDF. Legacy recipient typed-name attestation alone is not an image.
 *
 * A fallback to a previously saved driver draft is permitted only when the
 * signed attestation, assigned driver, job, recipient and timestamps all agree.
 * This does not mutate the signed POD or create new evidence.
 */
export type SavedPodDraftSignature = {
  driver_id?: unknown;
  updated_at?: unknown;
  form_data?: unknown;
} | null;

export type OfficialPodSignatureInput = {
  storedSignature: unknown;
  savedDraft: SavedPodDraftSignature;
  jobId: string;
  assignedDriverId: string | null;
  recipientName: string | null;
  podGeneratedAt: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const isRecordedSignatureImage = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2_500_000) return false;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (match[1].toLowerCase() === 'png') {
    return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  }
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
};

const validTime = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export function selectOfficialPodSignatureImage(input: OfficialPodSignatureInput): string | null {
  const record = asRecord(input.storedSignature);
  const direct = typeof input.storedSignature === 'string'
    ? input.storedSignature
    : record?.value ?? record?.signature_data;
  if (isRecordedSignatureImage(direct)) return direct;

  if (
    !record || record.type !== 'recipient_typed_name_attestation' ||
    record.job_id !== input.jobId ||
    !input.assignedDriverId || record.driver_id !== input.assignedDriverId ||
    typeof record.evidence_path !== 'string' ||
    !record.evidence_path.includes('/' + input.jobId + '/photos/')
  ) return null;

  const draft = input.savedDraft;
  const data = asRecord(draft?.form_data);
  if (!draft || !data || draft.driver_id !== input.assignedDriverId) return null;

  const recipient = typeof input.recipientName === 'string' ? input.recipientName.trim() : '';
  const draftRecipient = typeof data.recipientName === 'string' ? data.recipientName.trim() : '';
  if (!recipient || recipient !== draftRecipient) return null;

  const completedAt = validTime(input.podGeneratedAt);
  const recordedAt = validTime(draft.updated_at);
  const confirmedAt = validTime(record.confirmed_at);
  if (completedAt === null || recordedAt === null || confirmedAt === null ||
      recordedAt > completedAt || confirmedAt > completedAt) return null;

  return isRecordedSignatureImage(data.signatureData) ? data.signatureData : null;
}
