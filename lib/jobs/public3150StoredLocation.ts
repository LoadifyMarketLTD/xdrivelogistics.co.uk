import { public3150RouteLabel } from './public3150RouteLabel';

/** Removes house/street details from transport locations before presenting Loads in the approved 3150 exchange board. */
export function public3150StoredLocation(location: string | null, postcode: string | null | undefined) {
  const parts = String(location ?? '').split(',').map(part => part.trim()).filter(Boolean);
  const last = parts.at(-1) || '';
  const completePostcode = String(postcode ?? '').trim().toUpperCase();
  const lastIsPostcode = Boolean(completePostcode && last.toUpperCase().includes(completePostcode));
  const probableTown = lastIsPostcode && parts.length > 1 ? parts.at(-2) : last;
  return public3150RouteLabel(probableTown, postcode);
}