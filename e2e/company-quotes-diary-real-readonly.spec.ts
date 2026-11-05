import { expect, test } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test('Carrier Quotes separates received bids and Diary shows external fulfilment read-only', async ({ page }) => {
  test.setTimeout(180_000);
  const email = process.env.E2E_CARRIER_ADMIN_EMAIL ?? '';
  const password = process.env.E2E_CARRIER_ADMIN_PASSWORD ?? '';
  test.skip(!email || !password, 'Carrier Admin test credentials not supplied');

  await loginWithCredentials(page, email.trim(), password.trim());

  const quotes = await page.goto('/admin/exchange', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  expect(quotes?.status()).toBe(200);
  await expect(page.getByRole('tab', { name: 'Submitted Quotes' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Received Bids' })).toBeVisible();
  await page.getByRole('tab', { name: 'Received Bids' }).click();
  await expect(page.getByRole('heading', { name: 'Received Bids' })).toBeVisible();
  await expect(page.locator('.carrier-register-bid-group').first()).toBeVisible({ timeout: 35_000 });
  const groups = await page.locator('.carrier-register-bid-group').count();
  console.log('Verified actual incoming bid groups visible:', groups);
  expect(groups).toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'Submitted Quotes' }).click();
  await expect(page.getByRole('tab', { name: 'Submitted Quotes' })).toHaveAttribute('aria-selected', 'true');

  const diary = await page.goto('/admin/diary', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  expect(diary?.status()).toBe(200);
  const external = page.locator('[data-diary-scope="externally-fulfilled"]');
  await expect(external).toBeVisible();
  const summary = external.locator('summary');
  await expect(summary).toContainText(/Externally Fulfilled Jobs \(\d+\)/, { timeout: 35_000 });
  await summary.click();
  const entries = external.locator('[data-execution-scope="external-carrier"]');
  await expect(entries.first()).toBeVisible({ timeout: 35_000 });
  const count = await entries.count();
  console.log('Verified externally fulfilled company jobs:', count);
  expect(count).toBeGreaterThan(0);
  await expect(external).toContainText('Read-only; not own-fleet bookings.');
  await expect(external.locator('button')).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Diary states' }).getByRole('tab')).toHaveCount(9);
});
