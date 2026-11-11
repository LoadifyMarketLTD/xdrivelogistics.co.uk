import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const routes=['/admin/jobs','/admin/quotes','/admin/invoices','/broker/jobs','/broker/quotes','/customer/quotes','/driver/jobs','/super-admin/operations/jobs'];
const results=[];
try {
 const ctx=await browser.newContext({viewport:{width:1365,height:840}});
 for(const route of routes){
  const page=await ctx.newPage();
  const response=await page.goto('http://127.0.0.1:3191'+route,{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>null);
  await page.waitForTimeout(600);
  const title=await page.title();
  const text=(await page.locator('body').innerText().catch(()=>''))||'';
  const sensitive=text.includes('Generate Invoice')||text.includes('Award Quote')||text.includes('Delete Job');
  results.push({route,code:response?.status(),url:page.url(),title,sensitiveUnauthenticated:sensitive});
  if(sensitive) throw Error('Unauthorized content visible on '+route);
  await page.close();
 }
 console.log(JSON.stringify({status:'PASS',checked:results.length,results},null,2));
}finally{await browser.close()}
