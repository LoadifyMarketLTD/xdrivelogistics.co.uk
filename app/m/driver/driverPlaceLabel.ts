export function driverPlaceLabel(location: string | null | undefined, postcode: string | null | undefined): string {
  const town = (location || '').trim();
  const code = (postcode || '').trim().toUpperCase();
  const outcode = code.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0] || code;
  if (!town) return outcode || 'Location to be confirmed';
  if (!outcode || town.toUpperCase().includes(outcode)) return town;
  return `${town}, ${outcode}`;
}
