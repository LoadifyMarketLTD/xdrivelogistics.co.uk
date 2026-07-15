import { test, expect } from '@playwright/test';

// ── Public pages ─────────────────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('homepage loads and shows CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/XDrive/i);
    // At least one visible CTA button
    const cta = page.getByRole('link', {
      name: /join early access|request early access|request access|request demo|get started|register|book/i,
    }).first();
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
});

// ── Auth redirect ─────────────────────────────────────────────────────────────

test.describe('Auth redirects', () => {
  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    // Should end up at a login/auth page
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated /driver/jobs redirects to login', async ({ page }) => {
    await page.goto('/driver/jobs');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated /super-admin redirects to login', async ({ page }) => {
    await page.goto('/super-admin');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated /customer redirects to login', async ({ page }) => {
    await page.goto('/customer');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });
});
