import { test, expect } from '@playwright/test';

const CUSTOMER_EMAIL    = process.env.E2E_CUSTOMER_EMAIL    ?? '';
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD ?? '';

test.describe('Customer portal', () => {
  test.skip(!CUSTOMER_EMAIL, 'Set E2E_CUSTOMER_EMAIL to run customer tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  });

  test('customer portal loads', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.locator('h1')).toContainText(/customer portal/i);
  });

  test('quotes tab visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: /quotes/i })).toBeVisible();
  });

  test('jobs tab visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: /jobs/i })).toBeVisible();
  });

  test('book delivery tab visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: /book delivery/i })).toBeVisible();
  });

  test('book delivery tab shows form fields', async ({ page }) => {
    await page.goto('/customer');
    await page.getByRole('button', { name: /book delivery/i }).click();
    await expect(page.locator('input[placeholder*="Pickup"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Delivery"]')).toBeVisible();
  });

  test('invoices tab visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: /invoices/i })).toBeVisible();
  });
});
