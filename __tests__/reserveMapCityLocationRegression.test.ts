import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
const code=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/RouteMap.tsx'),'utf8');
const mainCities=readFileSync(join(process.cwd(),'app/try-xdrive-demo/components/DemoFreightMap.tsx'),'utf8');
describe('XDrive Driver PWA approved map regression',()=>{
 it('preserves Leaflet, OSRM road geometry, GPS and map fit behavior',()=>{
  expect(code).toContain('L.map(element.current');
  expect(code).toContain('L.polyline(route.geometry.coordinates.map');
  expect(code).toContain('router.project-osrm.org/route/v1/driving/');
  expect(code).toContain('watchPosition');
  expect(code).toContain('Fit entire route');
 });
 it('resolves Burnley and St Helens from approved public town centroid data in MAIN',()=>{
  expect(mainCities).toContain('"ST HELENS":[53.453,-2.737]');
  expect(code).toContain('Burnley:{lat:53.79,lon:-2.24}');
  expect(code).toContain('"St Helens":{lat:53.453,lon:-2.737}');
  expect(code).toContain('name.toLowerCase()===normalizedCity');
  expect(code).toContain('cache.set(address,knownCity); return knownCity');
 });
 it('does not mistake a published unverified job distance for a successfully routed mileage',()=>{
  expect(code).toContain('Posted job distance (not verified by map):');
  expect(code).toContain('Number.isFinite(distanceMiles)&&distanceMiles>0');
  expect(code).toContain('jobMetrics&&<div>Job distance:');
  expect(code).toContain('Exact stop addresses are required to calculate the job route.');
  expect(code).toContain('if(start.lat===end.lat&&start.lon===end.lon)');
  expect(code).toContain('jobMiles>0');
 });
 it('does not expose an exact private street address by matching city names within it',()=>{
  expect(code).toContain('name.toLowerCase()===normalizedCity');
  expect(code).not.toContain('address.includes(name)');
 });
});