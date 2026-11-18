import { formatPublicOutcode } from './formatPublicOutcode';

/** Public exchange routes must never reveal house numbers or full addresses before award. */
export function public3150RouteLabel(location: string | null | undefined, postcode: string | null | undefined) {
  const outcode = formatPublicOutcode(postcode);
  const town = String(location ?? '').trim();
  const plausibleTown = /^[A-Za-z][A-Za-z '-]{1,40}$/.test(town)
    && !/\b(street|road|avenue|drive|lane|close|court|house|unit|flat)\b/i.test(town);
  return plausibleTown ? `${town}, ${outcode}` : outcode;
}