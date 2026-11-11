/** Compact location for approved 3150 job cards; full addresses stay in job details. */
export function compactRouteLocation(location: string | null | undefined, postcode: string | null | undefined, fallback: string): string {
  const place = location?.trim() ?? '';
  const code = postcode?.trim() ?? '';
  const postcodeMatch = code.match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/i);
  const outcode = postcodeMatch?.[1]?.toUpperCase() ?? code.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  const segments = place.replace(/\r?\n/g, ',').split(',').map((segment) => segment.trim()).filter(Boolean);
  const locality = [...segments].reverse().find((segment) =>
    !/^(?:GB|UK|United Kingdom)$/i.test(segment)
    && !/^[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?$/i.test(segment)
    && !/^\d/.test(segment)
    && !/\b(?:street|road|lane|avenue|drive|industrial estate|business park|close)\b/i.test(segment)
  );
  const town = locality?.split(/\s+-\s+/).at(-1)?.trim() ?? '';
  if (town && outcode) return [town,outcode].join(', ');
  return town || outcode || fallback;
}
