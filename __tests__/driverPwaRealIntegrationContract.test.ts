import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import FreshJobCard, {type Load} from '../app/driver-pwa-fresh/FreshJobCard';

const root=process.cwd();
const source=(path:string)=>readFileSync(join(root,path),'utf8');
const load:Load={
 id:'test-public-job',status:'posted',pickup_area:'Blackburn',pickup_postcode_area:'BB1',
 delivery_area:'Manchester',delivery_postcode_area:'M1',pickup_datetime:'2026-10-29T10:00:00Z',delivery_datetime:null,
 pickup_time_slot:'10:00-11:00',delivery_time_slot:'ASAP',vehicle_type:'Luton Van',requested_vehicle_label:'Luton Van',requested_vehicle_type:'luton',
 service_mode:'Same Day',public_quote_notes:'No stacking',distance_to_pickup_miles:10,distance_to_delivery_miles:null,
 distance_miles:40,weight_kg:640,pallets:2,payment_terms:'30 Days EOM',exchange_posted_at:'2026-10-29T09:00:00Z',
 member:{name:'Example Company',postedBy:'Awarding Company'},myBid:null
};
describe('Driver PWA real integration boundaries',()=>{
 it('renders approved job cards using actual typed API fields and real quote/detail routes',()=>{
  const html=renderToStaticMarkup(createElement(FreshJobCard,{load}));
  expect(html).toContain('AWARDING COMPANY');
  expect(html).toContain('BLACKBURN | BB1');
  expect(html).toContain('MANCHESTER | M1');
  expect(html).toContain('No stacking');
  expect(html).toContain('/driver-pwa-fresh/jobs/test-public-job');
  expect(html).toContain('Quote Now');
  expect(html).not.toContain('XDL-2026-00128');
 });
 it('shows optional fields only when the authenticated backend supplies them',()=>{
  const html=renderToStaticMarkup(createElement(FreshJobCard,{load:{...load,weight_kg:null,pallets:null,public_quote_notes:null,payment_terms:null}}));
  expect(html).not.toContain('Payment Terms');
  expect(html).not.toContain('640 kg');
  expect(html).not.toContain('No stacking');
 });
 it('preserves API-backed quote history and server-side withdrawal',()=>{
  const quotes=source('app/driver-pwa-fresh/quotes/page.tsx');
  expect(quotes).toContain('/api/driver/marketplace/loads?view=quote_history');
  expect(quotes).toContain('/api/driver/bids/');
  expect(quotes).toContain('/withdraw');
  expect(quotes).not.toContain('xd-demo-exchange');
 });
 it('keeps booking acceptance distinct from buyer award and uses server authority',()=>{
  const offers=source('app/driver-pwa-fresh/booking-offers/page.tsx');
  const list=source('app/driver-pwa-fresh/bookings/page.tsx');
  const server=source('app/api/booking-offers/[id]/respond/route.ts');
  expect(offers).toContain("'/api/booking-offers'");
  expect(offers).toContain("'/respond'");
  expect(offers).toContain('Accept Job');
  expect(offers).toContain('Decline Job');
  expect(offers).not.toContain('localStorage');
  expect(list).toContain('fresh-booking-offers-link');
  expect(server).toContain("'accept_job_booking_offer_atomic'");
  expect(server).toContain("'decline_job_booking_offer_atomic'");
 });
 it('preserves existing backend booking, POD and invoice execution rather than sandboxing it',()=>{
  const page=source('app/driver-pwa-fresh/bookings/[id]/page.tsx');
  expect(page).toContain('DriverJobExecutionPage');
  expect(page).toContain('mobilePwa');
  expect(page).not.toContain('xd-11-booking-sandbox');
 });
});
