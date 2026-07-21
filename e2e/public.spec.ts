import { test, expect } from '@playwright/test';

// ── Public pages ─────────────────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('homepage loads and shows CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/XDrive/i);
    // At least one visible CTA button
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

  test('registration exposes only the four public account types', async ({ page }) => {
    await page.goto('/register');
    const accountType = page.locator('#register-role');
    await expect(accountType).toBeVisible();
    await expect(accountType.locator('option')).toHaveCount(4);
    await expect(accountType).toContainText('Customer / Shipper');
    await expect(accountType).toContainText('Transport Broker');
    await expect(accountType).toContainText('Fleet Operator');
    await expect(accountType).toContainText('Owner Operator');
    await expect(accountType).not.toContainText('Fleet Driver');
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

  test('unauthenticated onboarding resume redirects to login with return path', async ({ page }) => {
    await page.goto('/onboarding/resume');
    await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('next') === '/onboarding/resume', { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });
});
