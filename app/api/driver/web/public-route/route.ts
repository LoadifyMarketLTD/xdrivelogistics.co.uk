import { NextRequest, NextResponse } from 'next/server';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';

const valid = (n: number, limit: number) => Number.isFinite(n) && Math.abs(n) <= limit;
type RouteResult = { geometry: { type: 'LineString'; coordinates: number[][] }; distance: number; duration: number };
const parseRoute = (data: unknown): RouteResult | null => {
  if (!data || typeof data !== 'object') return null;
  const routes = (data as { routes?: unknown }).routes;
  if (!Array.isArray(routes)) return null;
  const route = routes[0] as RouteResult | undefined;
  if (!route || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2) return null;
  if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
  if (!route.geometry.coordinates.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite))) return null;
  return route;
};

export async function GET(request: NextRequest) {
  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  const params = new URL(request.url).searchParams;
  const names = ['aLat', 'aLng', 'bLat', 'bLng'] as const;
  if (names.some(name => params.get(name) === null || params.get(name) === '')) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }
  const [aLat, aLng, bLat, bLng] = names.map(name => Number(params.get(name)));
  if (![aLat, bLat].every(n => valid(n, 90)) || ![aLng, bLng].every(n => valid(n, 180))) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }
  const coordinates = `${aLng},${aLat};${bLng},${bLat}`;
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  const endpoints: URL[] = [];
  if (token) {
    const mapbox = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}`);
    mapbox.searchParams.set('geometries', 'geojson');
    mapbox.searchParams.set('overview', 'full');
    mapbox.searchParams.set('access_token', token);
    endpoints.push(mapbox);
  }
  // OSRM public routing is a fallback for map rendering, not a navigation SLA.
  const osrm = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
  osrm.searchParams.set('geometries', 'geojson');
  osrm.searchParams.set('overview', 'full');
  endpoints.push(osrm);
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(7000), cache: 'no-store' });
      if (!response.ok) continue;
      const route = parseRoute(await response.json());
      if (!route) continue;
      return NextResponse.json({
        geometry: route.geometry,
        distanceMiles: Math.round(route.distance / 1609.344 * 10) / 10,
        durationMinutes: Math.round(route.duration / 60),
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch { /* Try the next routing provider. */ }
  }
  return NextResponse.json({ error: 'Routing unavailable' }, { status: 503 });
}
