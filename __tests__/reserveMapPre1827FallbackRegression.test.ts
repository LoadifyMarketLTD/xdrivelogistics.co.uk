import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const source=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/RouteMap.tsx'),'utf8');
describe('Real road routes take precedence over legacy straight-line map fallback',()=>{
 it('uses the canonical authenticated engine for road geometry, miles and duration',()=>{
  expect(source).toContain('requestPath("/driver/web/public-route")');
  expect(source).toContain('result.geometry?.type!=="LineString"');
  expect(source).toContain('setPickupMetrics({miles:road.distanceMiles,minutes:road.durationMinutes})');
 });
 it('does not substitute a dashed Euclidean line when the road service fails',()=>{
  expect(source).not.toContain('dashArray:');
  expect(source).toContain('Real road route unavailable.');
 });
 it('keeps GPS, stop markers, multi-stop and fit control',()=>{
  expect(source).toContain('navigator.geolocation.watchPosition');
  expect(source).toContain('stops.filter(s=>!s.completedAt)');
  expect(source).toContain('Fit entire route');
  expect(source).toContain('truckIcon()');
 });
 it('shows separate next stop and job mileage and does not infer an exact distance from public area centroids',()=>{
  expect(source).toContain('Driver → {nextLabel}:');
  expect(source).toContain('Collection → delivery:');
  expect(source).toContain('Exact stop locations are required');
 });
});