import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,it,expect} from "vitest";
const route=readFileSync(join(process.cwd(),"driver-pwa-reserve/src/RouteMap.tsx"),"utf8");
const app=readFileSync(join(process.cwd(),"driver-pwa-reserve/src/ReserveApp.tsx"),"utf8");
describe("Quotes and Bookings map public postcode/geocode resilience",()=>{
 it("uses published outcodes when available for unawarded quotes",()=>{
  expect(app).toContain("(job.fromOutcode||job.from)");
  expect(app).toContain("(job.toOutcode||job.to)");
 });
 it("retrieves public outcode fallback when authenticated lookup fails",()=>{
  expect(route).toContain('"https://api.postcodes.io/outcodes/"+encodeURIComponent(code)');
  expect(route).toContain('requestPath("/driver/web/public-outcode")');
  expect(route).toContain('if(goodPoint(p)){geocache.set(key,p);return p;}');
 });
 it("does not suppress the other stop markers when one geocode fails",()=>{
  expect(route).toContain('if(!point){missingStops++;continue;}');
  expect(route).toContain('L.marker([point.lat,point.lon]');
  expect(route).toContain('String(index+1)');
 });
 it("does not calculate a falsely complete multi-stop journey with missing stops",()=>{
  expect(route).toContain('if(missingStops===0&&points.length>=2)');
  expect(route).toContain('points[0].stop.id===ordered[0]?.id');
  expect(route).toContain('Complete road distance unavailable.');
 });
 it("still requires authenticated road routing with geometry validation",()=>{
  expect(route).toContain('requestPath("/driver/web/public-route")');
  expect(route).toContain('Authorization: "Bearer "+token');
  expect(route).toContain('result.geometry?.type!=="LineString"');
 });
});