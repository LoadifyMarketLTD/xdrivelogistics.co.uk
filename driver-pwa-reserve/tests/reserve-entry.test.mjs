import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = new URL('../src/', import.meta.url);
const text = p => readFileSync(new URL(p,src),'utf8');
test('reserve uses new React application, not original main App',()=>{
  assert.match(text('main.tsx'),/import App from ['"]\.\/ReserveApp\.tsx['"]/);
  assert.doesNotMatch(text('main.tsx'),/\.\/App\.tsx/);
});
test('independent incoming booking, quote, delivery and real POD actions',()=>{
  const app=text('ReserveApp.tsx');
  for(const phrase of ['New Job Received','View Booking Details','Decline Job','Accept Job','Submit Quote','On My Way to Collection','On Site Collection','Complete Collection','On My Way to Delivery','On Site Delivery','Received By (Full Name)','Recipient Signature','Save Signed POD']) assert.ok(app.includes(phrase), 'Missing '+phrase);
  assert.ok(app.indexOf('Received By (Full Name)')<app.indexOf('Recipient Signature'));
  assert.match(app,/bookingOfferRespond/);assert.match(app,/driverPost/);
  assert.match(app,/loadLiveWithDiagnostics/);
});
test('separate manifest and no production app replacement',()=>{
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  assert.ok(main.includes('ReserveApp.tsx'));
  const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.scope,'/driver/reserve-pwa/');
});
