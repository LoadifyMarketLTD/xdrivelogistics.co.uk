import { expect, test } from '@playwright/test';

type Role =
  | 'carrier'
  | 'broker'
  | 'customer'
  | 'driver'
  | 'fleet'
  | 'operations';

const roles: Role[] = ['carrier', 'broker', 'customer', 'driver', 'fleet', 'operations'];

const expectedKpis: Record<Role, string[]> = {
  carrier: ['Quotes submitted', 'Won work', 'Awaiting allocation', 'Active jobs', 'POD outstanding', 'Overdue invoices'],
  broker: ['Draft loads', 'Carrier quotes', 'Awaiting award', 'Active jobs', 'Gross margin'],
  customer: ['Open loads', 'Quotes received', 'Awaiting award', 'Active deliveries', 'Unpaid invoices'],
  driver: ['Jobs today', 'Active job', 'Awaiting start', 'Documents expiring', 'Quotes submitted'],
  fleet: ['Available drivers', 'Busy drivers', 'Unassigned jobs', 'Stale positions', 'Expiry alerts'],
  operations: ['Unallocated jobs', 'Active jobs', 'Exceptions', 'Available drivers', 'Stale positions'],
};

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

const EXPECTED_FAILED_REQUEST_ALLOWLIST = [
  /\/__next\/webpack-hmr\b/i,
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
];

const EXPECTED_HTTP_ERROR_ALLOWLIST = [
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
  /\/favicon\.ico$/i,
];

const isAllowlisted = (url: string, allowlist: RegExp[]) =>
  allowlist.some((pattern) => pattern.test(url));

const isExpectedUnauthenticatedFixtureResponse = (response: {
  status: () => number;
  url: () => string;
  request: () => { method: () => string };
}) => {
  if (response.status() !== 401 || response.request().method() !== 'GET') return false;
  try {
    return new URL(response.url()).pathname === '/api/auth/context';
  } catch {
    return false;
  }
};

