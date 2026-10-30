const {chromium}=require('@playwright/test');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
 const c=b.contexts()[0];const p=c?.pages().find(x=>x.url().includes('127.0.0.1:3270'));
 if(!p)throw Error('OPPO local preview not open');
 await p.locator('.fresh-booking-open').first().click({timeout:8000});
 await p.waitForTimeout(4000);
 console.log('OPPO_BOOKING_LINK_PATH='+new URL(p.url()).pathname);
 process.exit(0);
})().catch(e=>{console.error('OPPO_BOOKING_LINK_BLOCKED',e.message);process.exit(1);});