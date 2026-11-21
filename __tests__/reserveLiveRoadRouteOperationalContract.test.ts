import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const route=read('driver-pwa-reserve/src/RouteMap.tsx');
const app=read('driver-pwa-reserve/src/ReserveApp.tsx');
const canonical=read('app/api/driver/web/public-route/route.ts');
describe('Live road route operational recovery',()=>{
 it('calculates before quote independent job and driver-to-collection legs',()=>{
  expect(route).toContain('Driver → {nextLabel}:');
  expect(route).toContain('Collection → delivery:');
  expect(route).toContain('if(missingStops===0&&points.length>=2)');
  expect(route).toContain('if(position)');
  expect(route).toContain('setJobMetrics({miles:totalMiles,minutes:totalMinutes})');
  expect(route).toContain('setPickupMetrics({miles:road.distanceMiles,minutes:road.durationMinutes})');
 });
 it('after loading targets delivery rather than already-completed collection',()=>{
  expect(route).toContain('"LOADED","ON_WAY_TO_DELIVERY","ON_SITE_DELIVERY"');
  expect(route).toContain('stops.filter(s=>!s.completedAt)');
  expect(route).toContain('if(afterCollection && remaining.length && remaining[0].kind==="PICKUP"');
  expect(app).toContain('completedAt:s.completedAt');
 });
 it('uses the existing authenticated XDrive main Mapbox/OSRM fallback backend',()=>{
  expect(route).toContain('requestPath("/driver/web/public-route")');
  expect(route).toContain('Authorization: "Bearer "+token');
  expect(app).toContain('token={session?.token}');
  expect(canonical).toContain('requireWebDriver(request)');
  expect(canonical).toContain('MAPBOX_ACCESS_TOKEN');
  expect(route).not.toContain('fetch("https://router.project-osrm.org');
 });
 it('cannot label straight line or posted job distances as verified road miles',()=>{
  expect(route).toContain('result.geometry?.type!=="LineString"');
  expect(route).toContain('Road distance unavailable');
  expect(route).toContain('Posted job distance (not verified by map)');
  expect(route).not.toContain('dashArray:');
  expect(route).not.toContain('Showing straight-line stop connections');
 });
 it('keeps location permission, GPS updates, all stop markers and fit route',()=>{
  expect(route).toContain('navigator.geolocation.watchPosition(');
  expect(route).toContain('navigator.geolocation.clearWatch(id)');
  expect(route).toContain('stop.kind==="PICKUP"');
  expect(route).toContain('Fit entire route');
  expect(route).toContain('controller.abort()');
  expect(route).toContain('0.0005');
 });
});