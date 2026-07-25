import { test, expect } from '@playwright/test';

const BROKER_EMAIL    = process.env.E2E_BROKER_EMAIL    ?? '';
const BROKER_PASSWORD = process.env.E2E_BROKER_PASSWORD ?? '';
const CARRIER_EMAIL   = process.env.E2E_CARRIER_EMAIL   ?? '';
const CARRIER_PASSWORD = process.env.E2E_CARRIER_PASSWORD ?? '';

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

  test('carrier network page loads with invite form', async ({ page }) => {
    await page.goto('/broker/carrier-network');
    await expect(page.locator('h1')).toContainText(/carrier invitation/i);
    await expect(page.getByText('Invite carrier')).toBeVisible();
    await expect(page.getByPlaceholder('carrier@company.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /send invitation/i })).toBeVisible();
  });

  test('carrier network shows KPI cards for pending, accepted, revoked', async ({ page }) => {
    await page.goto('/broker/carrier-network');
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('Accepted')).toBeVisible();
    await expect(page.getByText('Revoked')).toBeVisible();
  });

  test('carrier network rejects blank email', async ({ page }) => {
    await page.goto('/broker/carrier-network');
    await page.getByRole('button', { name: /send invitation/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test('carrier network nav item is present in sidebar', async ({ page }) => {
    await page.goto('/broker');
    await expect(page.getByRole('link', { name: /carrier network/i })).toBeVisible();
  });
});

test.describe('Carrier broker invitations', () => {
  test.skip(!CARRIER_EMAIL, 'Set E2E_CARRIER_EMAIL to run carrier invitation tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', CARRIER_EMAIL);
    await page.fill('input[type="password"]', CARRIER_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  });

  test('carrier broker invitations page loads', async ({ page }) => {
    await page.goto('/admin/broker-invitations');
    await expect(page.locator('h1')).toContainText(/broker invitation/i);
  });

  test('carrier broker invitations page shows KPI cards', async ({ page }) => {
    await page.goto('/admin/broker-invitations');
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('Accepted')).toBeVisible();
    await expect(page.getByText('Rejected')).toBeVisible();
  });

  test('carrier broker invitations nav item is visible', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: /broker invitation/i })).toBeVisible();
  });
});

