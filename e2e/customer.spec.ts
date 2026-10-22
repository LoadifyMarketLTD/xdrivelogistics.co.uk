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
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  });

  test('customer workspace loads canonical dashboard', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('navigation', { name: 'Customer Workspace navigation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reports & Statistics' })).toBeVisible();
  });

  test('quotes navigation is visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: 'Quotes', exact: true })).toBeVisible();
  });

  test('bookings navigation is visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: 'Bookings', exact: true })).toBeVisible();
  });

  test('post load action is visible', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('button', { name: 'Post Load', exact: true })).toBeVisible();
  });

  test('post load action opens current transport form', async ({ page }) => {
    await page.goto('/customer');
    await page.getByRole('button', { name: 'Post Load', exact: true }).click();
    await page.waitForURL('**/customer/post-load', { timeout: 8_000 });
    await expect(page.getByRole('heading', { name: 'Post Load', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Collection date' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Delivery date' })).toBeVisible();
  });

  test('invoices route is reachable from dashboard', async ({ page }) => {
    await page.goto('/customer');
    await page.getByRole('button', { name: 'Outstanding Invoices', exact: true }).click();
    await page.waitForURL('**/customer/invoices', { timeout: 8_000 });
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
  });

  test('updates route is reachable from dashboard', async ({ page }) => {
    await page.goto('/customer');
    await page.getByRole('button', { name: /Updates Operational notices/i }).click();
    await page.waitForURL('**/customer/updates', { timeout: 8_000 });
    await expect(page.locator('body')).toContainText(/updates/i);
  });
});
