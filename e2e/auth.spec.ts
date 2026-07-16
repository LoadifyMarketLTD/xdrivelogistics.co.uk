import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const DRIVER_EMAIL   = process.env.E2E_DRIVER_EMAIL   ?? '';
const DRIVER_PASSWORD= process.env.E2E_DRIVER_PASSWORD?? '';

// Helper: log in via the login modal / page
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test.describe('Admin portal', () => {
  test.skip(!ADMIN_EMAIL, 'Set E2E_ADMIN_EMAIL to run admin tests');

  test('admin can log in and see dashboard', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText(/dashboard|control/i);
    await expect(page.getByRole('navigation', { name: /operations workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /load board/i })).toBeVisible();
  });

  test('admin fleet page shows map placeholder', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/fleet');
    await page.waitForSelector('h1', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText(/fleet/i);
  });

  test('admin jobs page loads', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/jobs');
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('admin drivers page loads', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/drivers');
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('admin marketplace page loads', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/marketplace');
    await expect(page.locator('h1, h2')).toBeVisible();
  });
});

test.describe('Driver portal', () => {
  test.skip(!DRIVER_EMAIL, 'Set E2E_DRIVER_EMAIL to run driver tests');

  test('driver can log in and see jobs dashboard', async ({ page }) => {
    await loginAs(page, DRIVER_EMAIL, DRIVER_PASSWORD);
    await page.goto('/driver/jobs');
    await expect(page.locator('h1')).toContainText(/job|driver/i);
    await expect(page.getByRole('navigation', { name: /driver workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /load board/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^fleet$/i })).toHaveCount(0);
  });

  test('driver availability page loads', async ({ page }) => {
    await loginAs(page, DRIVER_EMAIL, DRIVER_PASSWORD);
    await page.goto('/driver/availability');
    await expect(page.locator('h1, h2')).toBeVisible();
  });
});
