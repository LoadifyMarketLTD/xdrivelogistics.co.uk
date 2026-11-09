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
  for(const phrase of ['New Job Received','View Booking Details','Decline Job','Accept Job','Submit Quote','On My Way to Collection','On Site Collection','Complete Collection','On My Way to Delivery','On Site Delivery','<DeliveryHandover']) assert.ok(app.includes(phrase), 'Missing '+phrase);
  const handover=text('DeliveryHandover.tsx');
  assert.ok(handover.includes('Save Signed POD'), 'Missing Save Signed POD in handover component');
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

test('delivery evidence uploads before delivered transition and is reused for signed POD',()=>{
  const app=text('ReserveApp.tsx');
  const delivery=app.slice(app.indexOf('async function completeDelivery('),app.indexOf('async function savePod('));
  assert.ok(delivery.includes('await uploadDeliveryEvidence(j,s.token)'), 'Missing delivery upload');
  assert.ok(delivery.indexOf('await uploadDeliveryEvidence(j,s.token)')<delivery.indexOf("nextStatus:'delivered'"), 'Delivery status must follow evidence upload');
  const pod=app.slice(app.indexOf('async function savePod('),app.indexOf('function flow()'));
  assert.ok(pod.includes('await uploadDeliveryEvidence(j,s.token)'), 'POD must reuse uploaded evidence');
  assert.match(app,/uploadedEvidence\.current\.get\(file\)/);
  assert.match(app,/uploadedEvidence\.current\.set\(file,confirmedPath\)/);
});

test('signed delivery draft persists signature and evidence and restores securely',()=>{
 const app=text('ReserveApp.tsx');
 const handover=text('DeliveryHandover.tsx');
 const api=text('liveApi.ts');
 assert.match(app,/signatureData:signature,photoUris:evidence\.photos,documentUris:evidence\.documents/);
 assert.match(app,/\/'\+encodeURIComponent\(job\.id\)\+'\/pod-draft'/);
 assert.match(app,/setSignature\(previous=>previous\|\|saved\.signatureData\)/);
 assert.match(handover,/mode==='pod'&&Boolean\(job\.deliveryPhotos\?\.length\)/);
 assert.match(api,/podRecorded: r\.podGenerated === true && Boolean\(r\.deliverySignatureData\) && Boolean\(str\(r\.clientSignatureName\)\)/);
});

test('POD success requires confirmed server state and survives partial booking feed',()=>{
 const app=text('ReserveApp.tsx');
 assert.match(app,/return verified\.completed===true/);
 assert.match(app,/status:'DELIVERED',podRecorded:true/);
 assert.match(app,/const missingExecutionFeed=result\.warnings\.some/);
 assert.match(app,/if\(prior\.status!=='OPEN'&&!returnedIds\.has\(prior\.id\)\)merged\.push\(prior\)/);
 assert.match(app,/Job action saved, but live lists could not refresh/);
});
test('POD handover has one recipient signature form, no nested duplicate wrapper',()=>{
 const app=text('ReserveApp.tsx');
 const flow=app.slice(app.indexOf('function flow()'),app.indexOf('const header='));
 assert.doesNotMatch(flow, /<h3>Complete Signed POD<\/h3>/);
 assert.doesNotMatch(flow, /Captured recipient signature/);
 assert.match(flow,/mode="pod" onConfirm=\{\(\)=>void savePod\(job\)\}/);
});

test('map normalises duplicate UK postcode and requests GPS only when chosen',()=>{
  const map=text('RouteMap.tsx');
  assert.match(map,/replace\(\/,\\s\*\(\?:GB\|United Kingdom\)/);
  assert.match(map,/const postcode = cleaned\.match/);
  assert.match(map,/if\(!locationRequested\)return/);
  assert.match(map,/Show my GPS position/);
});
test('POD live audit displays one route and context-sensitive evidence guidance',()=>{
 const app=text('ReserveApp.tsx'),handover=text('DeliveryHandover.tsx');
 assert.match(app,/\(!delivered\|\|podDone\|\|job\.podRecorded\)/);
 assert.match(handover,/08 \/ 11 · POD/);
 assert.match(handover,/photosCount>0/);
 assert.match(handover,/recipient signature/);
});

test('Documents and Return Journeys menu have authenticated content and endpoints',()=>{
 const menu=text('DriverMenu.tsx');
 assert.match(menu,/'Documents':'\/documents'/);
 assert.match(menu,/'Return Journeys':'\/return-journeys\?scope=mine&page_size=10'/);
 assert.match(menu,/section==='Documents'\)setDocuments\(asRows\(result\.documents\)\)/);
 assert.match(menu,/section==='My Vehicle'\|\|section==='Documents'/);
 assert.match(menu,/section==='Return Journeys'&&!loading&&data/);
 assert.match(menu,/asRows\(data\.journeys\)\.map/);
});

test('booking offers are loaded independently of core bookings and merged into live state',()=>{
 const app=text('ReserveApp.tsx'),api=text('liveApi.ts');
 assert.match(api,/Promise\.resolve\(offerData \?\? \{\}\)/);
 assert.match(api,/export function applyBookingOffers\(/);
 assert.match(app,/void bookingOffersGet\(token\)\.then\(offers=>/);
 assert.match(app,/setJobs\(previous=>applyBookingOffers\(previous,offers\)\)/);
});
test('signed POD performs authoritative preflight and postflight to avoid duplicate submissions',()=>{
 const app=text('ReserveApp.tsx');
 assert.match(app,/if\(await officialPodComplete\(\)\)return/);
 assert.match(app,/submitError=e/);
 assert.match(app,/isComplete=await officialPodComplete\(\)/);
 assert.match(app,/POD is not confirmed complete on the server/);
});

test('incoming offer loading is explicit and timeout does not block core booking feeds',()=>{
 const app=text('ReserveApp.tsx'), api=text('liveApi.ts');
 assert.match(app,/const waitingOffers=tab==='Bookings'&&bookingSection==='Received'&&offersLoading/);
 assert.match(app,/Checking incoming booking offers/);
 assert.match(app,/offersPendingRef\.current=true/);
 assert.match(app,/offersPendingRef\.current=false/);
 assert.match(api,/jsonFetch\(url: string, init\?: RequestInit, timeoutMs\?: number\)/);
 assert.match(api,/20000\);/);
});

test('recipient signature has a distinct save button below the pad wired to verified POD draft persistence',()=>{
 const handover=text('DeliveryHandover.tsx'),app=text('ReserveApp.tsx'),styles=text('ReserveApp.css');
 assert.match(handover,/<SignaturePad value={signature} onChange={changeSignature}\/>\s*<button type="button" className="rv-signature-save"/);
 assert.match(handover,/Save Signature/);
 assert.match(handover,/Signature saved securely in the XDrive POD draft/);
 assert.ok(handover.includes('onSaveSignature:()=>Promise<void>'));
 assert.match(app,/async function saveRecipientSignature\(j:LiveJob\):Promise<void>/);
 assert.match(app,/method:'PUT'.*body:JSON.stringify\(body\)/);
 assert.match(app,/confirmation\?\.draft\?\.signatureData!==signature/);
 assert.equal((app.match(/onSaveSignature=\{\(\)=>saveRecipientSignature\(job\)\}/g)||[]).length,2);
 assert.match(styles,/\.rv-delivery-field \.rv-signature-save/);
});
