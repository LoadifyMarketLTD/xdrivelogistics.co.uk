import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

test('BN17 completed historical load stays searchable when postcode service fails', async ({ page }) => {
  test.setTimeout(90000);
  const email = process.env.E2E_CUSTOMER_EMAIL || '';
  const password = process.env.E2E_CUSTOMER_PASSWORD || '';
  test.skip(!email || !password, 'Missing customer test credentials');
  await loginWithCredentials(page, email, password);
  await page.route('**/api/location/postcode-area?q=BN17', async route => {
    await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error:'Simulated temporary lookup failure'})});
  });
  await page.goto('/customer/loads', {waitUntil: 'domcontentloaded'});
  const board = page.locator('.xd-board');
  await expect(board.getByRole('heading', {name:'Find Loads'})).toBeVisible({timeout:40000});
  const allCards = board.locator('article.xd-board-card');
  await expect(allCards.first()).toBeVisible({timeout:30000});
  await board.getByPlaceholder('e.g. BB1 or Blackburn').fill('bn17');
  await board.getByLabel('Radius').selectOption('10');
  const matched = allCards.filter({hasText:/BN17/i});
  await expect(matched.first()).toBeVisible({timeout:12000});
  await expect(matched.first()).toContainText(/Completed/i);
  await expect(matched.first()).toContainText(/BN1/i);
  await expect(board).not.toContainText('Collection outcode could not be located; geographic results are unavailable');
  await page.screenshot({path:'test-results/customer-bn17-search-exact-visible.png',fullPage:false});
});
