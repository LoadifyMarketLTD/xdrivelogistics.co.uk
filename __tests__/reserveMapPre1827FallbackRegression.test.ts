import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';

const source=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/RouteMap.tsx'),'utf8');
describe('Restore driver map pre-18-Nov 18:27 failure behavior',()=>{
  it('restores old dashed straight-line fallback without labeling it as road routing',()=>{
    expect(source).toContain('dashArray:"8 8"');
    expect(source).toContain('Showing straight-line stop connections (not a road route).');
    expect(source).toContain('L.polyline(pair.map(p=>[p.lat,p.lon]');
  });
  it('preserves valid OSRM road geometry as a solid route',()=>{
    expect(source).toContain('router.project-osrm.org/route/v1/driving/');
    expect(source).toContain('L.polyline(route.geometry.coordinates.map');
    expect(source).toContain('weight:5,opacity:.9');
  });
  it('preserves GPS truck position, all remaining multistop pins and route fit',()=>{
    expect(source).toContain('navigator.geolocation.watchPosition');
    expect(source).toContain('stops?.length ? stops.filter(stop=>!stop.completedAt)');
    expect(source).toContain('(s.kind==="PICKUP"?"C":"D")+String(i+1)');
    expect(source).toContain('Fit entire route');
  });
  it('does not invent a road mileage when routing fails',()=>{
    expect(source).toContain('Posted job distance (not verified by map)');
    expect(source).toContain('setJobMetrics({miles:jobMiles,minutes:Math.round(jobMinutes)})');
    expect(source).toContain('jobMiles>0');
  });
});