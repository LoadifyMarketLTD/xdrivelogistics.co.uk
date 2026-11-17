/**
 * Canonical job reference and verified XDrive carrier identity.
 * The posting client's private reference is not the operator's public ID.
 * All public identifiers must originate from server-owned records.
 */
export type CollectionReferenceIdentity = {
  jobReference: string;
  carrierCompanyReference: string;
};

export type CollectionTransportIdentity = CollectionReferenceIdentity & {
  transportOperatorReference: string;
  transportOperatorKind: 'driver' | 'company';
};

const xdReference = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const ref = value.trim().toUpperCase();
  return /^XD-[A-Z0-9-]{3,32}$/.test(ref) ? ref : null;
};

export function collectionReferenceIdentity(jobId: unknown, carrierXdId: unknown): CollectionReferenceIdentity | null {
  if (typeof jobId !== 'string') return null;
  const match = /^([a-f0-9]{8})-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.exec(jobId.trim());
  const companyRef = xdReference(carrierXdId);
  if (!match || !companyRef) return null;
  return { jobReference: 'XDL-' + match[1].toUpperCase(), carrierCompanyReference: companyRef };
}

/**
 * Owner Drivers execute under their own profile's public XD ID.
 * Company-driver work is identified by the carrier company's public XD ID.
 * Never silently substitute the company ID if an Owner Driver has no public ID.
 */
export function collectionTransportIdentity(
  jobId: unknown,
  carrierCompanyXdId: unknown,
  driverPublicXdId: unknown,
  driverType: unknown,
): CollectionTransportIdentity | null {
  const base = collectionReferenceIdentity(jobId, carrierCompanyXdId);
  if (!base) return null;
  const verifiedType = typeof driverType === 'string' ? driverType.trim().toLowerCase() : '';
  if (verifiedType !== 'owner_driver' && verifiedType !== 'company_driver') return null;
  const ownerDriver = verifiedType === 'owner_driver';
  const operatorReference = ownerDriver ? xdReference(driverPublicXdId) : base.carrierCompanyReference;
  if (!operatorReference) return null;
  return {
    ...base,
    transportOperatorReference: operatorReference,
    transportOperatorKind: ownerDriver ? 'driver' : 'company',
  };
}
