import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const identity=read('app/api/_lib/bidderDecisionIdentity.ts');
const customer=read('app/customer/quotes/CustomerQuotesCxPage.tsx');
const details=read('app/customer/quotes/bookingOfferReviewDetails.ts');
const screen=read('app/customer/quotes/BookingConfirmationFullPage.tsx');
const stylesheet=read('app/customer/quotes/BookingConfirmationFullPage.module.css');

// Prevent the known P0 award identity and vehicle-data conflation from recurring.
describe('Customer Award authentic Owner Driver information and persistent action',()=>{
 it('takes Owner Driver from the real driver type, not just a missing company id',()=>{
   expect(identity).toContain('driver_type');
   expect(customer).toContain("candidate.identity?.driverType === 'owner_driver'");
   expect(details).toContain("identity?.driverType === 'owner_driver'");
 });
 it('separates actual job cargo from quoted vehicle capacity',()=>{
   expect(customer).toContain('pallets: candidate.job.pallets ?? null');
   expect(customer).toContain('vehicleCapacityPallets: candidate.identity?.driverVehiclePallets ?? null');
   expect(details).toContain('pallets: job.pallets ?? null');
   expect(details).toContain('vehicleCapacityPallets: identity?.driverVehiclePallets ?? null');
   expect(screen).toContain('Pallet quantity not supplied');
   expect(screen).toContain('Vehicle capacity');
 });
 it('uses actual driver, vehicle and company evidence without assuming approval',()=>{
   expect(identity).toContain("from('driver_documents')");
   expect(identity).toContain("from('vehicle_documents')");
   expect(identity).toContain("from('company_documents')");
   expect(identity).toContain('expiryDate');
   expect(screen).toContain('documentStatusText(documentFor(name))');
   expect(screen).toContain('otherDocuments.map(');
 });
 it('preserves the full review, confirmation controls and available history',()=>{
   expect(screen).toContain('Driving licence');
   expect(screen).toContain('Goods in Transit');
   expect(screen).toContain('Member since');
   expect(screen).toContain('Completed jobs');
   expect(screen).toContain('Customer rating');
   expect(screen).toContain('Carrier Availability &amp; Booking Acceptance');
   expect(screen).toContain('checked={detailsAccepted}');
   expect(screen).toContain('checked={paymentAccepted}');
   expect(screen).toContain('checked={availabilityAcknowledged}');
   expect(screen).toContain('Send Booking Offer');
 });
 it('pins the existing award footer while the review details scroll',()=>{
   expect(stylesheet).toContain('.footer{position:fixed;left:0;right:0;bottom:0;');
   expect(stylesheet).toContain('.content{min-height:0;overscroll-behavior:contain;padding-bottom:104px}');
 });
});