const toHex = (value: string) => {
  const match = value.match(/\d+/g);
  if (!match || match.length < 3) return value.trim().toLowerCase();
  const [r, g, b] = match.slice(0, 3).map((entry) => Number(entry));
  return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, '0')).join('')}`;
};

function topShellSelectors(role: Role) {
  if (role === 'driver') {
    return {
      header: '.driver-top-shell__header',
      nav: '.driver-top-nav',
      track: '.driver-top-nav__track',
      overflowTarget: '.driver-top-nav',
    };
  }
  return {
    header: '.top-workspace-shell__header',
    nav: '.top-workspace-nav',
    track: '.top-workspace-nav__track',
    overflowTarget: '.top-workspace-nav__track',
  };
}

test.describe('operational top-workspace visual fixture gate (deterministic fixture harness — not authenticated runtime proof)', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  for (const role of roles) {
    test(`${role} visual contract at desktop/tablet/mobile`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const failingResponses: string[] = [];

      // The fixture deliberately runs without an authenticated user. The real top
      // shells include SharedContextControls, which correctly requests this API and
      // would otherwise receive a 401. Stub only this known context dependency so
      // visual assertions remain deterministic while every other failed request /
      // HTTP error continues to fail the gate.
      await page.route('**/api/auth/context', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            memberships: [],
            current: null,
            companySelectionRequired: false,
            workspaceSelectionRequired: false,
            selectedCompanyId: null,
          }),
        });
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('requestfailed', (request) => {
        const url = request.url();
        if (!isAllowlisted(url, EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
          failedRequests.push(`${request.method()} ${url} :: ${request.failure()?.errorText ?? 'unknown error'}`);
        }
      });
      page.on('response', (response) => {
        if (
          response.status() >= 400 &&
          !isExpectedUnauthenticatedFixtureResponse(response) &&
          !isAllowlisted(response.url(), EXPECTED_HTTP_ERROR_ALLOWLIST)
        ) {
          failingResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/visual-fixture/workspace/${role}`);
        await page.waitForLoadState('networkidle');

        const selectors = topShellSelectors(role);
        const header = page.locator(selectors.header);
        const nav = page.locator(selectors.nav);
        const track = page.locator(selectors.track);
        const overflowTarget = page.locator(selectors.overflowTarget);

        await expect(header).toBeVisible();
        await expect(nav).toBeVisible();
        await expect(track).toBeVisible();

        // Accepted operational architecture: top navigation only. The legacy
        // sidebar contract is intentionally not part of these role surfaces.
        await expect(page.locator('aside[aria-label$="navigation"]')).toHaveCount(0);
        await expect(page.locator('[aria-label="Activity feed"]')).toHaveCount(0);
        await expect(page.getByText('Platform owner workspace')).toHaveCount(0);

        // Geometry is owned by the measured CX source contract. This fixture must
        // not re-introduce a second height system or pin runtime to the removed
        // workspace-visual-scale.css values.
        expect(
          await header.evaluate((el) => Math.round(el.getBoundingClientRect().height)),
          `${role}/${viewport.label}: shell header remains usable`,
        ).toBeGreaterThanOrEqual(48);
        expect(
          await nav.evaluate((el) => Math.round(el.getBoundingClientRect().height)),
          `${role}/${viewport.label}: navigation remains usable`,
        ).toBeGreaterThanOrEqual(28);

        const navButtons = track.getByRole('button');
        expect(await navButtons.count()).toBeGreaterThan(0);

        if (viewport.width <= 1024) {
          const navOverflow = await overflowTarget.evaluate((el) => ({
            overflowX: window.getComputedStyle(el).overflowX,
            hasScroll: el.scrollWidth > el.clientWidth + 1,
          }));
          expect(['auto', 'scroll']).toContain(navOverflow.overflowX);
        }

        await expect(page.getByRole('button', { name: /Notifications/i })).toBeVisible();
        if (viewport.width > 768) {
          await expect(page.getByRole('button', { name: 'Action Centre' })).toBeVisible();
        }

        const pageOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(pageOverflow, `${role}/${viewport.label}: no body horizontal overflow`).toBe(false);

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
          const innerTable = el.querySelector('table');
          const tableWidth = innerTable ? innerTable.scrollWidth : 0;
          return {
            containerOverflowX: window.getComputedStyle(el).overflowX,
            hasHorizontalScroll: el.scrollWidth > el.clientWidth + 1,
            tableExceedsContainer: tableWidth > el.clientWidth + 1,
          };
        });
        expect(['auto', 'scroll']).toContain(overflowContract.containerOverflowX);
        if (overflowContract.hasHorizontalScroll) {
          expect(overflowContract.tableExceedsContainer).toBe(true);
        }

        const primaryAction = page.getByRole('button', { name: 'Primary action' });
        await expect(primaryAction).toBeVisible();
        const primaryBg = await primaryAction.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(toHex(primaryBg)).toBe('#1d57d8');

        await page.screenshot({
          path: testInfo.outputPath(`workspace-fixture-${role}-${viewport.label}.png`),
          fullPage: true,
        });
      }

      const nonHydrationErrors = consoleErrors.filter(
        (entry) => !entry.includes("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."),
      );
      const resourceConsoleErrors = nonHydrationErrors.filter((entry) =>
        /^Failed to load resource: the server responded with a status of \d+ \(.+\)$/i.test(entry),
      );
      const actionableConsoleErrors = nonHydrationErrors.filter(
        (entry) => !resourceConsoleErrors.includes(entry),
      );
      const cspErrors = actionableConsoleErrors.filter((entry) => /content security policy|csp/i.test(entry));

      // Browser resource errors do not include the request URL in console output.
      // Keep the HTTP response gate authoritative for those so a real 4xx/5xx still
      // fails below with method + URL instead of being hidden by a generic message.
      expect(cspErrors).toEqual([]);
      expect(actionableConsoleErrors).toEqual([]);
      expect(failedRequests).toEqual([]);
      expect(failingResponses).toEqual([]);
    });
  }
});
