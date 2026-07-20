import { test, expect } from '@playwright/test';

// ── Public pages ─────────────────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('homepage loads and shows CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/XDrive/i);
    const cta = page.getByRole('link', { name: /join early access|request demo|get started|register|book/i }).first();
    await expect(cta).toBeVisible();
  });

  test('homepage has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('request-quote page loads', async ({ page }) => {
    await page.goto('/request-quote');
    await expect(page.locator('form, [data-testid="quote-form"]')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('registration exposes the canonical account types', async ({ page }) => {
    await page.goto('/register');
    const accountType = page.locator('#register-role');
    await expect(accountType).toBeVisible();
    await expect(accountType.locator('option')).toHaveText([
      'Customer / Shipper',
      'Transport Broker',
      'Fleet Operator',
      'Owner Operator',
    ]);
  });
});

// ── Auth redirect ─────────────────────────────────────────────────────────────

test.describe('Auth redirects', () => {
  const protectedRoutes = ['/admin', '/driver/jobs', '/super-admin', '/customer'];

  for (const route of protectedRoutes) {
    test(`unauthenticated ${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL((url) => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
      await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
    });
  }

  test('unauthenticated onboarding resume redirects to login instead of a missing route', async ({ page }) => {
    await page.goto('/onboarding/resume');
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });
});
