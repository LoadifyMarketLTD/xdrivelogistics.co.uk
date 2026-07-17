import { test, expect } from '@playwright/test';

const BROKER_EMAIL    = process.env.E2E_BROKER_EMAIL    ?? '';
const BROKER_PASSWORD = process.env.E2E_BROKER_PASSWORD ?? '';

test.describe('Broker workspace', () => {
  test.skip(!BROKER_EMAIL, 'Set E2E_BROKER_EMAIL to run broker tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', BROKER_EMAIL);
    await page.fill('input[type="password"]', BROKER_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  });

  test('broker dashboard loads', async ({ page }) => {
    await page.goto('/broker');
    await expect(page.locator('h1')).toContainText(/broker/i);
  });

  test('load board page loads', async ({ page }) => {
    await page.goto('/broker/loads');
    await expect(page.locator('h1')).toContainText(/load board/i);
  });

  test('bids page loads', async ({ page }) => {
    await page.goto('/broker/bids');
    await expect(page.locator('h1')).toContainText(/bids/i);
  });

  test('awards page loads', async ({ page }) => {
    await page.goto('/broker/awards');
    await expect(page.locator('h1')).toContainText(/award/i);
  });

  test('load board nav links are present', async ({ page }) => {
    await page.goto('/broker/loads');
    await expect(page.getByRole('button', { name: 'My Bids' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Awards' })).toBeVisible();
  });

  test('broker loads nav leads to bids page', async ({ page }) => {
    await page.goto('/broker/loads');
    await page.getByRole('button', { name: 'My Bids' }).click();
    await page.waitForURL('**/broker/bids', { timeout: 8_000 });
    await expect(page.locator('h1')).toContainText(/bids/i);
  });
});
