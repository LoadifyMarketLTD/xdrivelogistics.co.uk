const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const base='http://localhost:5298';
const routes=['try-xdrive-demo','try-xdrive-broker-demo','try-xdrive-company-demo','try-xdrive-fleet-demo','try-xdrive-dispatcher-demo','try-xdrive-owner-driver-demo','try-xdrive-company-driver-demo','try-xdrive-driver-demo','try-xdrive-employee-driver-demo'];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const reports=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:844}});
  for(const route of routes){
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message).slice(0,220)));
   let status=0,card=0,overflow=false,nav=0;
   try{
    const response=await page.goto(base+'/'+route,{waitUntil:'domcontentloaded',timeout:45000});
    status=response?.status()||0;
    await page.waitForTimeout(1800);
    const data=await page.evaluate(()=>({cards:document.querySelectorAll('[data-presentation="xdrive807"]').length,overflow:document.documentElement.scrollWidth>window.innerWidth+4,buttons:document.querySelectorAll('button').length,bodyText:(document.body?.innerText||'').trim().length}));
    card=data.cards;overflow=data.overflow;nav=data.buttons;
    if(data.bodyText<30)errors.push('Workspace not visibly rendered despite HTTP 200');
   }catch(e){errors.push('Navigation: '+String(e.message).slice(0,160));}
   reports.push({route,width,status,card,overflow,nav,errors});
   console.log(JSON.stringify(reports[reports.length-1]));
   await page.close();
  }
  await context.close();
 }
 await browser.close();
 const out=path.resolve(__dirname,'..','_audit','pr807-seven-role-smoke.json');
 fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(reports,null,2));
 console.log('Report:',out);
 process.exit(reports.some(r=>r.status!==200||r.errors.length>0||r.overflow)?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
