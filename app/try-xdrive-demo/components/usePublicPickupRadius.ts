'use client';

import { useEffect, useMemo, useState } from 'react';

type Coordinates = { lat: number; lng: number };
type Resolution = Coordinates | null;
const outcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?$/;
export const publicPickupOutcode = (value: string) =>
  value.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/)?.[1] ?? '';

/** An exact public outcode must remain visible even when geocoding fails. */
export function matchesPublicPickupRadius(
  pickup: string, centre: string, coordinates: Readonly<Record<string, Resolution>>, miles: number,
): boolean {
  if (!centre) return true;
  const pickupOutcode = publicPickupOutcode(pickup);
  if (pickupOutcode === centre) return true;
  const origin = coordinates[centre];
  const destination = coordinates[pickupOutcode];
  if (!origin || !destination) return false;
  return pickupDistanceMiles(origin, destination) <= miles;
}

export function pickupDistanceMiles(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Radius compares only public outcode centroids, never private stop coordinates. */
export function usePublicPickupRadius(
  loads: ReadonlyArray<{ from: string }>, query: string, active: boolean,
) {
  const [coordinates, setCoordinates] = useState<Record<string, Resolution>>({});
  const search = query.trim().toUpperCase();
  const compact = search.replace(/\s+/g, '');
  const centre = !active || !search ? ''
    : outcodePattern.test(compact) ? compact
    : publicPickupOutcode(loads.find(load => load.from.toUpperCase().includes(search))?.from ?? '');

  const required = useMemo(
    () => centre ? Array.from(new Set([centre, ...loads.map(load => publicPickupOutcode(load.from)).filter(Boolean)])) : [],
    [centre, loads],
  );
  const pending = required.filter(outcode => coordinates[outcode] === undefined);
  const pendingKey = pending.join(',');

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    // Prioritise the requested outcode; avoid 30 simultaneous external lookups.
    // Batches prevent postcode-service throttling and transient timeouts.
    const pendingCodes = pendingKey.split(',').sort((a, b) => Number(b === centre) - Number(a === centre));
    const resolveCode = async (outcode: string) => {
      try {
        const response = await fetch('/api/location/postcode-area?q=' + encodeURIComponent(outcode),
          { cache: 'no-store', signal: AbortSignal.timeout(7000) });
        if (!response.ok) return [outcode, null] as const;
        const payload = await response.json() as { latitude?: number | null; longitude?: number | null };
        return [outcode, typeof payload.latitude === 'number' && typeof payload.longitude === 'number'
          && Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude)
          ? { lat: payload.latitude, lng: payload.longitude } : null] as const;
      } catch {
        return [outcode, null] as const;
      }
    };
    // React schedules the next batch after these results enter the cache.
    // Resolve the entered outcode alone first, then four surrounding outcodes.
    const batch = pendingCodes.slice(0, pendingCodes[0] === centre ? 1 : 4);
    void Promise.all(batch.map(resolveCode)).then(entries => {
      if (!cancelled) setCoordinates(current => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [pendingKey, centre]);

  return {
    centre,
    locating: Boolean(centre && pending.length),
    unavailable: Boolean(centre && !pending.length && !coordinates[centre]),
    withinRadius: (pickup: string, miles: number) =>
      matchesPublicPickupRadius(pickup, centre, coordinates, miles),
  };
}
