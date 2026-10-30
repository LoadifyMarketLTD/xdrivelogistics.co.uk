const {chromium}=require('@playwright/test');
(async()=>{
  const email=process.env.E2E_COMPANY_DRIVER_EMAIL;
  const password=process.env.E2E_COMPANY_DRIVER_PASSWORD;
  if(!email||!password) throw Error('Missing controlled test-driver credentials');
  const browser=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:15000});
  const context=browser.contexts()[0];
  if(!context) throw Error('No OPPO Chrome browser context');
  const pages=context.pages();
  const page=pages.find(p=>p.url().startsWith('http://127.0.0.1:3270'))||pages[0];
  if(!page) throw Error('No OPPO Chrome page; refuse to create another session');
  const base='http://127.0.0.1:3270';
  await page.goto(base+'/driver-pwa-fresh/jobs',{waitUntil:'domcontentloaded',timeout:45000});
  if(page.url().includes('/login')){
    await page.waitForSelector('input[type="email"]',{timeout:25000});
    await page.waitForTimeout(800);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:40000});
  }
  const pagesToReview=[['jobs','/driver-pwa-fresh/jobs'],['quotes','/driver-pwa-fresh/quotes'],['bookings','/driver-pwa-fresh/bookings'],['booking-offers','/driver-pwa-fresh/booking-offers']];
  for(const [name,route] of pagesToReview){
    await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1800);
    const visible=await page.locator('body').innerText().catch(()=> '');
    if(page.url().includes('/login'))throw Error('Unexpected redirect to login at '+name);
    await page.screenshot({path:'automation/logs/oppo-real-pwa-'+name+'-read-only.png'});
    console.log('OPPO_READ_ONLY',name,'URL_OK',page.url().includes(route),'HAS_SERVER_ERROR',/temporarily unavailable|Unable to load|Login service unavailable/i.test(visible),'HAS_EMPTY_STATE',/No available loads|No submitted quotes|No bookings for this period|No awarded jobs/i.test(visible));
  }
  console.log('OPPO_READ_ONLY_COMPLETE');
})().catch(e=>{console.error('OPPO_READ_ONLY_BLOCKED',e.message);process.exitCode=1;});