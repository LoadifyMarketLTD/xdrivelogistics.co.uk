import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('Driver PWA support requires authentication', async ({ page }) => {
  await page.goto('/m/driver/support', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(url => url.pathname === '/login' &&
    url.searchParams.get('next') === '/m/driver/support');
});

test('Owner Driver opens Help from More without leaving the installed PWA scope', async ({ page }) => {
  test.setTimeout(150_000);
  const email = process.env.E2E_OWNER_DRIVER_EMAIL ?? '';
  const password = process.env.E2E_OWNER_DRIVER_PASSWORD ?? '';
  test.skip(!email || !password, 'Owner Driver E2E credentials not available.');

  await page.goto('/login?next=%2Fm%2Fdriver%2Fmore', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const form = document.querySelector('form'); return !!form && Object.keys(form).some(key => key.startsWith('__reactFiber')); });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => url.pathname.startsWith('/m/driver'), { timeout: 30_000 });
  await page.goto('/m/driver/more', { waitUntil: 'domcontentloaded' });
  const help = page.getByRole('link', { name: 'Help & support' });
  await expect(help).toBeVisible({ timeout: 30_000 });
  await help.click();
  await expect(page).toHaveURL(/\/m\/driver\/support$/);
  await expect(page.getByRole('heading', { name: 'Help & support' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', /^mailto:/);
  await expect(page.getByRole('navigation', { name: 'Driver navigation' })
    .getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
});
