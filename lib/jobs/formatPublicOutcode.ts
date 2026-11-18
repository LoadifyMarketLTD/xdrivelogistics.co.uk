/** Expose only the UK outward postcode before an authorised booking award. */
export function formatPublicOutcode(postcode: string | null | undefined) {
  const cleaned = (postcode ?? '').trim().toUpperCase();
  if (!cleaned) return 'Location not supplied';

  // UK postcode: outward component followed by one inward digit and two letters.
  // Reject arbitrary addresses, names or free text rather than leaking them.
  const full = cleaned.match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/);
  if (full) return full[1];

  // A public outcode alone is already safe to expose.
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(cleaned)) return cleaned;

  return 'Location restricted';
}
