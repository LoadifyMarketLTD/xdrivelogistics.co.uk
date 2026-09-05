import { test, expect, type Page, type Route } from '@playwright/test';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? '';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? '';

const commandFixture = {
  environment: 'STAGING',
  refreshedAt: '2026-09-05T08:00:00.000Z',
  attentionIndicators: {
    p0p1Incidents: { count: 2, label: 'P0/P1 incidents', severity: 'warning' },
    jobsAtRisk: { count: 3, label: 'Jobs at risk', severity: 'warning' },
    blockedAccounts: { count: 1, label: 'Blocked accounts', severity: 'caution' },
    financialExposure: { count: 4, label: 'Overdue invoices', severity: 'warning', note: 'Amount intentionally not inferred.' },
    degradedServices: { count: 0, label: 'Degraded services', severity: 'ok' },
  },
  actionQueue: {
    derived: true,
    queueNote: 'Derived from currently available sources.',
    total: 1,
    p0: 0,
    p1: 1,
    p2: 0,
    items: [{
      id: 'job-risk-1',
      type: 'job_at_risk',
      severity: 'P1',
      title: 'Job at risk',
      description: 'No status change for more than two hours.',
      entityType: 'job',
      entityId: 'job-1',
      entityName: 'Blackburn → Manchester',
      detectedAt: '2026-09-05T06:00:00.000Z',
      ageMinutes: 120,
      href: '/super-admin/operations/active-jobs',
    }],
  },
};

const statsFixture = {
  refreshedAt: '2026-09-05T08:00:00.000Z',
  companiesTotal: 12,
  companiesActive: 8,
  companiesSuspended: 1,
  companiesPending: 3,
  driversTotal: 25,
  jobsTotal: 40,
  jobsOpen: 7,
  jobsDelivered: 33,
  invoicesTotal: 18,
  invoicesUnpaid: 5,
  compliancePending: 2,
};

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

async function fulfilJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test.describe('Super Admin Command Centre E2E', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Set E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD (or fallback E2E_ADMIN_*)');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('success: current homepage loads real owner-protected Command Centre and stats', async ({ page }) => {
    const commandResponse = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/command-centre') && res.request().method() === 'GET',
    );
    const statsResponse = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/stats') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin');
    await expect(page.getByRole('heading', { name: 'Command Centre' })).toBeVisible();

    const [command, stats] = await Promise.all([commandResponse, statsResponse]);
    expect(command.ok()).toBeTruthy();
    expect(stats.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Platform summary' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Critical attention' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operational queue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent administrative activity' })).toBeVisible();
    await expect(page.getByTestId('platform-summary-unavailable')).toHaveCount(0);
    await expect(page.getByTestId('command-centre-unavailable')).toHaveCount(0);
  });

  test('partial data: unavailable sources are explicit and a partial empty queue is never presented as platform-wide zero', async ({ page }) => {
    await page.route('**/api/super-admin/command-centre', (route) => fulfilJson(route, 200, {
      ...commandFixture,
      partialData: true,
      unavailableSources: ['fraud_cases'],
      actionQueue: {
        ...commandFixture.actionQueue,
        total: 0,
        p0: 0,
        p1: 0,
        p2: 0,
        items: [],
      },
    }));
    await page.route('**/api/super-admin/stats', (route) => fulfilJson(route, 200, statsFixture));

    await page.goto('/super-admin');
    await expect(page.getByTestId('partial-data-warning')).toBeVisible();
    await expect(page.getByTestId('operational-queue-total')).toContainText('0 verified · partial');
    await expect(page.getByTestId('operational-queue-partial-empty')).toContainText('Platform-wide zero has not been established');
  });

  test('stats failure: verified Command Centre data remains visible while every KPI fails closed', async ({ page }) => {
    await page.route('**/api/super-admin/command-centre', (route) => fulfilJson(route, 200, commandFixture));
    await page.route('**/api/super-admin/stats', (route) => fulfilJson(route, 503, { error: 'stats unavailable' }));

    await page.goto('/super-admin');
    await expect(page.getByTestId('platform-summary-unavailable')).toBeVisible();
    await expect(page.getByTestId('kpi-unavailable')).toHaveCount(4);
    await expect(page.getByTestId('operational-queue-total')).toHaveText('1 total');
    await expect(page.getByText('Job at risk', { exact: true })).toBeVisible();
  });

  test('command failure: KPI data remains usable while attention and queue fail closed', async ({ page }) => {
    await page.route('**/api/super-admin/command-centre', (route) => fulfilJson(route, 503, { error: 'command unavailable' }));
    await page.route('**/api/super-admin/stats', (route) => fulfilJson(route, 200, statsFixture));

    await page.goto('/super-admin');
    await expect(page.getByTestId('command-centre-unavailable')).toBeVisible();
    await expect(page.getByTestId('attention-unavailable')).toHaveCount(5);
    await expect(page.getByTestId('operational-queue-total')).toHaveText('Unavailable');
    await expect(page.getByTestId('operational-queue-unavailable')).toContainText('No zero or healthy state has been inferred');
    await expect(page.locator('a[href="/super-admin/companies/active"]')).toContainText('8');
  });

  test('401/403 responses fail closed instead of producing zero or healthy states', async ({ page }) => {
    await page.route('**/api/super-admin/command-centre', (route) => fulfilJson(route, 401, { error: 'Unauthorized.' }));
    await page.route('**/api/super-admin/stats', (route) => fulfilJson(route, 403, { error: 'Forbidden: owner role required.' }));

    await page.goto('/super-admin');
    await expect(page.getByTestId('command-centre-unavailable')).toContainText('401');
    await expect(page.getByTestId('platform-summary-unavailable')).toContainText('403');
    await expect(page.getByTestId('kpi-unavailable')).toHaveCount(4);
    await expect(page.getByTestId('attention-unavailable')).toHaveCount(5);
    await expect(page.getByTestId('operational-queue-total')).toHaveText('Unavailable');
  });

  test('server endpoints reject missing bearer authorization', async ({ page }) => {
    const stats = await page.request.get('/api/super-admin/stats');
    expect(stats.status()).toBe(401);

    const command = await page.request.get('/api/super-admin/command-centre');
    expect(command.status()).toBe(403);
  });

  test('navigation: all homepage control links resolve to the canonical Super Admin routes', async ({ page }) => {
    const routes = [
      ['/super-admin/companies/active', '/super-admin/companies/active'],
      ['/super-admin/operations/jobs', '/super-admin/operations/jobs'],
      ['/super-admin/companies/approvals', '/super-admin/companies/approvals'],
      ['/super-admin/finance/invoices', '/super-admin/finance/invoices'],
      ['/super-admin/analytics', '/super-admin/analytics'],
      ['/super-admin/settings/audit-logs', '/super-admin/settings/audit-logs'],
    ] as const;

    for (const [href, expected] of routes) {
      await page.goto('/super-admin');
      await page.locator(`a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${expected.replace(/\//g, '\\/')}$`));
    }
  });

  test('notifications view loads canonical notification_events data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/notifications') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/notifications');
    await expect(page.locator('h1')).toContainText(/system notifications/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
  });

  test('payment ledger loads canonical invoice_payment_history data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/finance?section=payments') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/finance/payments');
    await expect(page.locator('h1')).toContainText(/payment ledger/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
  });
});
