import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const page=readFileSync('app/driver-pwa-fresh/bookings/offers/[id]/page.tsx','utf8');
const bookings=readFileSync('app/driver-pwa-fresh/bookings/page.tsx','utf8');

describe('driver booking Page 0 acceptance',()=>{
 it('uses the approved four-action layout and excludes SmartPay',()=>{
  expect(page).toContain('<FreshHeader title="Accept Job" inlineTitle/>');
  expect(page).toContain('>Map</button>');
  expect(page).toContain("Hide Details':'View Details");
  expect(page).toContain("respond('decline')");
  expect(page).toContain("respond('accept')");
  expect(page).not.toContain('SmartPay');
 });
 it('wires booking offer response and routes accepted work into the booking workflow',()=>{
  expect(page).toContain("/api/booking-offers/'+encodeURIComponent(offer.id)+'/respond");
  expect(page).toContain("router.replace('/driver-pwa-fresh/bookings/'+encodeURIComponent(offer.job_id))");
  expect(page).toContain("router.push('/driver-pwa-fresh/bookings/offers/'+encodeURIComponent(offer.id)+'/map')");
 });
 it('exposes pending booking offers from the Bookings Current tab',()=>{
  expect(bookings).toContain("fetch('/api/booking-offers'");
  expect(bookings).toContain("offer.status==='pending'");
  expect(bookings).toContain("/driver-pwa-fresh/bookings/offers/");
  expect(bookings).toContain('Review &amp; Accept');
 });
});
