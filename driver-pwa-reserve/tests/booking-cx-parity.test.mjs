import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=file=>fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
test('Bookings separates received, allocated and delivered live records',()=>{
 const app=src('ReserveApp.tsx');
 assert.match(app,/type BookingSection = 'Received' \| 'Allocated' \| 'Delivered'/);
 assert.match(app,/bookingSection==='Received'\?Boolean\(j\.acceptanceRequired\)/);
 assert.match(app,/bookingSection==='Delivered'\?\['DELIVERED','POD_SUBMITTED'\]/);
 assert.match(app,/Review Incoming Job/);
 assert.doesNotMatch(app,/Booking is not actionable because its collection time has passed/);
 assert.match(app,/Booking awarded\. Your response is required/);
 assert.match(app,/View Booking Details/);
 assert.match(app,/View POD & Status/);
});
test('Booking history originates from live backend statusHistory and never fabricated stages',()=>{
 const api=src('liveApi.ts');
 const timeline=src('BookingStatusTimeline.tsx');
 const app=src('ReserveApp.tsx');
 assert.match(api,/statusHistory: Array\.isArray\(r\.statusHistory\)/);
 assert.match(api,/get\(e,'at','timestamp','created_at','createdAt','occurred_at'\)/);
 assert.match(timeline,/events\.length\?/);
 assert.match(timeline,/Time not recorded/);
 assert.match(timeline,/No history is invented/);
 assert.match(app,/<BookingStatusTimeline job=\{job\}\/>/);
 assert.doesNotMatch(app,/<details className="rv-history"><summary>Booking Status History/);
});
test('Booking cards keep recipient-offer review and details-only map without committing operations',()=>{
 const app=src('ReserveApp.tsx');
 assert.doesNotMatch(app,/openMap\(j,'list'\)/);
 assert.match(app,/openMap\(job,'details'\)/);
 assert.match(app,/bookingOfferRespond\(s\.token,job\.offerId!,'accept'\)/);
 assert.match(app,/bookingOfferRespond\(s\.token,job\.offerId!,'decline'\)/);
});
