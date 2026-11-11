import { test } from '@playwright/test';

test('diagnose browser Supabase network without credentials', async ({ page }) => {
  page.on('requestfailed', request => { if (request.url().includes('supabase.co')) console.log('AUTH_FAILED_HOST', new URL(request.url()).hostname, request.failure()?.errorText); });
  page.on('response', response => { if (response.url().includes('supabase.co') && response.request().method() === 'POST') console.log('AUTH_POST_HOST', new URL(response.url()).hostname, response.status()); });
  await page.goto('/login');
  const results = await page.evaluate(async () => {
    const target = 'https://jqxlauexhkonixtjvljw.supabase.co/auth/v1/health';
    try {
      const response = await fetch(target, { method: 'GET', mode: 'cors', cache: 'no-store' });
      return { reachable: true, status: response.status };
    } catch (error) {
      return { reachable: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  console.log('BROWSER_SUPABASE_CONNECTIVITY', JSON.stringify(results));
  const authProbe = await page.evaluate(async () => {
    try {
      const response = await fetch('https://jqxlauexhkonixtjvljw.supabase.co/auth/v1/token?grant_type=password', { method: 'OPTIONS', mode: 'cors' });
      return { reachable: true, status: response.status };
    } catch (error) {
      return { reachable: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  console.log('BROWSER_AUTH_TOKEN_OPTIONS', JSON.stringify(authProbe));
  await page.locator('input[type="email"]').fill('diagnostic-not-a-real-account@example.invalid');
  await page.locator('input[type="password"]').fill('not-a-real-password');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
});
