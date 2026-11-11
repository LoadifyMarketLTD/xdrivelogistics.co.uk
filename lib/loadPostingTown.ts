/** Extract only an explicitly separated town; never treat a street or council as a town. */
export const validPostingTown = (value: string) =>
  value.trim().length <= 80 && /^[\p{L}][\p{L}\p{M} .\u2019'&-]*$/u.test(value.trim())
  && !/\b(?:borough|county|district|region|street|road|avenue|industrial estate)\b/i.test(value);

export function townFromPostingAddress(address: string, postcode: string) {
  const codes: string[] = address.match(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi) ?? [];
  const compact = (value: string) => value.replace(/\s/g, '').toUpperCase();
  if (codes.some(code => compact(code) !== compact(postcode))) return '';
  const parts = address.split(/,|\n/).map(part => part.trim()).filter(Boolean);
  while (parts.length && (/^(?:GB|UK|United Kingdom|England|Scotland|Wales|Northern Ireland)$/i.test(parts.at(-1)!)
    || codes.includes(parts.at(-1)!))) parts.pop();
  if (parts.length < 2) return '';
  const town = parts.at(-1)!;
  // More complex addresses may end in a county; do not guess from those.
  if (parts.length > 2 && !/\d|\b(?:street|road|lane|way|drive|avenue|close|depot|warehouse)\b/i.test(parts.at(-2)!)) return '';
  return validPostingTown(town) ? town : '';
}

export function importedPostingTown(incoming: { address?: { value: string }; postcode: { value: string } } | undefined, currentPostcode: string, currentTown: string) {
  if (!incoming) return currentTown;
  const inferred = townFromPostingAddress(incoming.address?.value ?? '', incoming.postcode.value);
  if (inferred) return inferred;
  return incoming.postcode.value.replace(/\s/g, '').toUpperCase() === currentPostcode.replace(/\s/g, '').toUpperCase()
    ? currentTown : '';
}
