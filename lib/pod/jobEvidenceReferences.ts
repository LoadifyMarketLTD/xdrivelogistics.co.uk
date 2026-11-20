import { hasStoredSignature } from '../jobs/podCompletion';

/** Stored POD references are evidence, not browser URLs. */
export const evidenceText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const evidenceArray = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map(evidenceText).filter(Boolean))] : [];

export const inlineEvidenceImage = (value: string): boolean =>
  /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value);

export function signatureReference(value: unknown): string {
  if (typeof value === 'string') return evidenceText(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const row = value as Record<string, unknown>;
  const inline = evidenceText(row.value);
  const historical = evidenceText(row.signature_data);
  if (inlineEvidenceImage(inline)) return inline;
  if (inlineEvidenceImage(historical)) return historical;
  return evidenceText(row.evidence_path) || inline || historical;
}

export function signatureEvidenceLabel(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    if (row.type === 'recipient_typed_name_attestation' || row.signature_method === 'typed_name_attestation') {
      return 'Recipient name attestation';
    }
  }
  return hasStoredSignature(value) ? 'Recipient signature' : 'Signature evidence (unverified)';
}

export function jobEvidenceReferences(row: Record<string, unknown>) {
  return {
    pickupPhotos: [...new Set([...evidenceArray(row.pickup_photos), evidenceText(row.collection_photo_url)].filter(Boolean))],
    deliveryPhotos: evidenceArray(row.delivery_photos),
    damagePhotos: evidenceArray(row.damage_photos),
    documents: evidenceArray(row.pod_photos),
    signature: signatureReference(row.delivery_signature_data),
  };
}

export function isPodStorageReference(path: string): boolean {
  if (!path || path.length > 1024 || /[%\\?#:]/.test(path)
    || Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false;
  const parts = path.split('/');
  return parts.length >= 3 && parts.every(part => Boolean(part.trim()) && part !== '.' && part !== '..');
}

/** A linked reference is insufficient unless its namespace also belongs to this job. */
export function isScopedPodObjectPath(path: string, jobId: string, companies: string[]): boolean {
  if (!isPodStorageReference(path)) return false;
  const parts = path.split('/');
  return companies.includes(parts[0]) && parts[1] === jobId;
}
