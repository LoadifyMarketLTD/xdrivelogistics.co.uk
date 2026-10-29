const {chromium}=require('@playwright/test');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
 const c=b.contexts()[0];const p=c?.pages().find(x=>x.url().includes('127.0.0.1:3270'));
 if(!p)throw Error('OPPO local preview not open');
 await p.goto('http://127.0.0.1:3270/driver-pwa-fresh/bookings',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(3000);
 console.log('OPPO_ROUTE='+new URL(p.url()).pathname);
})().catch(e=>{console.error('OPPO_VISUAL_CHECK_BLOCKED',e.message);process.exitCode=1});