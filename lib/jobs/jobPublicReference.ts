/** Canonical server-assigned XDrive job reference, never a customer or member XD ID. */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function shortHistoricalJobReference(jobId: unknown): string | null {
  if (typeof jobId !== 'string' || !uuidPattern.test(jobId)) return null;
  return 'XDL-' + jobId.slice(0, 8).toUpperCase();
}

export function fullUnambiguousJobReference(jobId: unknown): string | null {
  if (typeof jobId !== 'string' || !uuidPattern.test(jobId)) return null;
  return 'XDL-' + jobId.replaceAll('-', '').toUpperCase();
}

/** An official reference must belong to this exact job; reject cross-job values. */
export function verifiedJobPublicReference(jobId: unknown, storedReference: unknown): string | null {
  const short = shortHistoricalJobReference(jobId);
  const full = fullUnambiguousJobReference(jobId);
  if (!short || !full || typeof storedReference !== 'string') return null;
  const normalized = storedReference.trim().toUpperCase();
  return normalized === short || normalized === full ? normalized : null;
}
