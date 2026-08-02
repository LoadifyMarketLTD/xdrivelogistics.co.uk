import { test, expect, type Page } from '@playwright/test';

type RoleSpec = {
  role: 'admin' | 'broker' | 'customer' | 'driver' | 'operations';
  route: string;
  actionCentreRoute: string;
  notificationsRoute: string;
  credentials: { email: string; password: string };
};

const adminCreds = {
  email: process.env.E2E_ADMIN_EMAIL ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? '',
};

const roleSpecs: RoleSpec[] = [
  {
    role: 'admin',
    route: '/admin',
    actionCentreRoute: '/admin/action-centre',
    notificationsRoute: '/admin/notifications',
    credentials: adminCreds,
  },
  {
    role: 'broker',
    route: '/broker',
    actionCentreRoute: '/broker/action-centre',
    notificationsRoute: '/broker/notifications',
    credentials: {
      email: process.env.E2E_BROKER_EMAIL ?? '',
      password: process.env.E2E_BROKER_PASSWORD ?? '',
    },
  },
  {
    role: 'customer',
    route: '/customer',
    actionCentreRoute: '/customer/action-centre',
    notificationsRoute: '/customer/notifications',
    credentials: {
      email: process.env.E2E_CUSTOMER_EMAIL ?? '',
      password: process.env.E2E_CUSTOMER_PASSWORD ?? '',
    },
  },
  {
    role: 'driver',
    route: '/driver',
    actionCentreRoute: '/driver/action-centre',
    notificationsRoute: '/driver/notifications',
    credentials: {
      email: process.env.E2E_DRIVER_EMAIL ?? '',
      password: process.env.E2E_DRIVER_PASSWORD ?? '',
    },
  },
  {
    role: 'operations',
    route: '/admin/operations-centre',
    actionCentreRoute: '/admin/action-centre',
    notificationsRoute: '/admin/notifications',
    credentials: {
      email: process.env.E2E_OPERATIONS_EMAIL ?? adminCreds.email,
      password: process.env.E2E_OPERATIONS_PASSWORD ?? adminCreds.password,
    },
  },
];

const viewports = [
  { label: 'desktop', width: 1440, height: 900, compact: false },
  { label: 'tablet', width: 768, height: 1024, compact: true },
  { label: 'mobile', width: 390, height: 844, compact: true },
] as const;

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('authenticated workspace visual verification gate', () => {
  test.describe.configure({ mode: 'serial' });

  for (const roleSpec of roleSpecs) {
    test(`${roleSpec.role} visual contract across desktop/tablet/mobile`, async ({ page }, testInfo) => {
      const { email, password } = roleSpec.credentials;
      test.skip(
        !email || !password,
        `Missing credentials for ${roleSpec.role}. Set ${roleSpec.role === 'operations' ? 'E2E_OPERATIONS_EMAIL/E2E_OPERATIONS_PASSWORD (or E2E_ADMIN_*)' : `E2E_${roleSpec.role.toUpperCase()}_EMAIL/E2E_${roleSpec.role.toUpperCase()}_PASSWORD`}`,
      );

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await loginAs(page, email, password);

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(roleSpec.route);

        const header = page.locator('header').first();
        await expect(header).toBeVisible();

        const actionCentreButton = page.getByRole('button', { name: 'Action Centre' });
        const notificationsButton = page.getByRole('button', { name: /Notifications/i });

        await expect(actionCentreButton).toBeVisible();
        await expect(notificationsButton).toBeVisible();

        await actionCentreButton.click();
        await page.waitForURL((url) => url.pathname === roleSpec.actionCentreRoute, { timeout: 10_000 });
        expect(page.url()).toContain(roleSpec.actionCentreRoute);

        await page.goto(roleSpec.route);
        await notificationsButton.click();
        await page.waitForURL((url) => url.pathname === roleSpec.notificationsRoute, { timeout: 10_000 });
        expect(page.url()).toContain(roleSpec.notificationsRoute);

        await page.goto(roleSpec.route);

        const workspaceContext = page.locator('header').first().locator('text=/Admin|Broker|Customer|Driver|Operations/i').first();
        await expect(workspaceContext).toBeVisible();

        const sidebar = page.locator('aside[aria-label$="navigation"]');
        if (viewport.compact) {
          await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
          const sidebarRightEdge = await sidebar.evaluate((el) => el.getBoundingClientRect().right);
          expect(sidebarRightEdge).toBeLessThanOrEqual(1);
        } else {
          await expect(sidebar).toBeVisible();
          const sidebarWidth = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
          expect(sidebarWidth).toBeGreaterThanOrEqual(260);
          expect(sidebarWidth).toBeLessThanOrEqual(280);
        }

        const headerHeight = await header.evaluate((el) => Math.round(el.getBoundingClientRect().height));
        expect(headerHeight).toBeGreaterThanOrEqual(56);
        expect(headerHeight).toBeLessThanOrEqual(72);

        const ticker = page.locator('[aria-label="Activity feed"]');
        await expect(ticker).toBeVisible();

        const bodyOverflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth + 1;
        });
        expect(bodyOverflow).toBe(false);

        const screenshotPath = testInfo.outputPath(`${roleSpec.role}-${viewport.label}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      const cspErrors = consoleErrors.filter((entry) => /content security policy|csp/i.test(entry));
      expect(cspErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});
