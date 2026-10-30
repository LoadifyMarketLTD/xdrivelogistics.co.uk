import {describe,expect,it} from 'vitest';
import {driverBookingScreen} from '../lib/jobs/driverBookingScreens';
describe('approved XDrive 11-screen booking journey backed by persisted statuses',()=>{
 it.each([
 ['accepted',false,null,1,'Job Awarded / Booking Details'],
 ['on_my_way',false,null,2,'On My Way to Pickup'],
 ['on_site_pickup',false,null,3,'On Site at Pickup'],
 ['loaded',false,null,4,'Loaded / Collected'],
 ['in_transit',false,null,5,'In Transit to Delivery'],
 ['on_site_delivery',false,null,6,'On Site at Delivery'],
 ['delivered',false,null,7,'Proof of Delivery (POD)'],
 ['completed',true,null,8,'POD Recorded'],
 ['completed',true,'draft',9,'Invoice Draft'],
 ['completed',true,'issued',10,'Invoice Issued'],
 ['completed',true,'sent',11,'Invoice Sent / Payment Tracking']
 ] as const)('maps %s, POD=%s invoice=%s to approved screen %s', (status,pod,invoice,number,title)=>{
  expect(driverBookingScreen(status,pod,invoice)).toEqual({number,title});
 });
 it('uses persisted payment status for the final approved screen',()=>{
  expect(driverBookingScreen('completed',true,'sent','partially_paid').number).toBe(11);
  expect(driverBookingScreen('completed',true,'issued','paid').number).toBe(11);
  expect(driverBookingScreen('completed',false,'sent','paid').number).toBe(7);
 });
 it('never shows invoice merely because delivery happened',()=>{
  expect(driverBookingScreen('delivered',false,'draft').number).toBe(7);
  expect(driverBookingScreen('delivered',false,null).number).toBe(7);
 });
});
