import {test,expect} from '@playwright/test';
const guarded=['/driver-pwa-fresh/jobs','/driver-pwa-fresh/quotes','/driver-pwa-fresh/bookings','/driver-pwa-fresh/booking-offers'];
test.describe('PR714 unauthenticated preview security',()=>{
 for(const route of guarded){
  test('route requires sign-in: '+route,async({page})=>{
   await page.goto(route,{waitUntil:'domcontentloaded'});
   await expect(page).toHaveURL(/\/login(?:\?|$)/,{timeout:15000});
   await expect(page.locator('input[type="email"]')).toBeVisible();
   await expect(page.locator('input[type="password"]')).toBeVisible();
  });
 }
 test('booking offer API rejects missing bearer token',async({request})=>{
  const res=await request.get('/api/booking-offers');
  expect(res.status()).toBe(401);
 });
 for(const action of ['accept','decline'] as const){
  test('booking offer '+action+' rejects missing bearer token',async({request})=>{
   const res=await request.post('/api/booking-offers/00000000-0000-4000-8000-000000000000/respond',{data:{action}});
   expect(res.status()).toBe(401);
  });
 }
 test('driver loads and bids forbid anonymous reads',async({request})=>{
  for(const route of ['/api/driver/jobs?scope=all&limit=1','/api/driver/marketplace/loads?view=quote_history']){
   const res=await request.get(route);
   expect([401,403]).toContain(res.status());
  }
 });
});
