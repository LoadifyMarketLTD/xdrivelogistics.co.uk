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
test('Loads begins immediately with the first job card, no heading/search/filter/refresh block',()=>{
 const list=app.split('  function list(){')[1].split('  function quoteDetails()')[0];
 assert.doesNotMatch(list,/<h1>Bookings<\/h1>|tab === 'Bookings' && <div className="rv-heading/);
 assert.doesNotMatch(list,/rv-search|Search town|Filter by vehicle|setSearch|setVehicleFilter|tab === 'Loads' && <div className="rv-heading"/);
 assert.match(list,/shown.length \? shown.map\(card\)/);
});
test('Quotes tabs and their cards begin immediately below header, without My Quotes/Refresh row',()=>{
 const list=app.split('  function list(){')[1].split('  function quoteDetails()')[0];
 assert.match(list,/tab==='Quotes'&&<div className="rv-quote-tabs"/);
 assert.doesNotMatch(list,/My Quotes<\/h1>|tab === 'Quotes' \? 'My Quotes'/);
 assert.match(app,/rv-card-first-list/);
 const styles=fs.readFileSync(new URL('../src/ReserveApp.css',import.meta.url),'utf8');
 assert.match(styles,/\.rv-main\.rv-card-first-list\{padding:4px 10px 24px/);
 assert.match(styles,/\.rv-card-first-list \.rv-quote-tabs\{margin:4px 0 7px/);
});
test('Bookings tabs and cards are immediately beneath the navbar without heading or refresh',()=>{
 const list=app.split('  function list(){')[1].split('  function quoteDetails()')[0];
 assert.match(list,/tab==='Bookings'&&<div className="rv-quote-tabs rv-booking-tabs"/);
 assert.doesNotMatch(list,/<h1>Bookings<\/h1>|className="rv-refresh"/);
 assert.match(app,/tab==='Quotes'\|\|tab==='Bookings'/);
 const styles=fs.readFileSync(new URL('../src/ReserveApp.css',import.meta.url),'utf8');
 assert.match(styles,/\.rv-main\.rv-card-first-list\{padding:4px 10px 24px/);
});
