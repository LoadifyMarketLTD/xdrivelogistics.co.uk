import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test('Customer 3150 production map and public postcode radius use real data, read only', async ({ page }) => {
  test.setTimeout(150000);
  const email = process.env.E2E_CUSTOMER_EMAIL || '';
  const password = process.env.E2E_CUSTOMER_PASSWORD || '';
  test.skip(!email || !password, 'Missing customer test credentials');
  await loginWithCredentials(page, email, password);
  const response = await page.goto('/customer/loads', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  const board = page.locator('.xd-board').first();
  await expect(board).toBeVisible({ timeout: 40000 });
  const cards = board.locator('article.xd-board-card');
  await expect(cards.first()).toBeVisible({ timeout: 30000 });
  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(0);

  const centreGeocode = page.waitForResponse(r => r.url().includes('/api/location/postcode-area?q=BL1'), { timeout: 30000 });
  await board.getByPlaceholder('e.g. BB1 or Blackburn').fill('BL1');
  await board.getByLabel('Radius').selectOption('5');
  const geoResponse = await centreGeocode;
  expect(geoResponse.status()).toBe(200);
  await expect(board.getByText('Locating public pickup areas for radius filtering...')).toBeHidden({ timeout: 40000 });
  const narrowedCount = await cards.count();
  expect(narrowedCount).toBeLessThanOrEqual(initialCount);

  await board.getByLabel('Radius').selectOption('100');
  const widenedCount = await cards.count();
  expect(widenedCount).toBeGreaterThanOrEqual(narrowedCount);

  await board.getByRole('button', { name: 'Map view' }).click();
  await expect(board.locator('.xd-map-placeholder')).toHaveCount(0);
  await expect(board.locator('.marketplace-radar-shell, .marketplace-radar-empty').first()).toBeVisible({ timeout: 40000 });
  await expect(board.getByRole('button', { name: 'Quote Now' })).toHaveCount(0);
});
