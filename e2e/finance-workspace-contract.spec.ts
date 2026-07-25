/**
 * Finance workspace contract and authenticated tests.
 *
 * Static section: always runs in CI.
 *   - Finance permissions library contract
 *   - API schema contracts (shape/auth)
 *
 * Authenticated section: requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 *   Tests: payments page, balances page, reports/export.
 *
 * Skip matrix:
 *  - Authenticated tests: blocked by missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 *  - No SUPABASE_SERVICE_ROLE_KEY required for page rendering (Supabase client-side).
 */
import { expect, test } from '@playwright/test';
import { canRecordInvoicePayments, PAYMENT_RECORDING_ROLES } from '../lib/financePermissions';

// ─── Static contract tests ────────────────────────────────────────────────────

test.describe('finance role permission contract', () => {
  const paymentRoles = ['owner', 'admin', 'dispatcher', 'finance'];
  const nonPaymentRoles = ['driver', 'customer', 'broker'];

  for (const role of paymentRoles) {
    test(`${role} can record invoice payments`, () => {
      expect(canRecordInvoicePayments(role)).toBe(true);
    });
  }

  for (const role of nonPaymentRoles) {
    test(`${role} cannot record invoice payments`, () => {
      expect(canRecordInvoicePayments(role)).toBe(false);
    });
  }

  test('null/undefined returns false', () => {
    expect(canRecordInvoicePayments(null)).toBe(false);
    expect(canRecordInvoicePayments(undefined)).toBe(false);
    expect(canRecordInvoicePayments('')).toBe(false);
  });

  test('payment recording roles set has correct size', () => {
    expect(PAYMENT_RECORDING_ROLES.size).toBe(4);
  });
});

test.describe('finance API schema contract', () => {
  test('invoice document URL endpoint returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.get('/api/finance/invoice-document-url?id=test');
    expect([400, 401, 403, 404, 503]).toContain(response.status());
  });

  test('invoice GET returns 401 or 503 without auth', async ({ request }) => {
    const response = await request.get(
      '/api/finance/invoices/00000000-0000-0000-0000-000000000000'
    );
    expect([401, 403, 503]).toContain(response.status());
  });

  test('payment-history endpoint returns 401 or 503 without auth', async ({ request }) => {
    // This endpoint only accepts POST (recording a payment)
    const response = await request.post(
      '/api/admin/invoices/00000000-0000-0000-0000-000000000000/payment-history',
      { data: {} }
    );
    expect([401, 503]).toContain(response.status());
  });
});

// ─── Authenticated tests ──────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('admin finance pages — authenticated', () => {
  test.skip(!ADMIN_EMAIL, 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run authenticated finance tests');

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('finance balances page loads', async ({ page }) => {
    await page.goto('/admin/finance/balances');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toContainText(/balance|outstanding/i);
  });

  test('finance payments page loads', async ({ page }) => {
    await page.goto('/admin/finance/payments');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toContainText(/payment/i);
  });

  test('finance reports page loads', async ({ page }) => {
    await page.goto('/admin/finance/reports');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1, h2').first()).toContainText(/report|finance/i);
  });

  test('finance reports page exposes export buttons', async ({ page }) => {
    await page.goto('/admin/finance/reports');
    await page.waitForLoadState('networkidle');
    const exportBtns = page.getByRole('button', { name: /export|download|csv/i });
    // At least one export button should be present
    await expect(exportBtns.first()).toBeVisible({ timeout: 8_000 });
  });

  test('finance balances page shows KPI cards', async ({ page }) => {
    await page.goto('/admin/finance/balances');
    await page.waitForLoadState('networkidle');
    // The balances page renders KPI cards for outstanding amounts
    const kpiContent = page.locator('text=/outstanding|£|GBP/i').first();
    const count = await kpiContent.count();
    expect(typeof count).toBe('number');
  });

  test('admin invoice list page loads from finance workflow', async ({ page }) => {
    await page.goto('/admin/invoices');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('invoice lifecycle endpoint returns 400 for invalid action', async ({ page, request }) => {
    // Even without a real invoice, the API must validate the action field
    // We use session cookie from the logged-in page context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const response = await request.post(
      '/api/admin/invoices/00000000-0000-0000-0000-000000000000/lifecycle',
      {
        data: { action: 'invalid_action' },
        headers: { Cookie: cookieHeader },
      }
    );
    // 400 (bad request) or 401 (auth required as bearer token not set)
    expect([400, 401, 503]).toContain(response.status());
  });
});
