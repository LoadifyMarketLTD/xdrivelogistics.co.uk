import {test,expect} from '@playwright/test';

import {readFileSync} from 'node:fs';
const credentialsSource=process.env.E2E_OWNER_TEST_ENV_FILE;
if(credentialsSource){
 const contents=readFileSync(credentialsSource,'utf8');
 for(const rawLine of contents.split(/\r?\n/)){
  const match=rawLine.match(/^\s*(E2E_OWNER_DRIVER_EMAIL|E2E_OWNER_DRIVER_PASSWORD)=(.*)$/);
  if(match)process.env[match[1].replace('E2E_OWNER_DRIVER_','E2E_LIFECYCLE_DRIVER_')]=match[2].trim().replace(/^['\"]|['\"]$/g,'');
 }
}
const companyAccount=process.env.E2E_AUTH_DRIVER_VARIANT==='company';
const email=companyAccount?process.env.E2E_COMPANY_DRIVER_EMAIL||'':process.env.E2E_LIFECYCLE_DRIVER_EMAIL||'';
const password=companyAccount?process.env.E2E_COMPANY_DRIVER_PASSWORD||'':process.env.E2E_LIFECYCLE_DRIVER_PASSWORD||'';

test.describe('Driver PWA read-only authenticated journey - never writes jobs',()=>{
 test.skip(!email||!password,'No authorized test account configured');
 test('authenticated driver can inspect Loads, My Quotes, Bookings, award inbox',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  const apiResults:Record<string,number[]>={}; const resultCounts:Record<string,number[]>={}; const pendingCounts:Promise<void>[]=[];
  page.on('request',request=>{if(request.url().includes('/auth/v1/token'))console.log('AUTH_TOKEN_REQUEST',request.method());});
  page.on('requestfailed',request=>{if(request.url().includes('/api/driver/'))console.log('DRIVER_REQUEST_FAILED',new URL(request.url()).pathname,request.failure()?.errorText);});
  page.on('response',response=>{
   if(response.url().includes('/auth/v1/token'))console.log('AUTH_TOKEN_HTTP',response.status());
   const p=new URL(response.url()).pathname;
   if(p.startsWith('/api/driver/')||p==='/api/booking-offers'){
    (apiResults[p]??=[]).push(response.status()); if(response.ok()){pendingCounts.push((async()=>{const data=await response.json() as {loads?:unknown[];jobs?:unknown[];offers?:unknown[]};const list=data.loads??data.jobs??data.offers;if(Array.isArray(list))(resultCounts[p]??=[]).push(list.length);})().catch(()=>{}));}
   }
  });
  await page.goto('/login',{waitUntil:'domcontentloaded',timeout:30000});
  // Next.js login is client-hydrated; submitting before hydration triggers a plain GET /login? instead of auth.
  await page.waitForTimeout(700);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/,{timeout:30000});
  const pages:[string,string][]=[['/driver-pwa-fresh/jobs','main.fresh-content'],['/driver-pwa-fresh/quotes','[data-testid="fresh-quotes"]'],['/driver-pwa-fresh/bookings','[data-testid="fresh-bookings"]'],['/driver-pwa-fresh/booking-offers','[data-testid="driver-booking-offers"]']];
  for(const [route,selector] of pages){
   await page.goto(route,{waitUntil:'domcontentloaded'});
   await expect(page).toHaveURL(url=>url.pathname===route,{timeout:20000});
   await expect(page.locator(selector)).toBeVisible({timeout:20000});
   await expect(page.locator('body')).not.toContainText('Login service unavailable');
   await expect(page.locator('body')).not.toContainText('The driver marketplace is temporarily unavailable.');
   if(route==='/driver-pwa-fresh/bookings')await expect(page.getByText('Loading bookings...')).toBeHidden({timeout:30000});
   if(route==='/driver-pwa-fresh/quotes'){
    await expect(page.getByText(/Loading quotes/i)).toBeHidden({timeout:30000});
    console.log('QUOTES_UI_AFTER_LOADING',(await page.locator('main').innerText()).slice(0,350));
    expect(apiResults['/api/driver/marketplace/loads']||[],'Quote-history API must return HTTP 200, not merely stop spinning').toContain(200);
    await expect(page.locator('main [role="alert"]')).toHaveCount(0);
   }
   if(route==='/driver-pwa-fresh/booking-offers')await expect(page.getByText('Loading awarded jobs...')).toBeHidden({timeout:30000});
   await page.waitForTimeout(700);
   await page.screenshot({path:'automation/logs/driver-pwa-auth-'+route.split('/').pop()+'.png'});
  }
  await Promise.all(pendingCounts);console.log('READ_ONLY_DRIVER_API_STATUSES',JSON.stringify(apiResults)); console.log('READ_ONLY_DRIVER_RECORD_COUNTS',JSON.stringify(resultCounts));
  // Never click Quote Now, Accept, Decline, Cancel, POD, Invoice or Payment actions.
 });
});
