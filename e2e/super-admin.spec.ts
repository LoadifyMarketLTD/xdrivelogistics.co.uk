import { test, expect, type Page } from '@playwright/test';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? '';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? '';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('Super Admin finance/notifications runtime validation', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Set E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD (or fallback E2E_ADMIN_*)');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('platform navigation exposes owner controls', async ({ page }) => {
    await page.goto('/super-admin');
    await expect(page.getByRole('navigation', { name: /platform control workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^companies$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^platform$/i })).toBeVisible();
  });

  test('notifications view loads canonical notification_events data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/platform?section=notifications') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/notifications');
    await expect(page.locator('h1')).toContainText(/system notifications/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { section?: string; rows?: unknown[]; summary?: Record<string, unknown> };
    expect(body.section).toBe('notifications');
    expect(Array.isArray(body.rows)).toBeTruthy();
    expect(body.summary).toBeTruthy();
  });

  test('payment ledger loads canonical invoice_payment_history data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/finance?section=payments') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/finance/payments');
    await expect(page.locator('h1')).toContainText(/payment ledger/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { section?: string; rows?: unknown[]; summary?: Record<string, unknown> };
    expect(body.section).toBe('payments');
    expect(Array.isArray(body.rows)).toBeTruthy();
    expect(body.summary).toBeTruthy();
  });
});
