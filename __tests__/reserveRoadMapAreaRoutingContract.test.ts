import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const text=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/RouteMap.tsx'),'utf8');
const shell=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/ReserveApp.tsx'),'utf8');
describe('Reserve Driver PWA road route preservation',()=>{
  it('preserves the original Leaflet map, truck, stops and fit route controls',()=>{
    expect(text).toContain('L.map(element.current');
    expect(text).toContain('L.polyline(route.geometry.coordinates.map');
    expect(text).toContain('Driver GPS');
    expect(text).toContain('Fit entire route');
    expect(text).toContain('s.kind==="PICKUP"?"C":"D"');
  });
  it('resolves only published public postcode districts by centroid before Nominatim fallback',()=>{
    expect(text).toContain('https://api.postcodes.io/outcodes/');
    expect(text).toContain('address.trim().toUpperCase().match(');
    expect(text).toContain('https://nominatim.openstreetmap.org/search?');
    expect(text).toContain('if (LOCAL) return null;');
    expect(text).toContain('cache.set(address,point);return point');
  });
  it('retains OSRM road geometry and verified miles and minutes',()=>{
    expect(text).toContain('https://router.project-osrm.org/route/v1/driving/');
    expect(text).toContain('setDistanceToTarget(route.distance/1609.344)');
    expect(text).toContain('setTargetMinutes(Math.round(route.duration/60))');
    expect(text).toContain('setJobMetrics({miles:jobMiles,minutes:Math.round(jobMinutes)})');
    expect(text).toContain('setRouteReady(true)');
  });
  it('distinguishes loading, verified route, unavailable road service and prevents false zero job distance',()=>{
    expect(text).toContain('Calculating road route');
    expect(text).toContain('Road route shown');
    expect(text).toContain('routeError&&');
    expect(text).toContain('distanceMiles>0');
    expect(text).not.toContain('Showing straight-line stop connections.');
  });
  it('does not change the existing route entry and protected booking stop visibility',()=>{
    expect(shell).toContain("job.status==='OPEN'?job.from:(job.pickupAddress||job.from)");
    expect(shell).toContain("job.status==='OPEN'?job.to:(job.deliveryAddress||job.to)");
    expect(shell).toContain('stops={job.status==="OPEN"?undefined:job.routeStops?.map');
  });
});