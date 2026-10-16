import { test, expect } from '@playwright/test';

const BROKER_EMAIL    = process.env.E2E_BROKER_EMAIL    ?? '';
const BROKER_PASSWORD = process.env.E2E_BROKER_PASSWORD ?? '';
const CARRIER_EMAIL   = process.env.E2E_CARRIER_EMAIL   ?? process.env.E2E_ADMIN_EMAIL ?? '';
const CARRIER_PASSWORD = process.env.E2E_CARRIER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Broker workspace', () => {
  test.skip(!BROKER_EMAIL, 'Set E2E_BROKER_EMAIL to run broker tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', BROKER_EMAIL);
    await page.fill('input[type="password"]', BROKER_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  });

  test('broker dashboard loads canonical workspace', async ({ page }) => {
    await page.goto('/broker');
    await expect(page.getByRole('navigation', { name: 'Broker Workspace navigation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reports & Statistics' })).toBeVisible();
  });

  test('loads page loads', async ({ page }) => {
    await page.goto('/broker/loads');
    await expect(page.getByRole('heading', { name: 'Loads', exact: true })).toBeVisible();
  });

  test('carrier quotes page loads', async ({ page }) => {
    await page.goto('/broker/bids');
    await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible();
  });

  test('legacy awards route redirects to jobs', async ({ page }) => {
    await page.goto('/broker/awards');
    await page.waitForURL('**/broker/jobs', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
  });

  test('canonical broker navigation exposes Carrier Quotes and Jobs', async ({ page }) => {
    await page.goto('/broker/loads');
    await expect(page.getByRole('button', { name: 'Carrier Quotes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jobs', exact: true })).toBeVisible();
  });

  test('Carrier Quotes navigation leads to quotes page', async ({ page }) => {
    await page.goto('/broker/loads');
    await page.getByRole('button', { name: 'Carrier Quotes', exact: true }).click();
    await page.waitForURL('**/broker/bids', { timeout: 8_000 });
    await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible();
  });

  test('carrier network page loads current relationship controls', async ({ page }) => {
    await page.goto('/broker/carrier-network');
    await expect(page.getByRole('heading', { name: 'Carriers', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('carrier@company.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /send invitation/i })).toBeVisible();
  });

  test('carrier network exposes pending, accepted and revoked status filters', async ({ page }) => {
    await page.goto('/broker/carrier-network');
    const status = page.locator('select').filter({ has: page.locator('option[value="pending"]') });
    await expect(status).toBeVisible();
    await expect(status.locator('option[value="pending"]')).toHaveCount(1);
    await expect(status.locator('option[value="accepted"]')).toHaveCount(1);
    await expect(status.locator('option[value="revoked"]')).toHaveCount(1);
  });

  test('carrier network rejects blank email', async ({ page }) => {
    await page.goto('/broker/carrier-network');
    await page.getByRole('button', { name: /send invitation/i }).click();
    await expect(page.getByText(/carrier email is required/i)).toBeVisible();
  });

  test('carrier network remains reachable from broker dashboard', async ({ page }) => {
    await page.goto('/broker');
    await expect(page.getByRole('button', { name: 'Carrier Network', exact: true })).toBeVisible();
  });
});

test.describe('Carrier broker invitations', () => {
  test.skip(!CARRIER_EMAIL, 'Set E2E_CARRIER_EMAIL or E2E_ADMIN_EMAIL to run carrier invitation tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', CARRIER_EMAIL);
    await page.fill('input[type="password"]', CARRIER_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  });

  test('carrier broker invitations page loads', async ({ page }) => {
    await page.goto('/admin/broker-invitations');
    await expect(page.locator('body')).toContainText(/broker invitation/i);
  });

  test('carrier broker invitations page shows relationship statuses', async ({ page }) => {
    await page.goto('/admin/broker-invitations');
    await expect(page.locator('body')).toContainText(/pending/i);
    await expect(page.locator('body')).toContainText(/accepted|rejected|revoked/i);
  });

  test('carrier broker invitations remains reachable in the authenticated company workspace', async ({ page }) => {
    await page.goto('/admin/broker-invitations');
    await expect(page.getByRole('navigation', { name: 'Company Admin navigation' })).toBeVisible();
  });
});
