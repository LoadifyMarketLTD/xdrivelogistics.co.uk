import {test,expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';
const samples=[
 {role:'Customer',prefix:'E2E_CUSTOMER',routes:['/customer/post-load','/customer/loads','/customer/quotes','/customer/bookings','/customer/diary']},
 {role:'Broker',prefix:'E2E_BROKER',routes:['/broker/post-load','/broker/loads','/broker/bids','/broker/jobs','/broker/diary']},
 {role:'Company',prefix:'E2E_CARRIER_ADMIN',routes:['/admin/post-load','/admin/marketplace','/admin/exchange','/admin/won-work','/admin/diary']}
] as const;
for(const item of samples)test(item.role+' compare approved 3150 sections on laptop against live routes',async({page})=>{
 test.setTimeout(240000);
 const email=process.env[item.prefix+'_EMAIL']||'',password=process.env[item.prefix+'_PASSWORD']||'';
 test.skip(!email||!password,'No test credentials');
 await page.setViewportSize({width:1365,height:840});
 await loginWithCredentials(page,email,password);
 const results=[];
 for(const route of item.routes) {
  const response=await page.goto(route,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(1300);
  const info=await page.evaluate(()=>{
   const root=document.querySelector('[data-master-workspace="production"]');
   const panel=root?.querySelector('.page') as HTMLElement|null;
   const headings=Array.from(panel?.querySelectorAll('h1,h2,h3')??[]).slice(0,8).map(el=>el.textContent?.trim());
   const titles=Array.from(panel?.querySelectorAll('button[role="tab"],[role="tab"]')??[]).slice(0,12).map(el=>el.textContent?.trim());
   return {master:!!root,headings,titles,rawLength:panel?.innerText?.length??0,overflow:document.documentElement.scrollWidth>innerWidth+1,demoTag:!!panel?.querySelector('[data-demo-only]')};
  });
  results.push({route,status:response?.status(),actual:new URL(page.url()).pathname,...info});
 }
 console.log(JSON.stringify({role:item.role,results}));
 for(const entry of results){expect(entry.status).toBe(200);expect(entry.actual).toBe(entry.route);expect(entry.master).toBe(true);expect(entry.overflow).toBe(false);}
});
