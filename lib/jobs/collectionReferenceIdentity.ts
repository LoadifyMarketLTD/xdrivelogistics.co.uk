/**
 * Canonical job identity and carrier identity for the driver's collection form.
 * The customer/poster's private reference is deliberately a separate field.
 * Identifiers are only derived from server-owned job and carrier records.
 */
import { shortHistoricalJobReference, verifiedJobPublicReference } from './jobPublicReference';

export type CollectionReferenceIdentity = {
  jobReference: string;
  carrierCompanyReference: string;
};

export function collectionReferenceIdentity(jobId: unknown, carrierXdId: unknown, storedJobReference?: unknown): CollectionReferenceIdentity | null {
  if (typeof jobId !== 'string' || typeof carrierXdId !== 'string') return null;
  const id = jobId.trim();
  const carrier = carrierXdId.trim().toUpperCase();
  const short = shortHistoricalJobReference(id);
  if (!short || !/^XD-[A-Z0-9-]{3,32}$/.test(carrier)) return null;
  const jobReference = storedJobReference === undefined ? short
    : verifiedJobPublicReference(id, storedJobReference);
  return jobReference ? { jobReference, carrierCompanyReference: carrier } : null;
}

/**
 * A Company Driver acts on behalf of their employing carrier company.
 * A genuine Owner Driver shares ONE immutable public XD ID with their
 * personal commercial workspace; never choose between mismatched IDs.
 * Authentication and evidence remain attributable to the individual user UUID.
 */
export function verifiedCollectionCommercialActorId(
  driverType: unknown,
  carrierCompanyXdId: unknown,
  ownerDriverXdId: unknown,
): string | null {
  const type = typeof driverType === 'string' ? driverType.trim().toLowerCase() : '';
  const company = typeof carrierCompanyXdId === 'string' ? carrierCompanyXdId.trim().toUpperCase() : '';
  const member = typeof ownerDriverXdId === 'string' ? ownerDriverXdId.trim().toUpperCase() : '';
  if (!/^XD-[0-9]{6,}$/.test(company)) return null;
  if (type === 'company_driver') return company;
  if (type === 'owner_driver') return member === company ? company : null;
  return null;
}
