import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const source=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/RouteMap.tsx'),'utf8');
const app=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/ReserveApp.tsx'),'utf8');
describe('Reserve PWA public place / postcode area routing',()=>{
 it('preserves map, GPS truck and fit route controls',()=>{
  expect(source).toContain('L.map(host.current');
  expect(source).toContain('L.marker([position.lat,position.lon]');
  expect(source).toContain('Fit entire route');
 });
 it('recognizes Blackburn, Burnley, Manchester and St Helens',()=>{
  for(const place of ['blackburn:{lat:53.748','burnley:{lat:53.79','manchester:{lat:53.48','"st helens":{lat:53.453']) expect(source).toContain(place);
  expect(source).toContain('CITY[normalized.toLowerCase()]');
 });
 it('uses authenticated postcode-outcode API for public loads',()=>{
  expect(source).toContain('"/driver/web/public-outcode"');
  expect(source).toContain('const key=(precise?');
  expect(source).toContain('Authorization: "Bearer "+token');
  expect(app).toContain('token={session?.token}');
 });
 it('resolves full postcode only after award, not for an open public load',()=>{
  expect(source).toContain('if(precise&&fullPostcode&&token)');
  expect(source).toContain('api.postcodes.io/postcodes/');
  expect(source).toContain("status!=='OPEN'");
 });
 it('does not present unverified road mileage or fake straight-line road routes',()=>{
  expect(source).toContain('Posted job distance (not verified by map)');
  expect(source).toContain('Verified road distance unavailable');
  expect(source).not.toContain('dashArray:');
 });
});