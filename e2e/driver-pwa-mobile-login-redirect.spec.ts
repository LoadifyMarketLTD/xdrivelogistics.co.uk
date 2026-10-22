import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('Owner Driver normal phone sign-in opens PWA rather than desktop', async ({ page }) => {
  test.setTimeout(150_000);
  const email = process.env.E2E_OWNER_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Owner Driver credentials unavailable');
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return !!form && Object.keys(form).some(key => key.startsWith('__reactFiber'));
  }, { timeout: 30_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/m\/driver\/jobs(?:[/?#]|$)/, { timeout: 75_000 });
  await expect(page.getByRole('navigation', { name: 'Driver navigation' })).toBeVisible();
});

test('Company Driver normal phone sign-in opens PWA rather than desktop', async ({ page }) => {
  test.setTimeout(150_000);
  const email = process.env.E2E_COMPANY_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_COMPANY_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Company Driver credentials unavailable');
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return !!form && Object.keys(form).some(key => key.startsWith('__reactFiber'));
  }, { timeout: 30_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/m\/driver\/jobs(?:[/?#]|$)/, { timeout: 75_000 });
  await expect(page.getByRole('navigation', { name: 'Driver navigation' })).toBeVisible();
});
