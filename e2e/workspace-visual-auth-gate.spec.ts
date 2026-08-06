import { expect, test } from '@playwright/test';

type Role =
  | 'carrier'
  | 'broker'
  | 'customer'
  | 'driver'
  | 'fleet'
  | 'operations'
  | 'super-admin';

const roles: Role[] = ['carrier', 'broker', 'customer', 'driver', 'fleet', 'operations', 'super-admin'];

const expectedKpis: Record<Role, string[]> = {
  carrier: ['Quotes submitted', 'Won work', 'Awaiting allocation', 'Active jobs', 'POD outstanding', 'Overdue invoices'],
  broker: ['Draft loads', 'Carrier quotes', 'Awaiting award', 'Active jobs', 'Gross margin'],
  customer: ['Open loads', 'Quotes received', 'Awaiting award', 'Active deliveries', 'Unpaid invoices'],
  driver: ['Jobs today', 'Active job', 'Awaiting start', 'Documents expiring', 'Quotes submitted'],
  fleet: ['Available drivers', 'Busy drivers', 'Unassigned jobs', 'Stale positions', 'Expiry alerts'],
  operations: ['Unallocated jobs', 'Active jobs', 'Exceptions', 'Available drivers', 'Stale positions'],
  'super-admin': ['P0/P1 Actions', 'Jobs at Risk', 'Blocked Accounts', 'Overdue Invoices', 'Degraded Services'],
};

const viewports = [
  { label: 'desktop', width: 1440, height: 900, compact: false },
  { label: 'tablet', width: 768, height: 1024, compact: true },
  { label: 'mobile', width: 390, height: 844, compact: true },
] as const;

// Expected in Next.js dev-mode while keeping fixture route fail-closed in production builds.
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

const toHex = (value: string) => {
  const match = value.match(/\d+/g);
  if (!match || match.length < 3) return value.trim().toLowerCase();
  const [r, g, b] = match.slice(0, 3).map((entry) => Number(entry));
  return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, '0')).join('')}`;
};

test.describe('authenticated workspace visual verification gate (fixture harness)', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  for (const role of roles) {
    test(`${role} visual contract at desktop/tablet/mobile`, async ({ page }, testInfo) => {
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

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/visual-fixture/workspace/${role}`);
        await page.waitForLoadState('networkidle');

        const header = page
          .locator('header')
          .filter({ has: page.getByRole('button', { name: 'Action Centre' }) })
          .first();
        await expect(header).toBeVisible();

        const sidebar = page.locator('aside[aria-label$="navigation"]');
        if (viewport.width <= 640) {
          await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
          const rightEdge = await sidebar.evaluate((el) => el.getBoundingClientRect().right);
          expect(rightEdge).toBeLessThanOrEqual(1);
          const mainLeft = await page.locator('main').evaluate((el) => Math.round(el.getBoundingClientRect().left));
          expect(mainLeft).toBeLessThanOrEqual(1);
        } else if (viewport.width <= 1024) {
          await expect(sidebar).toBeVisible();
          const width = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
          expect(width).toBe(56);
        } else {
          await expect(sidebar).toBeVisible();
          const width = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
          expect(width).toBeGreaterThanOrEqual(228);
          expect(width).toBeLessThanOrEqual(232);
        }

        const headerHeight = await header.evaluate((el) => Math.round(el.getBoundingClientRect().height));
        expect(headerHeight).toBe(50);

        const actionCentreButton = page.getByRole('button', { name: 'Action Centre' });
        const notificationsButton = page.locator('header').getByRole('button', { name: /Notifications/i });
        await expect(actionCentreButton).toBeVisible();
        await expect(notificationsButton).toBeVisible();
        const actionRoute = await actionCentreButton.getAttribute('data-route');
        const notificationRoute = await notificationsButton.getAttribute('data-route');
        expect(actionRoute).toBeTruthy();
        expect(notificationRoute).toBeTruthy();
        expect(actionRoute).not.toBe(notificationRoute);

        const ticker = page.locator('[aria-label="Activity feed"]');
        await expect(ticker).toBeVisible();
        const layoutRects = await page.evaluate(() => {
          const headerEl = document.querySelector('header');
          const tickerEl = document.querySelector('[aria-label="Activity feed"]');
          const mainEl = document.querySelector('main');
          const toRect = (el: Element | null) => {
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            };
          };
          return {
            header: toRect(headerEl),
            ticker: toRect(tickerEl),
            main: toRect(mainEl),
          };
        });
        expect(layoutRects.header).toBeTruthy();
        expect(layoutRects.ticker).toBeTruthy();
        expect(layoutRects.main).toBeTruthy();
        expect(layoutRects.header!.bottom).toBeLessThanOrEqual(layoutRects.main!.top + 1);
        expect(layoutRects.ticker!.bottom).toBeLessThanOrEqual(layoutRects.main!.top + 1);

        const kpiLabels = await page
          .locator('[aria-label="Operational key performance indicators"] > *')
          .evaluateAll((nodes) =>
            nodes.map((node) => (node as HTMLElement).getAttribute('aria-label') ?? '').filter(Boolean),
          );
        expect(kpiLabels).toEqual(expectedKpis[role]);
        expect(new Set(kpiLabels).size).toBe(kpiLabels.length);

        const table = page.locator('table').first();
        await expect(table).toBeVisible();
        const stickyPosition = await page.locator('th').first().evaluate((el) => window.getComputedStyle(el).position);
        expect(stickyPosition).toBe('sticky');
        await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
        await expect(page.locator('span', { hasText: /Pending|In Progress|Delivered/ }).first()).toBeVisible();

        const tableScroll = table.locator('xpath=ancestor::div[1]');
        const overflowContract = await tableScroll.evaluate((el) => {
          const table = el.querySelector('table');
          const tableWidth = table ? table.scrollWidth : 0;
          return {
            containerOverflowX: window.getComputedStyle(el).overflowX,
            containerClientWidth: el.clientWidth,
            containerScrollWidth: el.scrollWidth,
            tableWidth,
            pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            hasHorizontalScroll: el.scrollWidth > el.clientWidth + 1,
            tableExceedsContainer: tableWidth > el.clientWidth + 1,
          };
        });
        expect(overflowContract.pageOverflow).toBe(false);
        expect(['auto', 'scroll']).toContain(overflowContract.containerOverflowX);
        if (overflowContract.hasHorizontalScroll) {
          expect(overflowContract.tableExceedsContainer).toBe(true);
        }
        if (viewport.width <= 440) {
          expect(overflowContract.hasHorizontalScroll).toBe(true);
        }

        if (role !== 'super-admin') {
          await expect(page.getByText('Admin-only escalation queue')).toHaveCount(0);
        } else {
          await expect(page.getByText('Admin-only escalation queue')).toBeVisible();
        }

        const paletteSample = await page.evaluate(() => {
          const ticker = document.querySelector('[aria-label="Activity feed"]');
          const tickerBg = ticker ? window.getComputedStyle(ticker).backgroundColor : '';
          const primaryAction = Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.includes('Primary action'));
          const primaryBg = primaryAction ? window.getComputedStyle(primaryAction).backgroundColor : '';
          return { tickerBg, primaryBg };
        });
        expect(toHex(paletteSample.tickerBg)).toBe('#0b2f6b');
        expect(toHex(paletteSample.primaryBg)).toBe('#1d57d8');

        await expect(page.getByRole('button', { name: /Open menu|Action Centre|Notifications/i }).first()).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`workspace-fixture-${role}-${viewport.label}.png`),
          fullPage: true,
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
