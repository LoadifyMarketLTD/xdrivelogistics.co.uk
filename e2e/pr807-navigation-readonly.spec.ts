import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';

/** Real sidebar navigation: route and selected tab, without production writes. */
for (const item of [
 {name:'Broker',env:'BROKER',loads:'/broker/loads',quotes:'/broker/bids',bookings:'/broker/jobs'},
 {name:'Fleet Manager',env:'FLEET_MANAGER',loads:'/admin/marketplace',quotes:'/admin/exchange',bookings:'/admin/won-work'},
 {name:'Dispatcher',env:'DISPATCHER',loads:'/admin/marketplace',quotes:'/admin/exchange',bookings:'/admin/won-work'},
] as const) {
 test(`PR807 ${item.name}: Loads to Quotes to Bookings and back`,async({page})=>{
  test.setTimeout(180000);
  const email=process.env[`E2E_${item.env}_EMAIL`];
  const password=process.env[`E2E_${item.env}_PASSWORD`];
  test.skip(!email||!password,'No authorised credentials');
  await loginWithCredentials(page,email!,password!);
  await page.goto(item.loads,{waitUntil:'domcontentloaded'});
  const sidebar=page.getByRole('complementary',{name:'Master workspace sections'});
  await expect(sidebar).toBeVisible({timeout:45000});
  for(const [label,target] of [['Quotes',item.quotes],['Bookings',item.bookings],['Loads',item.loads]] as const){
   const tab=sidebar.getByRole('button',{name:label,exact:true});
   await expect(tab).toBeEnabled();
   await tab.click();
   await expect(page).toHaveURL(new RegExp(target.replaceAll('/','\\/')+'(?:[?#]|$)'),{timeout:45000});
   await expect(tab).toHaveClass(/active/);
   await expect(page.locator('[data-master-workspace="production"]')).toHaveCount(1);
   await expect(page.locator('.master-navigation-loading')).toHaveCount(0,{timeout:45000});
  }
 });
}
