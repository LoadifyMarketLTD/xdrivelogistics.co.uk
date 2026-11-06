import { test, expect } from '@playwright/test';

test.use({ screenshot: 'off', video: 'off', trace: 'off' });

test('Owner Driver isolated PWA read-only authenticated feed', async ({ page }) => {
  const email = process.env.E2E_OWNER_DRIVER_EMAIL;
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD;
  test.skip(!email || !password, 'Owner Driver credentials not configured');
  page.on('requestfailed', request => { if (request.url().includes('supabase.co')) console.log('AUTH_REQUEST_FAILED', request.method(), new URL(request.url()).hostname, new URL(request.url()).pathname, request.failure()?.errorText); });
  page.on('response', response => { if (response.url().includes('supabase.co')) console.log('AUTH_RESPONSE', response.request().method(), new URL(response.url()).pathname, response.status()); });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('button[type="submit"]').click();
  await Promise.race([page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 12000 }).catch(() => {}), page.locator('[role="alert"]').first().waitFor({ timeout: 12000 }).catch(() => {})]);
  if (new URL(page.url()).pathname.startsWith('/login')) {
    const messages = await page.locator('[role="alert"], [class*="error"]').allTextContents();
    throw new Error('Owner Driver login did not redirect; visible error messages: ' + messages.filter(Boolean).map(x => x.slice(0, 120)).join(' | '));
  }
  await page.goto('/driver/official-pwa-live');
  await expect(page.locator('iframe')).toBeVisible({ timeout: 20000 });
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('body')).toContainText(/Loads|Bookings|Quotes|Jobs|XDrive/i, { timeout: 25000 });
  const endpoints = ['/api/driver/search-loads?pageSize=5', '/api/driver/official-pwa/bids', '/api/driver/jobs?scope=active', '/api/driver/jobs?scope=completed'];
  const token = await page.evaluate(() => {
    const entry = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith('xdrive-route-access-token='));
    return entry ? decodeURIComponent(entry.split('=').slice(1).join('=')) : null;
  });
  expect(token).toBeTruthy();
  for (const endpoint of endpoints) {
    const response = await page.request.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`READ_ONLY_ENDPOINT ${endpoint} STATUS ${response.status()}`);
    expect(response.status()).toBe(200);
  }
});
