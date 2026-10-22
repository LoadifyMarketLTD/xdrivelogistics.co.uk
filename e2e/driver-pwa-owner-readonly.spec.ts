import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('Owner Driver can sign in and inspect each mobile workspace without mutations', async ({ page }) => {
  test.setTimeout(150_000);
  const email = process.env.E2E_OWNER_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Owner Driver test account must be configured.');

  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/api/driver/web/') && response.status() >= 400) {
      void response.json().then((data: { error?: string }) => {
        console.log('MOBILE_API_FAILURE:', response.status(), path, data.error ?? '(no error message)');
      }).catch(() => console.log('MOBILE_API_FAILURE:', response.status(), path));
    }
  });
  await page.goto('/login?next=%2Fm%2Fdriver%2Fjobs', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const form = document.querySelector('form'); return !!form && Object.keys(form).some(key => key.startsWith('__reactFiber')); }, { timeout: 30000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 22_000, waitUntil: 'domcontentloaded' });
  } catch (cause) {
    const diagnostics = await page.evaluate(() => ({ path: location.pathname, button: document.querySelector('button[type=submit]')?.textContent, alerts: Array.from(document.querySelectorAll('[role=alert]')).map(el => el.textContent), supabaseStorageKeys: Object.keys(localStorage).filter(k => k.includes('auth-token')) }));
    throw new Error('Login navigation diagnostics: ' + JSON.stringify(diagnostics), { cause });
  }

  const routes = [
    { path: '/m/driver/jobs', label: 'Jobs', api: '/api/driver/web/nearby-jobs' },
    { path: '/m/driver/quotes', label: 'Quotes', api: '/api/driver/web/bids' },
    { path: '/m/driver/bookings', label: 'Bookings', api: '/api/driver/web/jobs' },
    { path: '/m/driver/more', label: 'More', api: '/api/driver/web/resources' },
    { path: '/m/driver/documents', label: 'More', api: '/api/driver/web/resources' },
  ];
  for (const { path, label, api } of routes) {
    const apiRequest = page.waitForResponse(response =>
      new URL(response.url()).pathname === api, { timeout: 30_000 });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/')));
    const navigation = page.getByRole('navigation', { name: 'Driver navigation' });
    await expect(navigation.getByRole('link', { name: label, exact: true })).toBeVisible({ timeout: 15_000 });
    const response = await apiRequest;
    expect(response.status(), `${path}: ${api} failed with HTTP ${response.status()}`).toBe(200);
  }
});
