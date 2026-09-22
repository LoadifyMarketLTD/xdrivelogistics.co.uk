type RouteCoordinates = { lat: number; lng: number };

export type JobRouteMetrics = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  distanceMiles: number;
  durationMinutes: number;
  source: 'mapbox_driving';
};

function postcodeKey(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

function validCoordinates(lat: unknown, lng: unknown): RouteCoordinates | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;
  return { lat: parsedLat, lng: parsedLng };
}

async function geocodePostcodes(postcodes: string[]) {
  const unique = [...new Set(postcodes.map(postcodeKey).filter(Boolean))];
  const result = new Map<string, RouteCoordinates>();
  if (unique.length === 0) return result;

  try {
    const response = await fetch('https://api.postcodes.io/postcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcodes: unique }),
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = await response.json() as {
        result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }>;
      };
      for (const item of payload.result ?? []) {
        const coordinates = validCoordinates(item.result?.latitude, item.result?.longitude);
        if (coordinates) result.set(postcodeKey(item.query), coordinates);
      }
    }
  } catch {
    // Fall through to outcode centroids.
  }

  const unresolved = unique.filter((postcode) => !result.has(postcode));
  await Promise.all(unresolved.map(async (postcode) => {
    const outcode = postcode.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0] ?? '';
    if (!outcode) return;
    try {
      const response = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`, {
        signal: AbortSignal.timeout(5_000),
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json() as {
        result?: { latitude?: number; longitude?: number } | null;
      };
      const coordinates = validCoordinates(payload.result?.latitude, payload.result?.longitude);
      if (coordinates) result.set(postcode, coordinates);
    } catch {
      // Unknown coordinates are safer than fabricated route metrics.
    }
  }));

  return result;
}

export async function calculateJobRouteMetrics(postcodes: string[]): Promise<JobRouteMetrics | null> {
  const ordered = postcodes.map(postcodeKey).filter(Boolean);
  if (ordered.length < 2) return null;

  const geocoded = await geocodePostcodes(ordered);
  const coordinates = ordered.map((postcode) => geocoded.get(postcode) ?? null);
  if (coordinates.some((item) => item === null)) return null;

  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const points = coordinates as RouteCoordinates[];
  const coordinatePath = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatePath}`);
  url.searchParams.set('overview', 'false');
  url.searchParams.set('steps', 'false');
  url.searchParams.set('access_token', token);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      routes?: Array<{ distance?: number; duration?: number }>;
    };
    const route = payload.routes?.[0];
    const metres = Number(route?.distance);
    const seconds = Number(route?.duration);
    if (!Number.isFinite(metres) || metres <= 0 || !Number.isFinite(seconds) || seconds <= 0) return null;

    return {
      pickupLat: points[0].lat,
      pickupLng: points[0].lng,
      deliveryLat: points[points.length - 1].lat,
      deliveryLng: points[points.length - 1].lng,
      distanceMiles: Math.round((metres / 1609.344) * 10) / 10,
      durationMinutes: Math.max(1, Math.round(seconds / 60)),
      source: 'mapbox_driving',
    };
  } catch {
    return null;
  }
}
