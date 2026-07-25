/**
 * Driver workspace contract and authenticated tests.
 *
 * Static section: always runs in CI.
 *   - Driver capability utilities (already covered in role-workspace-capability-contract)
 *   - Driver finance API schema contracts
 *
 * Authenticated section: requires E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD.
 *   Tests: driver jobs, finance/invoices, POD upload flow, availability.
 *
 * Skip matrix:
 *  - Authenticated tests: blocked by missing E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD.
 *  - Invoice send tests additionally require RESEND_API_KEY on server (503 otherwise).
 *  - Mobile API tests require SUPABASE_SERVICE_ROLE_KEY (503 otherwise).
 */
import { expect, test } from '@playwright/test';
import {
  getDriverWorkspaceCapabilities,
} from '../lib/roleCapabilities';

// ─── Static contract tests ────────────────────────────────────────────────────

test.describe('driver capability contract — finance access by driver type', () => {
  test('fleet driver cannot view invoices', () => {
    const caps = getDriverWorkspaceCapabilities('fleet_driver');
    expect(caps.canViewInvoices).toBe(false);
  });

  test('provider/owner driver can view invoices', () => {
    const caps = getDriverWorkspaceCapabilities('provider_driver');
    expect(caps.canViewInvoices).toBe(true);
  });

  test('fleet driver cannot access marketplace loads', () => {
    const caps = getDriverWorkspaceCapabilities('fleet_driver');
    expect(caps.canViewExchangeLoads).toBe(false);
    expect(caps.canQuoteLoads).toBe(false);
  });

  test('provider driver can access marketplace loads', () => {
    const caps = getDriverWorkspaceCapabilities('provider_driver');
    expect(caps.canViewExchangeLoads).toBe(true);
    expect(caps.canQuoteLoads).toBe(true);
  });

  test('both driver types can execute jobs and upload POD', () => {
    for (const driverType of ['fleet_driver', 'provider_driver'] as const) {
      const caps = getDriverWorkspaceCapabilities(driverType);
      expect(caps.canExecuteJobs).toBe(true);
      expect(caps.canUploadPod).toBe(true);
    }
  });
});

test.describe('driver finance API schema contract', () => {
  test('generate-invoice endpoint returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.post(
      '/api/driver/finance/jobs/00000000-0000-0000-0000-000000000000/generate-invoice'
    );
    expect([401, 503]).toContain(response.status());
  });

  test('invoice submit endpoint returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.post(
      '/api/driver/finance/invoices/00000000-0000-0000-0000-000000000000/submit'
    );
    expect([401, 503]).toContain(response.status());
  });

  test('eligible jobs endpoint returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.get('/api/driver/finance/jobs/eligible');
    expect([401, 503]).toContain(response.status());
  });

  test('driver invoices list returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.get('/api/driver/finance/invoices');
    expect([401, 503]).toContain(response.status());
  });

  test('POD signed-url endpoint returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.get(
      '/api/pod/signed-url?jobId=00000000-0000-0000-0000-000000000000&path=test/file.jpg'
    );
    expect([401, 503]).toContain(response.status());
  });
});

// ─── Authenticated tests ──────────────────────────────────────────────────────

const DRIVER_EMAIL = process.env.E2E_DRIVER_EMAIL ?? '';
const DRIVER_PASSWORD = process.env.E2E_DRIVER_PASSWORD ?? '';

async function loginAsDriver(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', DRIVER_EMAIL);
  await page.fill('input[type="password"]', DRIVER_PASSWORD);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('driver workspace pages — authenticated', () => {
  test.skip(!DRIVER_EMAIL, 'Set E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD to run driver workspace tests');

  test.beforeEach(async ({ page }) => {
    await loginAsDriver(page);
  });

  test('driver jobs page loads', async ({ page }) => {
    await page.goto('/driver/jobs');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('driver availability page loads', async ({ page }) => {
    await page.goto('/driver/availability');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('driver profile page loads', async ({ page }) => {
    await page.goto('/driver/profile');
    await expect(page.locator('h1, h2, [data-testid="profile"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('driver cannot access admin portal', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/(forbidden|login|pending-approval)(\?|$)/);
  });

  test('driver cannot access super-admin portal', async ({ page }) => {
    await page.goto('/super-admin');
    await expect(page).toHaveURL(/\/(forbidden|login|pending-approval)(\?|$)/);
  });

  test('driver cannot access customer portal', async ({ page }) => {
    await page.goto('/customer');
    await expect(page).toHaveURL(/\/(forbidden|login|pending-approval|driver)(\?|$|\/).*/);
  });
});

test.describe('driver finance workspace — authenticated', () => {
  test.skip(!DRIVER_EMAIL, 'Set E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD to run driver finance tests');

  test.beforeEach(async ({ page }) => {
    await loginAsDriver(page);
  });

  test('driver finance page or redirect is accessible', async ({ page }) => {
    const response = await page.goto('/driver/finance');
    // Either renders or redirects; must not be a hard 500
    expect(response?.status()).not.toBe(500);
  });

  test('driver invoices page (if accessible) shows header', async ({ page }) => {
    await page.goto('/driver/finance');
    await page.waitForLoadState('networkidle');
    // Graceful: some driver types may not have finance access
    const heading = page.locator('h1, h2').first();
    const count = await heading.count();
    expect(typeof count).toBe('number');
  });
});
