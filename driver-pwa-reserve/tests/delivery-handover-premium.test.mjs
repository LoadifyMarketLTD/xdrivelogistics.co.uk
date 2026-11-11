import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file=(name)=>fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const view=file('DeliveryHandover.tsx'), app=file('ReserveApp.tsx'),css=file('ReserveApp.css');
test('compact delivery screen uses real job and a single grouped handover',()=>{
 for(const part of ['Complete Delivery','Recipient handover','Received By','Recipient signature','Left At','Items','Delivery condition','Driver notes','job.from','job.to','job.delivery'])assert.ok(view.includes(part),part);
 assert.doesNotMatch(view,/BookingStatusTimeline|BOOKINGS \/ OPERATIONAL WORKFLOW|rv-progress/);
 assert.match(app,/job.status==='ON_SITE_DELIVERY'\)\{/);
 assert.match(app,/<DeliveryHandover job=\{job\}/);
});
test('signature uses pointer capture and retains actual captured PNG, not a fake checkbox',()=>{
 for(const part of ['setPointerCapture','releasePointerCapture','onPointerDown','onPointerMove','onPointerUp','onPointerCancel',"toDataURL('image/png')",'touch-action:none','onChange(null)'])assert.ok((view+'\n'+css).includes(part),part);
 assert.doesNotMatch(view,/signature confirmed|type="checkbox"/i);
});
test('required handover and at least one actual photo gate the delivery action',()=>{
 assert.match(view,/value.recipient.trim\(\).length>=2/);
 assert.match(view,/Boolean\(signature\)/);
 assert.match(view,/Number\.isInteger\(Number\(value.items\)\)/);
 assert.match(view,/photos.some\(f=>f.type==='image\/jpeg'\|\|f.type==='image\/png'\)/);
 assert.match(view,/disabled=\{busy\|\|!ready\}/);
 assert.match(app,/podFiles.some\(f=>\['image\/png','image\/jpeg'\].includes\(f.type\)\)/);
});
test('camera and multi-file uploads carry the original File objects into official POD flow',()=>{
 assert.match(view,/navigator\.mediaDevices\.getUserMedia/);
 assert.match(view,/videoRef\.current/);
 assert.match(view,/Capture photo/);
 assert.match(view,/Add files/);
 assert.match(view,/onPhotos\(unique\)/);
 assert.match(view,/file.size>10\*1024\*1024/);
 assert.match(view,/file.type==='application\/pdf'/);
 assert.match(app,/onPhotos=\{v=>\{setPodFiles\(v\);setError\(''\);\}\}/);
 assert.match(app,/for\(const file of podFiles\)/);
 assert.match(app,/signatureData:signature/);
 assert.match(app,/photoUris:photos,documentUris:documents/);
});
test('production and preview use respective real XDrive driver API paths',()=>{
 assert.match(app,/import.meta.env.PROD \? '\/api\/driver' : '\/xdrive-api\/driver'/);
 assert.match(app,/fetch\(driverApi\+'\/web\/jobs\/'/);
 assert.match(app,/fetch\(driverApi\+'\/mobile\/jobs\/'/);
});
test('real invoice generator and a separate read-only booking status remain connected',()=>{
 assert.match(app,/Create Invoice \+ Complete POD/);
 assert.match(app,/<LiveInvoiceFlow/);
 assert.match(app,/<BookingStatusTimeline job=\{job\}\/>/);
 assert.match(app,/view==='statusHistory'/);
});
test('compact UX avoids 300px-high notes and limits canvas while retaining bottom navigation',()=>{
 assert.match(css,/\.rv-delivery-signature canvas\{[^}]*height:113px/);
 assert.match(css,/\.rv-delivery-field textarea\{[^}]*min-height:56px/);
 assert.match(css,/\.rv-delivery-attach-actions\{[^}]*grid-template-columns:1fr 1fr/);
 assert.match(app,/className="rv-nav"/);
});
