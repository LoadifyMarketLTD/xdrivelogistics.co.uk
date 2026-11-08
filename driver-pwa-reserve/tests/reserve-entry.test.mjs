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
  for(const phrase of ['New Job Received','View Booking Details','Decline Job','Accept Job','Submit Quote','On My Way to Collection','On Site Collection','Complete Collection','On My Way to Delivery','On Site Delivery','Save Signed POD','<DeliveryHandover']) assert.ok(app.includes(phrase), 'Missing '+phrase);
  const handover=text('DeliveryHandover.tsx');
  const form=handover.split('return <section className="rv-delivery-page">')[1];
  assert.ok(form.indexOf('Received By')<form.indexOf('Recipient signature'));
  assert.match(app,/bookingOfferRespond/);assert.match(app,/driverPost/);
  assert.match(app,/loadLiveWithDiagnostics/);
});
test('recorded POD continues to invoice review without re-signing or claiming send',()=>{ const app=text('ReserveApp.tsx'); assert.match(app, /podDone\|\|job\.podRecorded/); assert.match(app, /Create Invoice \+ Complete POD/); assert.match(app, /setView\('invoiceJob'\)/); const finance=text('LiveInvoiceFlow.tsx'); assert.match(finance, /Invoice Preview \/ Issue/); assert.match(finance, /Send Invoice \/ Confirmation/); assert.match(finance,/generate-invoice/); assert.match(finance,/\/submit/); assert.match(finance,/delivery_message_id/); });
test('separate manifest and no production app replacement',()=>{
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  assert.ok(main.includes('ReserveApp.tsx'));
  const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.scope,'/driver/reserve-pwa/');
});
