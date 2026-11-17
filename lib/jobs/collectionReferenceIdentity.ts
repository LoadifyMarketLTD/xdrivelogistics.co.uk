/**
 * Canonical job identity and carrier identity for the driver's collection form.
 * The customer/poster's private reference is deliberately a separate field.
 * Identifiers are only derived from server-owned job and carrier records.
 */
export type CollectionReferenceIdentity = {
  jobReference: string;
  carrierCompanyReference: string;
};

export function collectionReferenceIdentity(jobId: unknown, carrierXdId: unknown): CollectionReferenceIdentity | null {
  if (typeof jobId !== 'string' || typeof carrierXdId !== 'string') return null;
  const id = jobId.trim();
  const carrier = carrierXdId.trim().toUpperCase();
  const match = /^([a-f0-9]{8})-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.exec(id);
  if (!match || !/^XD-[A-Z0-9-]{3,32}$/.test(carrier)) return null;
  return { jobReference: 'XDL-' + match[1].toUpperCase(), carrierCompanyReference: carrier };
}
