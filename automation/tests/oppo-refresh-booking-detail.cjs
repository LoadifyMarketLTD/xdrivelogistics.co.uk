const {chromium}=require('@playwright/test');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
 const c=b.contexts()[0],p=c?.pages().find(x=>x.url().startsWith('http://127.0.0.1:3270/driver-pwa-fresh/bookings/'));
 if(!p) throw Error('OPPO real booking details page not active');
 await p.reload({waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForTimeout(4500);
 console.log('OPPO_BOOKING_DETAIL_URL='+new URL(p.url()).pathname);
 process.exit(0);
})().catch(e=>{console.error('OPPO_BOOKING_REFRESH_BLOCKED',e.message);process.exit(1);});