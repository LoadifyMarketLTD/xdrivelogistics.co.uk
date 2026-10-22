import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('Owner Driver can sign in and inspect each mobile workspace without mutations', async ({ page }) => {
  test.setTimeout(90_000);
  const email = process.env.E2E_OWNER_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Owner Driver test account must be configured.');

  await page.goto('/login?next=%2Fm%2Fdriver%2Fjobs', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000, waitUntil: 'domcontentloaded' });

  const routes = [
    { path: '/m/driver/jobs', label: 'Jobs' },
    { path: '/m/driver/quotes', label: 'Quotes' },
    { path: '/m/driver/bookings', label: 'Bookings' },
    { path: '/m/driver/more', label: 'More' },
    { path: '/m/driver/documents', label: 'More' },
  ];
  for (const { path, label } of routes) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/')));
    const navigation = page.getByRole('navigation', { name: 'Driver navigation' });
    await expect(navigation.getByRole('link', { name: label, exact: true })).toBeVisible({ timeout: 15_000 });
  }
});
