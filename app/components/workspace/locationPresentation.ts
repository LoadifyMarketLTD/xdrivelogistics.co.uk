export function normalizeOperationalLocationPart(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function postcodeOutcode(value: string | null | undefined) {
  const compact = normalizeOperationalLocationPart(value);
  if (/\d[A-Z]{2}$/.test(compact) && compact.length > 3) return compact.slice(0, -3);
  return compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)/)?.[1] ?? '';
}

export function operationalLocationLabel(
  location: string | null | undefined,
  postcode: string | null | undefined,
  fallback = 'Not set',
) {
  const cleanLocation = String(location ?? '').trim();
  const cleanPostcode = String(postcode ?? '').trim();
  if (!cleanLocation) return cleanPostcode || fallback;
  if (!cleanPostcode) return cleanLocation;

  const normalizedLocation = normalizeOperationalLocationPart(cleanLocation);
  const normalizedPostcode = normalizeOperationalLocationPart(cleanPostcode);
  const outcode = postcodeOutcode(cleanPostcode);

  if (
    normalizedLocation.includes(normalizedPostcode)
    || (outcode && normalizedLocation.includes(outcode))
  ) {
    return cleanLocation;
  }

  return `${cleanLocation}, ${cleanPostcode}`;
}
