import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

for (const item of [
  { role: 'Customer', env: 'E2E_CUSTOMER', root: '/customer', loads: '/customer/loads', quotes: '/customer/quotes' },
  { role: 'Broker', env: 'E2E_BROKER', root: '/broker', loads: '/broker/loads', quotes: '/broker/bids' },
  { role: 'Company / Carrier', env: 'E2E_CARRIER_ADMIN', root: '/admin', loads: '/admin/marketplace', quotes: '/admin/exchange' },
]) {
  test(item.role + ' web Master navigation at phone width', async ({page}) => {
    test.setTimeout(130000);
    const email=process.env[item.env+'_EMAIL']||'';
    const password=process.env[item.env+'_PASSWORD']||'';
    test.skip(!email || !password,'Account credentials are not available');
    await page.setViewportSize({width:390,height:844});
    await loginWithCredentials(page,email.trim(),password.trim());
    const response=await page.goto(item.loads,{waitUntil:'domcontentloaded',timeout:60000});
    expect(response?.status(),item.loads).toBe(200);
    await expect(page).toHaveURL(new RegExp(item.loads.replaceAll('/','\\/')+'(?:\\?|$)'));
    const toggle=page.getByRole('button',{name:'Open workspace menu'});
    await expect(toggle,'Mobile menu toggle must be available on every web workspace page').toBeVisible({timeout:20000});
    expect(await toggle.getAttribute('aria-expanded')).toBe('false');
    const viewport=await page.evaluate(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth}));
    console.log(JSON.stringify({role:item.role,section:'loads',...viewport}));
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded','true');
    const menu=page.getByRole('complementary',{name:'Master workspace sections'});
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button',{name:'Dashboard'})).toBeVisible();
    await expect(menu.getByRole('button',{name:'Quotes'})).toBeVisible();
    await menu.getByRole('button',{name:'Quotes'}).click();
    await expect(page).toHaveURL(new RegExp(item.quotes.replaceAll('/','\\/')+'(?:\\?|$)'),{timeout:20000});
    await expect(page.getByRole('button',{name:'Open workspace menu'})).toHaveAttribute('aria-expanded','false');
    await page.getByRole('button',{name:'Open workspace menu'}).click();
    await expect(page.getByRole('button',{name:'Close workspace navigation'})).toBeVisible();
    await page.getByRole('button',{name:'Close workspace navigation'}).click({position:{x:380,y:420}});
    await expect(page.getByRole('button',{name:'Open workspace menu'})).toHaveAttribute('aria-expanded','false');
    const final=await page.evaluate(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth}));
    console.log(JSON.stringify({role:item.role,section:'quotes',...final}));
    await page.screenshot({path:'test-results/mobile-web-'+item.env.toLowerCase()+'.png',fullPage:true});
  });
}
