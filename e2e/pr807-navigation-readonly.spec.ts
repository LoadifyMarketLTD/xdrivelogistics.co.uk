import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

/** PR807 real top-navigation destinations, read-only and role-authorized. */
for(const item of [
 {name:'Customer',env:'CUSTOMER',loads:'/customer/loads',quotes:'/customer/quotes',bookings:'/customer/bookings'},
 {name:'Broker',env:'BROKER',loads:'/broker/loads',quotes:'/broker/bids',bookings:'/broker/jobs'},
 {name:'Company / Carrier',env:'CARRIER_ADMIN',loads:'/admin/marketplace',quotes:'/admin/exchange',bookings:'/admin/won-work'},
 {name:'Fleet Manager',env:'FLEET_MANAGER',loads:'/admin/marketplace',quotes:'/admin/exchange',bookings:'/admin/won-work'},
 {name:'Dispatcher',env:'DISPATCHER',loads:'/admin/marketplace',quotes:'/admin/exchange',bookings:'/admin/won-work'},
] as const){
 test(`PR807 ${item.name}: Loads Quotes Bookings destinations remain authenticated`,async({page})=>{
  test.setTimeout(180000);
  const email=process.env[`E2E_${item.env}_EMAIL`];
  const password=process.env[`E2E_${item.env}_PASSWORD`];
  test.skip(!email||!password,'No authorised credentials');
  await loginWithCredentials(page,email!,password!);
  for(const target of [item.loads,item.quotes,item.bookings,item.loads]){
   const response=await page.goto(target,{waitUntil:'domcontentloaded'});
   expect(response?.status()).toBe(200);
   await expect(page).toHaveURL(new RegExp(target.replaceAll('/','\\/')+'(?:[?#]|$)'),{timeout:45000});
   const shell=page.locator('[data-master-workspace="production"]');
   await expect(shell.locator('.top-workspace-shell__header')).toBeVisible({timeout:45000});
   await expect(shell.locator('nav.top-workspace-nav')).toBeVisible();
   await expect(shell.locator('main.top-workspace-shell__content')).toBeVisible();
   await expect(shell).not.toHaveClass(/master3150-production/);
  }
 });
}
