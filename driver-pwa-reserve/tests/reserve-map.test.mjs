import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const map=fs.readFileSync(new URL('../src/RouteMap.tsx',import.meta.url),'utf8');
test('Reserve uses the real Leaflet RouteMap reused from main',()=>{
 assert.match(app,/import RouteMap from ['"]\.\/RouteMap['"]/);
 assert.match(map,/from ['"]leaflet['"]/);
 assert.match(map,/nominatim\.openstreetmap\.org/);
 assert.match(map,/router\.project-osrm\.org/);
});
test('View on Map is wired from job cards and Load Details',()=>{
 assert.match(app,/function openMap\(j:LiveJob/);
 assert.match(app,/rv-map-action.*openMap\(j,'list'\).*View on Map/);
 assert.match(app,/rv-map-action rv-wide.*openMap\(job,'details'\).*View on Map/);
 assert.match(app,/view==='map'&&job&&<RouteMap/);
 assert.match(app,/onBack=\{\(\)=>setView\(mapReturnView\)\}/);
});
test('Private full addresses not disclosed on OPEN marketplace maps',()=>{
 assert.match(app,/job\.status==='OPEN'\?job\.from/);
 assert.match(app,/job\.status==='OPEN'\?job\.to/);
});
test('Obstructive statistics cards not rendered in Loads',()=>{
 assert.doesNotMatch(app,/rv-feedinfo|Marketplace <b>|Quoted open <b>|Bid history <b>|Bookings <b>/);
});
