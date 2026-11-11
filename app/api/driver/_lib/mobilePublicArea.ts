import { publicOutcode } from './marketplacePublic';

/**
 * Public marketplace pickup/delivery display. Before award we disclose only
 * the named town and UK outward postcode; we never project a street address.
 */
export function publicTown(value: unknown) {
  const town = typeof value === 'string' ? value.trim() : '';
  // Accept normal UK place names, not house numbers, full postcodes or addresses.
  return town.length <= 80 && /^[\p{L}][\p{L}\p{M} .\u2019'&-]*$/u.test(town) ? town : '';
}

export function mobilePublicArea(postcode: unknown, city: unknown) {
  const outcode = publicOutcode(postcode);
  const town = publicTown(city);
  if (town && outcode) return `${town} ${outcode}`;
  return town || outcode || 'Location not provided';
}
