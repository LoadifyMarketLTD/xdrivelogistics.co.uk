import { expect, test, type Page } from '@playwright/test';

type Role = 'admin' | 'broker' | 'customer' | 'driver' | 'carrier' | 'super-admin';

const roles: Array<{
  id: Role;
  route: string;
  email: string;
  password: string;
  headingPatterns: RegExp[];
}> = [
  {
    id: 'admin',
    route: '/admin',
    email: process.env.E2E_ADMIN_EMAIL ?? '',
    password: process.env.E2E_ADMIN_PASSWORD ?? '',
    headingPatterns: [/Carrier Dashboard/i, /Fleet Dashboard/i, /Finance Dashboard/i, /Compliance Dashboard/i],
  },
  {
    id: 'broker',
    route: '/broker',
    email: process.env.E2E_BROKER_EMAIL ?? '',
    password: process.env.E2E_BROKER_PASSWORD ?? '',
    headingPatterns: [/Broker Dashboard/i],
  },
  {
    id: 'customer',
    route: '/customer',
    email: process.env.E2E_CUSTOMER_EMAIL ?? '',
    password: process.env.E2E_CUSTOMER_PASSWORD ?? '',
    headingPatterns: [/Customer Dashboard/i],
  },
  {
    id: 'driver',
    route: '/driver',
    email: process.env.E2E_DRIVER_EMAIL ?? '',
    password: process.env.E2E_DRIVER_PASSWORD ?? '',
    headingPatterns: [/Owner Driver Dashboard/i, /Driver Dashboard/i],
  },
  {
    id: 'carrier',
    route: '/admin',
    email: process.env.E2E_CARRIER_EMAIL ?? '',
    password: process.env.E2E_CARRIER_PASSWORD ?? '',
    headingPatterns: [/Carrier Dashboard/i, /Fleet Dashboard/i],
  },
  {
    id: 'super-admin',
    route: '/super-admin',
    email: process.env.E2E_OWNER_EMAIL ?? '',
    password: process.env.E2E_OWNER_PASSWORD ?? '',
    headingPatterns: [/XDrive Owner Console/i],
  },
];

const viewports = [
  { label: 'desktop', width: 1440, height: 900, mobile: false, tablet: false },
  { label: 'tablet', width: 768, height: 1024, mobile: false, tablet: true },
  { label: 'mobile', width: 390, height: 844, mobile: true, tablet: false },
] as const;

const EXPECTED_FAILED_REQUEST_ALLOWLIST = [
  /\/__next\/webpack-hmr\b/i,
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
];

// Only known, non-user-facing development endpoints are allowlisted.
const EXPECTED_HTTP_ERROR_ALLOWLIST = [
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
  /\/favicon\.ico$/i,
];

const isAllowlisted = (url: string, allowlist: RegExp[]) =>
  allowlist.some((pattern) => pattern.test(url));

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
};

test.describe('authenticated workspace visual verification gate (real routes)', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Set E2E_VISUAL_FIXTURE=true to run visual route proof tests.');

  for (const role of roles) {
    test(`${role.id} route proof at desktop/tablet/mobile`, async ({ page }, testInfo) => {
      test.skip(!role.email || !role.password, `Missing credentials for ${role.id}: set email/password env vars.`);
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const failingResponses: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('requestfailed', (request) => {
        const url = request.url();
        if (!isAllowlisted(url, EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
          failedRequests.push(`${request.method()} ${url} :: ${request.failure()?.errorText ?? 'unknown error'}`);
        }
      });
      page.on('response', (response) => {
        const status = response.status();
        if (status >= 400) {
          const url = response.url();
          if (!isAllowlisted(url, EXPECTED_HTTP_ERROR_ALLOWLIST)) {
            failingResponses.push(`${status} ${response.request().method()} ${url}`);
          }
        }
      });

      await loginAs(page, role.email, role.password);

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(role.route);
        await page.waitForLoadState('networkidle');

        await expect.poll(() => new URL(page.url()).pathname).toMatch(new RegExp(`^${escapeRegExp(role.route)}(?:/|$)`));
        await expect(page.getByText('Workspace fixture')).toHaveCount(0);

        const heading = page.locator('h1').first();
        await expect(heading).toBeVisible({ timeout: 15_000 });
        const headingText = (await heading.textContent()) ?? '';
        expect(
          role.headingPatterns.some((pattern) => pattern.test(headingText)),
          `${role.id} should render its real dashboard heading on ${role.route}, got "${headingText}"`,
        ).toBe(true);

        const sidebar = page.locator('aside[aria-label$="navigation"]');
        if (viewport.mobile) {
          await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
          const rightEdge = await sidebar.evaluate((el) => el.getBoundingClientRect().right);
          expect(rightEdge).toBeLessThanOrEqual(1);
        } else if (viewport.tablet) {
          await expect(sidebar).toBeVisible();
          const width = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
          expect(width).toBeGreaterThanOrEqual(54);
          expect(width).toBeLessThanOrEqual(58);
        } else {
          await expect(sidebar).toBeVisible();
          const width = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
          expect(width).toBeGreaterThanOrEqual(228);
          expect(width).toBeLessThanOrEqual(232);
        }

        const actionCentreButton = page.getByRole('button', { name: 'Action Centre' });
        await expect(actionCentreButton).toBeVisible({ timeout: 15_000 });
        const header = actionCentreButton.locator('xpath=ancestor::header[1]');
        const headerHeight = await header.evaluate((el) => Math.round(el.getBoundingClientRect().height));
        expect(headerHeight).toBeGreaterThanOrEqual(48);
        expect(headerHeight).toBeLessThanOrEqual(52);

        const notificationsButton = page.getByRole('button', { name: /Notifications/i });
        await expect(actionCentreButton).toBeVisible();
        await expect(notificationsButton).toBeVisible();
        const actionRoute = await actionCentreButton.getAttribute('data-route');
        const notificationRoute = await notificationsButton.getAttribute('data-route');
        expect(actionRoute).toBeTruthy();
        expect(notificationRoute).toBeTruthy();
        expect(actionRoute).not.toBe(notificationRoute);

        const pageOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(pageOverflow).toBe(false);

        await expect(page.getByRole('button', { name: /Open menu|Action Centre|Notifications/i }).first()).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`${role.id}-dashboard-${viewport.width}x${viewport.height}-after.jpeg`),
          fullPage: true,
          type: 'jpeg',
          quality: 80,
        });
      }

      const nonHydrationErrors = consoleErrors.filter(
        (entry) => !entry.includes("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."),
      );
      const cspErrors = nonHydrationErrors.filter((entry) => /content security policy|csp/i.test(entry));
      expect(cspErrors).toEqual([]);
      expect(nonHydrationErrors).toEqual([]);
      expect(failedRequests).toEqual([]);
      expect(failingResponses).toEqual([]);
    });
  }
});
