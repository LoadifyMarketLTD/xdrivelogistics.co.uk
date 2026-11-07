import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
const customerAward=read('app/api/customer/bids/[id]/award/route.ts');
const adminAward=read('app/api/admin/bids/[id]/accept/route.ts');
const carrierAccept=read('app/api/booking-offers/[id]/respond/route.ts');
const reject=read('app/api/customer/bids/[id]/reject/route.ts');
const identity=read('app/api/workspace/bids/identities/route.ts');
const quotes=read('app/customer/quotes/CustomerQuotesCxPage.tsx');
const review=read('app/customer/quotes/BookingConfirmationFullPage.tsx');
describe('Customer Quotes complete API audit regression',()=>{
 it('validates load and quoted vehicle before both award endpoints',()=>{
   expect(customerAward).toContain('inspectBookingReadiness');
   expect(adminAward).toContain('inspectBookingReadiness');
 });
 it('validates load and vehicle before carrier accepts a booking',()=>{
   expect(carrierAccept).toContain('inspectBookingReadiness');
   expect(carrierAccept).toContain("parsed.data.action === 'accept'");
 });
 it('cannot reject an offer already pending carrier acceptance',()=>{
   expect(reject).toContain("from('job_booking_offers')");
   expect(reject).toContain("BOOKING_OFFER_ALREADY_PENDING");
   expect(reject).toContain(".eq('status','submitted')");
 });
 it('does not return sensitive compliance to non-decision roles',()=>{
   expect(identity).toContain('getBuyerViewMemberships');
   expect(identity).toContain('BID_DECISION_MEMBERSHIP_ROLES');
   expect(identity).toContain('allowSensitiveCompliance');
   expect(identity).toContain('identity.businessPhone=null');
 });
 it('has no inert Submitted tab and distinguishes the booking state',()=>{
   expect(quotes).not.toContain("if (statusFilter === 'submitted') return false");
   expect(quotes).toContain("statusFilter === 'pending'");
   expect(quotes).toContain("statusFilter === 'withdrawn'");
   expect(quotes).toContain('Booking offer pending');
 });
 it('prevents confirmation when collection expired, vehicle incompatible or identity unresolved',()=>{
   expect(review).toContain('pickupExpired');
   expect(review).toContain('capacityMismatch');
   expect(review).toContain('verificationBlocked');
   expect(review).toContain('!pickupExpired && !capacityMismatch && !verificationBlocked');
 });
});
