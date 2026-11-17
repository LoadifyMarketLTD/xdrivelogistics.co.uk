import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test('diagnose real Owner Driver Directory to Live Availability link', async ({ page }) => {
  test.setTimeout(100_000);
  const email = process.env.E2E_OWNER_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Owner Driver login required');
  const blocked: string[] = [], failures: string[] = [], apiErrors: string[] = [], jsErrors: string[] = [];
  page.on('pageerror', error => jsErrors.push(error.message.slice(0,180)));
  page.on('requestfailed', req => failures.push(req.method()+' '+new URL(req.url()).pathname+' '+req.failure()?.errorText));
  page.on('response', res => { if(res.status()>=400 && /\/api\/|\/rest\/v1\//.test(res.url())) apiErrors.push(res.status()+' '+new URL(res.url()).pathname); });
  // Instrument API and database calls without delaying Next.js page navigation requests.
  await page.route(/\/api\/|\.supabase\.co\/(rest|storage|functions)\/v1\//, async route => {
    const req = route.request(), url = new URL(req.url());
    if(['GET','HEAD','OPTIONS'].includes(req.method())) return route.continue();
    if(url.hostname.endsWith('.supabase.co') && (url.pathname.startsWith('/auth/v1/') || url.pathname === '/rest/v1/rpc/active_company_membership_role')) return route.continue();
    blocked.push(req.method()+' '+url.pathname);
    return route.fulfill({status:403,contentType:'application/json',body:'{"error":"READ_ONLY_DIAGNOSTIC"}'});
  });
  await loginWithCredentials(page,email,password);
  await page.goto('/driver/directory',{waitUntil:'load',timeout:35000});
  await expect(page).toHaveURL(/\/driver\/directory$/);
  await page.waitForTimeout(1400);
  const nav=page.locator('nav.top-workspace-nav--primary');
  const link=nav.locator('a[href="/driver/availability/live"]');
  await expect(link).toBeVisible({timeout:12000});
  await link.click();
  await page.waitForTimeout(10000);
  await expect(page.getByRole('button',{name:/Start live availability|Stop live availability/i}).first()).toBeVisible({timeout:15000});
  const result={url:page.url(),blocked,failures:failures.slice(-18),apiErrors:apiErrors.slice(-20),jsErrors,linkHref:await link.getAttribute('href'),liveControlsVisible:true};
  console.log('LIVE_AVAILABILITY_NAV_DIAGNOSTIC='+JSON.stringify(result));
  expect(new URL(page.url()).pathname).toBe('/driver/availability/live');
});
