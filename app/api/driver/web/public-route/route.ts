import { NextRequest, NextResponse } from 'next/server';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';

const valid = (n: number, limit: number) => Number.isFinite(n) && Math.abs(n) <= limit;
export async function GET(request: NextRequest) {
  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  const url = new URL(request.url);
  const aLat = Number(url.searchParams.get('aLat'));
  const aLng = Number(url.searchParams.get('aLng'));
  const bLat = Number(url.searchParams.get('bLat'));
  const bLng = Number(url.searchParams.get('bLng'));
  if (![aLat,bLat].every(n => valid(n,90)) || ![aLng,bLng].every(n => valid(n,180))) {
    return NextResponse.json({error:'Invalid coordinates'},{status:400});
  }
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return NextResponse.json({error:'Routing unavailable'},{status:503});
  const endpoint = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${aLng},${aLat};${bLng},${bLat}`);
  endpoint.searchParams.set('geometries','geojson');
  endpoint.searchParams.set('overview','full');
  endpoint.searchParams.set('access_token',token);
  try {
    const response = await fetch(endpoint,{signal:AbortSignal.timeout(8500),cache:'no-store'});
    if (!response.ok) return NextResponse.json({error:'Routing unavailable'},{status:502});
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) {
      return NextResponse.json({error:'Route unavailable'},{status:502});
    }
    return NextResponse.json({geometry:route.geometry, distanceMiles:Math.round(route.distance/1609.344*10)/10, durationMinutes:Math.round(route.duration/60)}, {headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return NextResponse.json({error:'Routing unavailable'},{status:503});
  }
}
