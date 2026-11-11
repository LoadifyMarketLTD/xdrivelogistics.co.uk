const clean = (value: string | null | undefined) => String(value ?? '').trim();

export function postcodeOutcode(value: string | null | undefined) {
  const raw = clean(value).toUpperCase().replace(/\s+/g, ' ');
  return raw.match(/^([A-Z]{1,2}\d[A-Z\d]?)/)?.[1] ?? raw.split(' ')[0] ?? '';
}

export function bookingAreaLabel(location: string | null | undefined, postcode: string | null | undefined) {
  const address = clean(location);
  const fullPostcode = clean(postcode).toUpperCase();
  const outcode = postcodeOutcode(postcode);
  if (!address) return outcode || 'Location';

  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  let locality = parts.at(-1) ?? address;
  if (fullPostcode) locality = locality.replace(new RegExp(fullPostcode.replace(/\s+/g, '\\s*') + '$', 'i'), '').trim();
  if (!locality || /^[A-Z]{1,2}\d/i.test(locality)) locality = parts.at(-2) ?? '';
  locality = locality.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '').trim();

  if (!locality) return outcode || address;
  const normalizedLocality = locality.toUpperCase();
  if (outcode && normalizedLocality.endsWith(outcode)) return locality;
  return outcode ? `${locality} ${outcode}` : locality;
}
