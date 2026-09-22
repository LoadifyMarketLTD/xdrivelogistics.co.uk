type RouteCoordinates = { lat: number; lng: number };

type ProviderRoute = {
  distanceMiles: number;
  durationMinutes: number;
};

export type JobRouteMetrics = {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  distanceMiles: number;
  durationMinutes: number;
  source: 'mapbox_driving' | 'google_directions' | 'osrm_driving';
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
      const response = await fetch('https://api.postcodes.io/outcodes/' + encodeURIComponent(outcode), {
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

function roundedRoute(metres: number, seconds: number): ProviderRoute | null {
  if (!Number.isFinite(metres) || metres <= 0 || !Number.isFinite(seconds) || seconds <= 0) return null;
  return {
    distanceMiles: Math.round((metres / 1609.344) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
  };
}

async function routeWithMapbox(points: RouteCoordinates[], token: string): Promise<ProviderRoute | null> {
  const coordinatePath = points.map((point) => String(point.lng) + ',' + String(point.lat)).join(';');
  const url = new URL('https://api.mapbox.com/directions/v5/mapbox/driving/' + coordinatePath);
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
    return roundedRoute(Number(route?.distance), Number(route?.duration));
  } catch {
    return null;
  }
}

async function routeWithGoogle(points: RouteCoordinates[], token: string): Promise<ProviderRoute | null> {
  const origin = points[0];
  const destination = points[points.length - 1];
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', String(origin.lat) + ',' + String(origin.lng));
  url.searchParams.set('destination', String(destination.lat) + ',' + String(destination.lng));
  if (points.length > 2) {
    url.searchParams.set(
      'waypoints',
      points.slice(1, -1).map((point) => String(point.lat) + ',' + String(point.lng)).join('|'),
    );
  }
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', token);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      status?: string;
      routes?: Array<{
        legs?: Array<{
          distance?: { value?: number };
          duration?: { value?: number };
        }>;
      }>;
    };
    if (payload.status !== 'OK') return null;
    const legs = payload.routes?.[0]?.legs ?? [];
    if (legs.length === 0) return null;

    let metres = 0;
    let seconds = 0;
    for (const leg of legs) {
      metres += Number(leg.distance?.value);
      seconds += Number(leg.duration?.value);
    }
    return roundedRoute(metres, seconds);
  } catch {
    return null;
  }
}

async function routeWithOsrm(points: RouteCoordinates[]): Promise<ProviderRoute | null> {
  const coordinatePath = points.map((point) => String(point.lng) + ',' + String(point.lat)).join(';');
  const url = new URL('https://router.project-osrm.org/route/v1/driving/' + coordinatePath);
  url.searchParams.set('overview', 'false');
  url.searchParams.set('steps', 'false');

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
      headers: { 'User-Agent': 'XDriveLogistics/1.0 route-metrics' },
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      code?: string;
      routes?: Array<{ distance?: number; duration?: number }>;
    };
    if (payload.code !== 'Ok') return null;
    const route = payload.routes?.[0];
    return roundedRoute(Number(route?.distance), Number(route?.duration));
  } catch {
    return null;
  }
}

export async function calculateDrivingRoute(points: RouteCoordinates[]): Promise<(ProviderRoute & { source: JobRouteMetrics['source'] }) | null> {
  if (points.length < 2) return null;

  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (mapboxToken) {
    const route = await routeWithMapbox(points, mapboxToken);
    if (route) {
      return { ...route, source: 'mapbox_driving' };
    }
  }

  const googleToken = (
    process.env.GOOGLE_MAPS_API_KEY
    ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    ?? ''
  ).trim();
  if (googleToken) {
    const route = await routeWithGoogle(points, googleToken);
    if (route) {
      return { ...route, source: 'google_directions' };
    }
  }

  const osrmRoute = await routeWithOsrm(points);
  if (osrmRoute) {
    return { ...osrmRoute, source: 'osrm_driving' };
  }

  return null;
}

export async function calculateJobRouteMetrics(postcodes: string[]): Promise<JobRouteMetrics | null> {
  const ordered = postcodes.map(postcodeKey).filter(Boolean);
  if (ordered.length < 2) return null;

  const geocoded = await geocodePostcodes(ordered);
  const coordinates = ordered.map((postcode) => geocoded.get(postcode) ?? null);
  if (coordinates.some((item) => item === null)) return null;

  const points = coordinates as RouteCoordinates[];
  const route = await calculateDrivingRoute(points);
  if (!route) return null;

  return {
    pickupLat: points[0].lat,
    pickupLng: points[0].lng,
    deliveryLat: points[points.length - 1].lat,
    deliveryLng: points[points.length - 1].lng,
    distanceMiles: route.distanceMiles,
    durationMinutes: route.durationMinutes,
    source: route.source,
  };
}
