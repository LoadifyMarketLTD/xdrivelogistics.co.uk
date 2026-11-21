import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const r=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const pwa=r('driver-pwa-reserve/src/RouteMap.tsx');
const shell=r('driver-pwa-reserve/src/ReserveApp.tsx');
const endpoint=r('app/api/driver/web/public-route/route.ts');
describe('Driver Reserve PWA reuses canonical XDrive main routing',()=>{
 it('uses the authenticated existing platform route API, never direct frontend OSRM',()=>{
   expect(pwa).toContain("'/api/driver/web/public-route'");
   expect(pwa).toContain("'/xdrive-api/driver/web/public-route'");
   expect(pwa).toContain("Authorization:'Bearer '+token");
   expect(pwa).toContain("if(!token)throw Error");
   expect(pwa).not.toContain('fetch("https://router.project-osrm.org');
   expect(endpoint).toContain('requireWebDriver');
   expect(endpoint).toContain("const token = process.env.MAPBOX_ACCESS_TOKEN?.trim()");
 });
 it('passes current authorized session without modifying job or company access',()=>{
   expect(shell).toContain('<RouteMap token={session?.token}');
   expect(shell).toContain("job.status==='OPEN'?job.from:(job.pickupAddress||job.from)");
   expect(shell).toContain('stops={job.status==="OPEN"?undefined:job.routeStops?.map');
 });
 it('validates canonical road geometry before drawing',()=>{
   expect(pwa).toContain("route.geometry?.type!=='LineString'");
   expect(pwa).toContain('route.geometry.coordinates.length<2');
   expect(pwa).toContain('geometry.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite))');
   expect(pwa).toContain('L.polyline(geometry.map');
   expect(endpoint).toContain('parseRoute');
   expect(endpoint).toContain("Cache-Control': 'private, no-store'");
 });
 it('uses API-provided road miles and ETA, including driver-to-pickup and job legs',()=>{
   expect(pwa).toContain("setDistanceToTarget(miles)");
   expect(pwa).toContain('setTargetMinutes(minutes)');
   expect(pwa).toContain('jobMiles+=miles');
   expect(pwa).toContain('jobMinutes+=minutes');
   expect(pwa).toContain('setJobMetrics({miles:jobMiles,minutes:Math.round(jobMinutes)})');
   expect(endpoint).toContain('distanceMiles: Math.round(route.distance / 1609.344 * 10) / 10');
 });
 it('preserves marker, privacy, map fit and truthful errors',()=>{
   expect(pwa).toContain('Driver GPS');
   expect(pwa).toContain('Fit entire route');
   expect(pwa).toContain("Road routing unavailable. Route distance unavailable.");
   expect(pwa).toContain('distanceMiles>0');
   expect(shell).toContain('job.status==="OPEN"?undefined:job.routeStops');
 });
});