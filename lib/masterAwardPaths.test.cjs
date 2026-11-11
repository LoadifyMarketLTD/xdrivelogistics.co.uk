const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const file=name=>fs.readFileSync(path.join(base,name),'utf8');
test('broker uses approved two-acknowledgement fullscreen component instead of browser confirm',()=>{
 const broker=file('app/broker/bids/page.tsx');
 const modal=file('app/customer/quotes/BookingConfirmationFullPage.tsx');
 assert.match(broker,/setAwardCandidate\(\{bid,job,identity\}\)/);
 assert.match(broker,/selectedAward|awardCandidate/);
 assert.match(broker,/BookingConfirmationFullPage/);
 assert.doesNotMatch(broker,/confirmBookingPaymentObligation/);
 assert.match(modal,/detailsAccepted && paymentAccepted && !working/);
 assert.match(broker,/bookingPaymentObligationRequestBody/);
});
test('admin uses authenticated real job lookup and same fullscreen award with amount guard',()=>{
 const admin=file('app/admin/bids/page.tsx');
 assert.match(admin,/from\('jobs'\)/);
 assert.match(admin,/\.eq\('company_id', companyId\)/);
 assert.match(admin,/Cannot award a bid without a valid positive price/);
 assert.match(admin,/BookingConfirmationFullPage/);
 assert.doesNotMatch(admin,/confirmBookingPaymentObligation/);
 assert.match(admin,/bookingPaymentObligationRequestBody/);
});

test('customer booking details share fullscreen two-consent award confirmation',()=>{
 const customer=file('app/customer/jobs/[id]/page.tsx');
 assert.match(customer,/BookingConfirmationFullPage/);
 assert.match(customer,/selectedAwardId/);
 assert.doesNotMatch(customer,/confirmBookingPaymentObligation/);
 assert.match(customer,/bookingPaymentObligationRequestBody/);
});
