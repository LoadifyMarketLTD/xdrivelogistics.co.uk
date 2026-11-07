import {test, expect} from '@playwright/test';
import {loginWithCredentials} from './helpers/authLogin';
const cases=[
 {role:'Owner Driver',prefix:'E2E_OWNER_DRIVER',paths:['/driver','/driver/loads','/driver/quotes','/driver/jobs','/driver/directory','/driver/fleet','/driver/drivers','/driver/finance']},
 {role:'Company Driver',prefix:'E2E_COMPANY_DRIVER',paths:['/driver-pwa-fresh/jobs','/driver-pwa-fresh/quotes','/driver-pwa-fresh/bookings','/driver-pwa-fresh/messages']},
] as const;
for(const item of cases) test(item.role+' current Master authenticated read-only routes',async ({page})=>{
 test.setTimeout(240000);
 const email=process.env[item.prefix+'_EMAIL']||'';
 const password=process.env[item.prefix+'_PASSWORD']||'';
 test.skip(!email||!password,'Credentials not available');
 await page.setViewportSize({width:390,height:844});
 await loginWithCredentials(page,email,password);
 const failures:string[]=[];
 for(const path of item.paths){
  const res=await page.goto(path,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(1600);
  const current=new URL(page.url()).pathname;
  const body=await page.locator('body').innerText();
  const status=res?.status()??0;
  const nav=await page.getByRole('button',{name:'Open workspace menu'}).count();
  const viewport=await page.evaluate(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth}));
  console.log(JSON.stringify({role:item.role,path,status,current,nav,viewport}));
  if(status!==200||current!==path)failures.push(path+': HTTP '+status+' at '+current);
  if(/login service unavailable|sign-in is temporarily unavailable/i.test(body))failures.push(path+': auth service error');
  if(viewport.docWidth>viewport.width+2)failures.push(path+': horizontal overflow '+viewport.docWidth);
 }
 expect(failures).toEqual([]);
});
