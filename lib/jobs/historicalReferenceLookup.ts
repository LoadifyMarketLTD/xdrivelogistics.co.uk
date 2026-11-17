/**
 * Historical reference lookup across XDrive job surfaces.
 *
 * This never writes or reassigns a job reference. Legacy aliases remain
 * searchable after completion/cancellation. All callers must scope the rows to
 * the authenticated poster/carrier/driver BEFORE invoking the matcher.
 * Multiple matches must be surfaced (the legacy short XDL number can collide).
 */
export type ReferenceJob = {
  id: string;
  reference?: string | null;
  jobRef?: string | null;
  public_reference?: string | null;
  load_reference?: string | null;
  load_ref?: string | null;
  booking_reference?: string | null;
  customer_reference?: string | null;
  customer_ref?: string | null;
  cust_ref?: string | null;
  your_ref?: string | null;
  collection_handover?: unknown;
};

const canonicalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const normalizedReference = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

export function historicalJobAliases(job: ReferenceJob): string[] {
  const values: unknown[] = [
    job.id, job.reference, job.jobRef, job.public_reference,
    job.load_reference, job.load_ref, job.booking_reference,
    job.customer_reference, job.customer_ref, job.cust_ref, job.your_ref,
  ];
  if (canonicalId.test(job.id)) {
    values.push('XDL-' + job.id.slice(0, 8).toUpperCase());
    // Full ID is always unambiguous even when a legacy 8-character public
    // reference collides with another historical job.
    values.push('XDL-' + job.id.replaceAll('-', '').toUpperCase());
  }
  const handover = job.collection_handover;
  if (handover && typeof handover === 'object' && !Array.isArray(handover)) {
    const loaded = (handover as Record<string, unknown>).loaded;
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      const fields = loaded as Record<string, unknown>;
      values.push(fields.jobReference, fields.yourReference, fields.customerReference);
    }
  }
  return [...new Set(values.filter((v): v is string => typeof v === 'string')
    .map(v => v.trim()).filter(Boolean))];
}

export function matchesHistoricalJobReference(job: ReferenceJob, query: string): boolean {
  const needle = normalizedReference(query);
  if (!needle || needle.length < 2 || needle.length > 128) return false;
  return historicalJobAliases(job).some(alias => normalizedReference(alias).includes(needle));
}

export function selectHistoricalJobMatches<T extends ReferenceJob>(
  scopedJobs: readonly T[], query: string,
): T[] {
  // Multiple authorised results are intentional: never silently choose the
  // first job when an old short reference is non-unique.
  return scopedJobs.filter(job => matchesHistoricalJobReference(job, query));
}
