import { expect, test } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test.describe.configure({ mode: 'serial' });

const accountPairs = [
  { label: 'Customer', emailKey: 'E2E_CUSTOMER_EMAIL', passwordKey: 'E2E_CUSTOMER_PASSWORD', route: '/customer/quotes' },
  { label: 'Owner Driver', emailKey: 'E2E_OWNER_DRIVER_EMAIL', passwordKey: 'E2E_OWNER_DRIVER_PASSWORD', route: '/driver/quotes' },
  { label: 'Company Driver', emailKey: 'E2E_COMPANY_DRIVER_EMAIL', passwordKey: 'E2E_COMPANY_DRIVER_PASSWORD', route: '/driver/quotes' },
] as const;

for (const account of accountPairs) {
  test(`read-only authenticated ${account.label}: Quotes and pending booking visibility`, async ({ page }) => {
    test.setTimeout(120_000);
    const email=process.env[account.emailKey] ?? '';
    const password=process.env[account.passwordKey] ?? '';
    test.skip(!email || !password, 'Missing corresponding test credentials');

    // This test only performs login, GET navigation and UI assertions.
    const writeRequests:string[]=[];
    page.on('request',(req)=>{
      const method=req.method().toUpperCase();
      const url=new URL(req.url());
      const isAuth=url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/api/auth/');
      if (['POST','PATCH','PUT','DELETE'].includes(method) && !isAuth && /\/api\/(customer\/bids|booking-offers|driver\/.*\/(bids|jobs)|jobs)/.test(url.pathname)) {
        writeRequests.push(`${method} ${url.pathname}`);
      }
    });

    await loginWithCredentials(page,email.trim(),password.trim());
    const response=await page.goto(account.route,{waitUntil:'domcontentloaded',timeout:60_000});
    expect(response?.status()).toBe(200);
    await page.waitForTimeout(3000);
    expect(new URL(page.url()).pathname.startsWith('/login')).toBe(false);
    await expect(page.locator('body')).toContainText(/quotes|quotation/i,{timeout:20_000});
    const bodyText=await page.locator('body').innerText();
    const result={
      role:account.label,
      route:new URL(page.url()).pathname,
      quoteVisible:/quotes|quotation/i.test(bodyText),
      offerPending:/awaiting (carrier )?acceptance|booking offer pending/i.test(bodyText),
      expiredLabel:/collection time expired|collection time has passed/i.test(bodyText),
      withheldPrivateQuote:/client name not available|not provided|not verified/i.test(bodyText),
      bodyLength:bodyText.length,
      unexpectedWrites:writeRequests,
    };
    console.log('AUTHENTICATED_READONLY_AUDIT',JSON.stringify(result));
    expect(writeRequests).toEqual([]);
  });
}
