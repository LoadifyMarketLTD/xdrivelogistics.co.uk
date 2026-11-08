'use client';

import { useEffect, useMemo, useState } from 'react';

type Coordinates = { lat: number; lng: number };
type Resolution = Coordinates | null;
const outcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?$/;
export const publicPickupOutcode = (value: string) =>
  value.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/)?.[1] ?? '';

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
    const pendingCodes = pendingKey.split(',');
    void Promise.all(pendingCodes.map(async outcode => {
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
    })).then(entries => {
      if (!cancelled) setCoordinates(current => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [pendingKey]);

  return {
    centre,
    locating: Boolean(centre && pending.length),
    unavailable: Boolean(centre && !pending.length && !coordinates[centre]),
    withinRadius: (pickup: string, miles: number) => {
      if (!centre) return true;
      const origin = coordinates[centre];
      const destination = coordinates[publicPickupOutcode(pickup)];
      if (!origin || !destination) return false;
      return pickupDistanceMiles(origin, destination) <= miles;
    },
  };
}
