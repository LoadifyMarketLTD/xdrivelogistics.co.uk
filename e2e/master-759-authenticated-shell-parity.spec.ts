import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';
const cases=[
 {name:'Customer',prefix:'E2E_CUSTOMER',path:'/customer'},
 {name:'Broker',prefix:'E2E_BROKER',path:'/broker'},
 {name:'Company / Carrier',prefix:'E2E_CARRIER_ADMIN',path:'/admin'},
 {name:'Fleet Manager',prefix:'E2E_FLEET_MANAGER',path:'/admin'},
 {name:'Dispatcher',prefix:'E2E_DISPATCHER',path:'/admin'},
 {name:'Owner Driver',prefix:'E2E_OWNER_DRIVER',path:'/driver'},
 {name:'Company Driver',prefix:'E2E_COMPANY_DRIVER',path:'/driver'}
] as const;
const expected=['Dashboard','Post Load','Loads','Quotes','Bookings','My Fleet','Drivers','Diary','Invoices','Network & Tools','Directory','Live Availability','Return Journeys','Freight Vision','Messages','Notifications','Reports'];
for(const item of cases)test(item.name+' authenticated production Master shell desktop parity',async({page})=>{
 test.setTimeout(110000);
 const email=process.env[item.prefix+'_EMAIL']||'',pwd=process.env[item.prefix+'_PASSWORD']||'';
 test.skip(!email||!pwd,'No account credentials available');
 await page.setViewportSize({width:1365,height:840});
 await loginWithCredentials(page,email,pwd);
 const response=await page.goto(item.path,{waitUntil:'domcontentloaded',timeout:45000});
 await expect(page.locator('[data-master-workspace="production"]')).toBeVisible({timeout:20000});
 const metrics=await page.evaluate(()=>{
  const shell=document.querySelector('[data-master-workspace="production"]');
  const aside=shell?.querySelector('aside');
  const nav=Array.from(aside?.querySelectorAll('button')??[]).map(el=>el.textContent?.trim()??'').filter(v=>v!==''&&v!=='Close');
  return {width:aside?.getBoundingClientRect().width,bodyWidth:document.documentElement.scrollWidth,nav};
 });
 console.log(JSON.stringify({role:item.name,status:response?.status(),path:page.url(),width:metrics.width,count:metrics.nav.length,bodyWidth:metrics.bodyWidth}));
 expect(response?.status()).toBe(200);
 expect(metrics.width).toBe(224);
 expect(metrics.bodyWidth).toBe(1365);
 for(const label of expected)expect(metrics.nav).toContain(label);
});
