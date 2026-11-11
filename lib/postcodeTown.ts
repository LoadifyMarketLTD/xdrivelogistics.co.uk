import { validPostingTown } from './loadPostingTown';

type Feature = { properties?: { countrycode?: string; postcode?: string; city?: string } };
const cache = new Map<string, { town: string; expires: number }>();
const pending = new Map<string, Promise<string | null>>();
const compact = (value: string) => value.toUpperCase().replace(/\s/g, '');

/** Full-postcode settlement lookup, independent of address/premise search. */
export async function resolvePostcodeTown(postcode: string, latitude: unknown, longitude: unknown): Promise<string | null> {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = compact(postcode);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.town;
  const active = pending.get(key);
  if (active) return active;
  const lookup = (async () => {
    try {
      const url = new URL('https://photon.komoot.io/reverse');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('limit', '5');
      // lang=en may replace the settlement with an administrative borough.
      const response = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 300 },
        headers: { 'User-Agent': 'XDriveLogistics/1.0 postcode-town-lookup' },
      });
      if (!response.ok) return null;
      const payload = await response.json() as { features?: Feature[] };
      const towns = (Array.isArray(payload.features) ? payload.features : [])
        .filter(feature => feature.properties?.countrycode?.toUpperCase() === 'GB'
          && compact(feature.properties?.postcode ?? '') === key)
        .map(feature => feature.properties?.city?.trim() ?? '')
        .filter(town => validPostingTown(town));
      if (!towns.length || towns.some(town => town.toLowerCase() !== towns[0].toLowerCase())) return null;
      if (cache.size >= 512) cache.delete(cache.keys().next().value!);
      cache.set(key, { town: towns[0], expires: Date.now() + 86400000 });
      return towns[0];
    } catch { return null; }
  })();
  pending.set(key, lookup);
  try { return await lookup; } finally { pending.delete(key); }
}
