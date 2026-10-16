import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type Role =
  | 'carrier'
  | 'broker'
  | 'customer'
  | 'driver'
  | 'owner-driver'
  | 'fleet'
  | 'operations'
  | 'finance'
  | 'compliance'
  | 'viewer';

const roles: Role[] = ['carrier', 'broker', 'customer', 'driver', 'owner-driver', 'fleet', 'operations', 'finance', 'compliance', 'viewer'];

const expectedKpis: Record<Role, string[]> = {
  carrier: ['Quotes submitted', 'Won work', 'Awaiting allocation', 'Active jobs', 'POD outstanding', 'Overdue invoices'],
  broker: ['Draft loads', 'Carrier quotes', 'Awaiting award', 'Active jobs', 'Gross margin'],
  customer: ['Open loads', 'Quotes received', 'Awaiting award', 'Active deliveries', 'Unpaid invoices'],
  driver: ['Jobs today', 'Active job', 'Awaiting start', 'Documents expiring'],
  'owner-driver': ['Jobs today', 'Active job', 'Quotes submitted', 'Outstanding invoices', 'Return capacity'],
  fleet: ['Available drivers', 'Busy drivers', 'Unassigned jobs', 'Stale positions', 'Expiry alerts'],
  operations: ['Unallocated jobs', 'Active jobs', 'Exceptions', 'Available drivers', 'Stale positions'],
  finance: ['Customer invoices', 'Carrier invoices', 'Payments due', 'Outstanding balance'],
  compliance: ['Pending verification', 'Expiring documents', 'Driver issues', 'Vehicle issues'],
  viewer: ['Jobs visible', 'Active jobs', 'Completed', 'Exceptions'],
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

function topShellSelectors() {
  return {
    header: '.top-workspace-shell__header',
    nav: '.top-workspace-nav--primary',
    track: '.top-workspace-nav__track',
    overflowTarget: '.top-workspace-nav__track',
  };
}

async function gotoFixture(page: Page, path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (!response || response.status() < 400) return;
      lastError = new Error(`Fixture navigation returned HTTP ${response.status()} for ${path}`);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/ERR_ABORTED/i.test(message)) throw error;
    }
    await page.waitForTimeout(400 * (attempt + 1));
  }
  throw lastError;
}

test.describe('operational top-workspace visual fixture gate (deterministic fixture harness - not authenticated runtime proof)', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  for (const role of roles) {
    test(`${role} visual contract at desktop/tablet/mobile`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
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
        const errorText = request.failure()?.errorText ?? 'unknown error';
        let fixtureRscAbort = false;
        try {
          const parsed = new URL(url);
          fixtureRscAbort =
            parsed.pathname.startsWith('/visual-fixture/workspace/') &&
            parsed.searchParams.has('_rsc');
        } catch {
          fixtureRscAbort = false;
        }
        const expectedNavigationAbort =
          /ERR_ABORTED/i.test(errorText) &&
          (
            fixtureRscAbort ||
            /\/_next\/static\/chunks\//i.test(url) ||
            /\/_next\/static\/webpack\/.*\.hot-update\.json/i.test(url)
          );
        if (!expectedNavigationAbort && !isAllowlisted(url, EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
          failedRequests.push(`${request.method()} ${url} :: ${errorText}`);
        }
      });
      page.on('response', (response) => {
        let fixtureDocumentResponse = false;
        try {
          fixtureDocumentResponse =
            response.request().resourceType() === 'document' &&
            new URL(response.url()).pathname.startsWith('/visual-fixture/workspace/');
        } catch {
          fixtureDocumentResponse = false;
        }
        if (
          response.status() >= 400 &&
          !fixtureDocumentResponse &&
          !isExpectedUnauthenticatedFixtureResponse(response) &&
          !isAllowlisted(response.url(), EXPECTED_HTTP_ERROR_ALLOWLIST)
        ) {
          failingResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoFixture(page, `/visual-fixture/workspace/${role}`);

        const selectors = topShellSelectors();
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
        if (viewport.width > 768) {
          const navItem = await navButtons.first().evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
              height: Math.round(el.getBoundingClientRect().height),
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
            };
          });
          expect(navItem.height, `${role}/${viewport.label}: primary item height`).toBe(29);
          expect(navItem.fontSize, `${role}/${viewport.label}: primary item font size`).toBe('13px');
          expect(navItem.fontWeight, `${role}/${viewport.label}: primary item weight`).toBe('600');
        }

        if (viewport.width <= 1024) {
          const navOverflow = await overflowTarget.evaluate((el) => ({
            overflowX: window.getComputedStyle(el).overflowX,
            hasScroll: el.scrollWidth > el.clientWidth + 1,
          }));
          expect(['auto', 'scroll']).toContain(navOverflow.overflowX);
        }

        if (viewport.width > 768) {
          await expect(page.getByRole('button', { name: /Notifications/i })).toBeVisible();
          if (role === 'broker' || role === 'customer') {
            // CX keeps the primary row for operating modules only. Action Centre
            // remains reachable through More rather than consuming a primary slot.
            await expect(track.getByRole('button', { name: 'Action Centre', exact: true })).toHaveCount(0);
            await expect(track.getByRole('button', { name: 'More', exact: true })).toBeVisible();
          }
        } else {
          const notifications = page.getByRole('button', { name: /Notifications/i });
          await expect(notifications).toBeVisible();
          expect(
            await notifications.evaluate((el) => Math.round(el.getBoundingClientRect().width)),
            role + '/' + viewport.label + ': mobile notification control remains compact',
          ).toBe(32);
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

        // Dashboard KPI tiles use the same measured Courier Exchange live surface.
        // Secondary pages may still use the compact KPI strip; Super Admin is
        // deliberately outside this measured-workspace selector.
        const dashboardKpiStrip = page.locator(
          '.xdrive-owner-dashboard-grid [aria-label="Operational key performance indicators"]',
        );
        const dashboardKpi = dashboardKpiStrip.locator('[data-workspace-kpi-card]').first();
        await expect(dashboardKpi).toBeVisible();
        const kpiGeometry = await dashboardKpi.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            minHeight: computed.minHeight,
            background: computed.backgroundColor,
            borderLeftWidth: computed.borderLeftWidth,
            measuredHeight: Math.round(el.getBoundingClientRect().height),
          };
        });
        expect(kpiGeometry.minHeight, `${role}/${viewport.label}: canonical KPI minimum`).toBe('106px');
        expect(toHex(kpiGeometry.background), `${role}/${viewport.label}: Owner KPI background`).toBe('#eff6ff');
        expect(kpiGeometry.borderLeftWidth, `${role}/${viewport.label}: no legacy accent stripe`).toBe('1px');
        expect(kpiGeometry.measuredHeight).toBeGreaterThanOrEqual(106);
        const kpiColumns = await dashboardKpiStrip.evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.trim().split(' ').filter(Boolean).length,
        );
        expect(kpiColumns, `${role}/${viewport.label}: KPI columns`).toBe(2);

        const table = page.locator('table').first();
        await expect(table).toBeVisible();
        const stickyPosition = await page.locator('th').first().evaluate((el) => window.getComputedStyle(el).position);
        expect(stickyPosition).toBe('sticky');
        await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
        await expect(page.locator('span', { hasText: /Pending|In Progress|Delivered/ }).first()).toBeVisible();

        const statusGeometry = await page.locator('.xdrive-status-badge').first().evaluate((el) => {
          const style = window.getComputedStyle(el);
          return { height: Math.round(el.getBoundingClientRect().height), fontSize: style.fontSize, weight: style.fontWeight };
        });
        expect(statusGeometry.height, `${role}/${viewport.label}: measured status height`).toBeGreaterThanOrEqual(20);
        expect(statusGeometry.fontSize).toBe('12px');
        expect(statusGeometry.weight).toBe('650');
        const flushBodyPadding = await page.locator('.xdrive-operational-card__body--flush').first()
          .evaluate((el) => window.getComputedStyle(el).padding);
        expect(flushBodyPadding, `${role}/${viewport.label}: table flush body padding`).toBe('0px');

        // Legacy Panel is used on Finance statements, bulk import and Won Work.
        // Its explicit flush prop must not be undone by the shared panel-body rule.
        const panelBodyPadding = await page.evaluate(() => {
          const scope = document.querySelector('.xdrive-workspace-measured');
          if (!scope) throw new Error('Measured workspace root is missing');
          const panel = document.createElement('div');
          panel.className = 'xdrive-panel';
          panel.innerHTML = '<div class="xdrive-panel__body">Normal</div><div class="xdrive-panel__body xdrive-panel__body--flush">Flush</div>';
          scope.appendChild(panel);
          const paddings = Array.from(panel.children).map((element) => getComputedStyle(element).padding);
          panel.remove();
          return paddings;
        });
        expect(panelBodyPadding, `${role}/${viewport.label}: common Panel flush respects zero padding`).toEqual(['10px', '0px']);

        const nativeInputHeights = await page.evaluate(() => {
          const scope = document.querySelector('.xdrive-workspace-measured');
          if (!scope) throw new Error('Measured workspace root is missing');
          const fields = ['text', 'file', 'range', 'color'].map((type) => {
            const input = document.createElement('input');
            input.type = type;
            input.style.height = '44px';
            scope.appendChild(input);
            return input;
          });
          const heights = fields.map((input) => getComputedStyle(input).height);
          fields.forEach((input) => input.remove());
          return heights;
        });
        expect(nativeInputHeights, `${role}/${viewport.label}: upload/range/color controls keep native heights`)
          .toEqual(['24px', '44px', '44px', '44px']);

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

        // Preview 675 uses a compact secondary "View All" card action, not a
        // generic blue "Primary action" button in the dashboard body.
        const activityAction = page.getByRole('button', { name: 'View All' });
        await expect(activityAction).toBeVisible();
        const activityStyle = await activityAction.evaluate((el) => ({
          height: Math.round(el.getBoundingClientRect().height),
          background: window.getComputedStyle(el).backgroundColor,
        }));
        expect(activityStyle.height, `${role}/${viewport.label}: canonical action height`).toBe(24);
        expect(toHex(activityStyle.background)).toBe('#ffffff');

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

  test('shared shell header keeps actions on the right from 1025px through 1280px', async ({ page }) => {
    test.setTimeout(90_000);
    await page.route('**/api/auth/context', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberships: [], current: null }),
    }));

    for (const role of ['customer', 'broker', 'fleet'] as const) {
      for (const width of [1200, 1025]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoFixture(page, `/visual-fixture/workspace/${role}`);
        const header = page.locator('.top-workspace-shell__header');
        await expect(header).toBeVisible();
        await page.waitForFunction(() => {
          const root = document.querySelector('.xdrive-workspace-measured');
          return !!root &&
            getComputedStyle(root).getPropertyValue('--ws-nav-h').trim() === '42px' &&
            (document.querySelector('.top-workspace-shell__header')?.getBoundingClientRect().width ?? 0) > 0;
        });

        const geometry = await header.evaluate((el) => {
          const actions = el.querySelector('.top-workspace-shell__actions');
          if (!actions) throw new Error('Missing header actions');
          const box = el.getBoundingClientRect();
          const buttons = actions.getBoundingClientRect();
          return {
            columns: getComputedStyle(el).gridTemplateColumns.trim().split(' ').length,
            headerX: box.x,
            headerWidth: box.width,
            headerRight: box.right,
            actionsX: buttons.x,
            actionsRight: buttons.right,
            pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          };
        });
        expect(geometry.columns, `${role}/${width}: brand + actions only`).toBe(2);
        expect(geometry.actionsX, `${role}/${width}: actions stay on right`)
          .toBeGreaterThan(geometry.headerX + geometry.headerWidth * 0.55);
        expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.headerRight - 4);
        expect(geometry.pageOverflow).toBe(false);
      }
    }
  });

  test('shared Loads, Jobs and operational rows use the same responsive column count', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/api/auth/context', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberships: [], current: null }),
    }));
    await gotoFixture(page, '/visual-fixture/workspace/owner-driver');
    // Next.js may still be showing its route Loading... fallback after
    // DOMContentLoaded. Wait for the real operational page before injecting rows.
    await expect(page.locator('.xdrive-owner-dashboard-grid')).toBeVisible();
    // Concurrent Chromium fixture workers can reach DOMContentLoaded before the
    // measured CSS finishes loading. Assert the actual stylesheet token first.
    await page.waitForFunction(() => {
      const root = document.querySelector('.xdrive-workspace-measured');
      return !!root && getComputedStyle(root).getPropertyValue('--ws-table-head-h').trim() === '40px';
    });

    for (const { width, expected } of [
      { width: 1440, expected: 4 },
      { width: 1024, expected: 2 },
      { width: 390, expected: 1 },
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await page.evaluate(() => {
        const scope = document.querySelector('.xdrive-workspace-measured');
        if (!scope) throw new Error('Measured workspace root is missing');
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;width:min(900px,100%)';
        const selectors = [
          ['driver-load-row__top', 'driver-load-cell'],
          ['driver-job-row__top', 'driver-job-cell'],
          ['workspace-operational-row__top', 'workspace-operational-cell'],
        ] as const;
        for (const [rowClass, cellClass] of selectors) {
          const row = document.createElement('div');
          row.className = rowClass;
          for (let index = 0; index < 4; index++) {
            const cell = document.createElement('div');
            cell.className = cellClass;
            row.appendChild(cell);
          }
          probe.appendChild(row);
        }
        scope.appendChild(probe);
        const results = Array.from(probe.children).map((row) => ({
          columns: new Set(Array.from(row.children).map((cell) => Math.round(cell.getBoundingClientRect().left))).size,
          borderWidths: Array.from(row.children).map((cell) => getComputedStyle(cell).borderRightWidth),
        }));
        probe.remove();
        return results;
      });
      expect(result.map(({ columns }) => columns), `record columns at ${width}px`).toEqual([expected, expected, expected]);
      const expectedBorders = width <= 768
        ? ['0px', '0px', '0px', '0px']
        : width <= 1200
          ? ['1px', '0px', '1px', '0px']
          : ['1px', '1px', '1px', '0px'];
      for (const { borderWidths } of result) {
        expect(borderWidths, `terminal grid cells have no right-edge border at ${width}px`).toEqual(expectedBorders);
      }
    }
  });

  test('expanded operational details share the same label/value typography', async ({ page }) => {
    await page.route('**/api/auth/context', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberships: [], current: null }),
    }));
    await gotoFixture(page, '/visual-fixture/workspace/broker');
    await expect(page.locator('.xdrive-owner-dashboard-grid')).toBeVisible();
    await page.waitForFunction(() => {
      const scope = document.querySelector('.xdrive-workspace-measured');
      return !!scope && getComputedStyle(scope).getPropertyValue('--ws-font-label').trim() === '11px';
    });

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const styles = await page.evaluate(() => {
        const scope = document.querySelector('.xdrive-workspace-measured');
        if (!scope) throw new Error('Measured workspace root is missing');
        const card = document.createElement('div');
        card.className = 'workspace-detail-item';
        card.innerHTML = '<strong>Customer</strong><div>XDrive Logistics</div>';
        scope.appendChild(card);
        const label = getComputedStyle(card.firstElementChild!);
        const value = getComputedStyle(card.lastElementChild!);
        const result = {
          labelSize: label.fontSize,
          labelWeight: label.fontWeight,
          labelColor: label.color,
          valueSize: value.fontSize,
          valueWeight: value.fontWeight,
          valueColor: value.color,
          minHeight: getComputedStyle(card).minHeight,
        };
        card.remove();
        return result;
      });
      expect(styles, `expanded details at ${width}px`).toEqual({
        labelSize: '11px',
        labelWeight: '650',
        labelColor: 'rgb(94, 104, 116)',
        valueSize: '12px',
        valueWeight: '600',
        valueColor: 'rgb(48, 56, 66)',
        minHeight: '44px',
      });
    }
  });

  test('Driver Quotes status tabs use the measured CX live 28px strip and 2px underline in the visual fixture', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoFixture(page, '/visual-fixture/workspace/owner-driver');
    await expect(page.locator('.xdrive-owner-dashboard-grid')).toBeVisible();
    await page.addStyleTag({ path: 'app/driver/driver-full-prototype.css' });
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const actual = await page.locator('.xdrive-workspace-measured').evaluate((root) => {
        root.classList.add('xdrive-operational-top-workspace', 'xdrive-driver-workspace');
        const probe = document.createElement('section');
        probe.className = 'driver-prototype-port';
        probe.innerHTML = '<div class="quote-tabs"><button class="active">Received</button><button>Archived</button><button>Submitted</button><button>Unsuccessful</button></div>';
        root.appendChild(probe);
        const strip = probe.querySelector<HTMLElement>('.quote-tabs')!;
        const active = probe.querySelector<HTMLElement>('button.active')!;
        const activeStyle = getComputedStyle(active);
        const measurements = {
          stripHeight: Math.round(strip.getBoundingClientRect().height),
          buttonHeight: Math.round(active.getBoundingClientRect().height),
          fontSize: activeStyle.fontSize,
          underlineWidth: activeStyle.borderBottomWidth,
          underlineColor: activeStyle.borderBottomColor,
          scrollable: strip.scrollWidth > strip.clientWidth + 1,
          overflowX: getComputedStyle(strip).overflowX,
          bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
        probe.remove();
        return measurements;
      });
      expect(actual.stripHeight, `Quotes tab strip at ${width}px`).toBe(28);
      expect(actual.buttonHeight, `Quotes tab button at ${width}px`).toBe(28);
      expect(actual.fontSize).toBe('11px');
      expect(actual.underlineWidth).toBe('2px');
      expect(actual.underlineColor).toBe('rgb(29, 87, 216)');
      expect(actual.bodyOverflow).toBe(false);
      if (width === 390) expect(['auto', 'scroll']).toContain(actual.overflowX);
    }
  });

  test('shared Fleet filter fields and Customer semantic detail cards respond without overflow', async ({ page }) => {
    await page.route('**/api/auth/context', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberships: [], current: null }),
    }));
    await gotoFixture(page, '/visual-fixture/workspace/customer');
    await expect(page.locator('.xdrive-owner-dashboard-grid')).toBeVisible();
    await page.waitForFunction(() => {
      const root = document.querySelector('.xdrive-workspace-measured');
      return !!root && getComputedStyle(root).getPropertyValue('--ws-filter-rail-w').trim() === '165px';
    });

    for (const { width, expected } of [
      { width: 1440, expected: 4 },
      { width: 960, expected: 2 },
      { width: 390, expected: 1 },
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await page.evaluate(() => {
        const scope = document.querySelector('.xdrive-workspace-measured');
        if (!scope) throw new Error('Measured workspace root is missing');
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;width:min(100%,1000px);';
        const filters = document.createElement('div');
        filters.className = 'workspace-filter-fields';
        for (let i = 0; i < 6; i++) {
          const label = document.createElement('label');
          label.innerHTML = '<input type="text" aria-label="Filter" />';
          filters.appendChild(label);
        }
        const evenFilters = filters.cloneNode(true) as HTMLElement;
        evenFilters.className = 'workspace-filter-fields workspace-filter-fields--even';
        const wideFilter = document.createElement('label');
        wideFilter.className = 'workspace-filter-fields__wide';
        wideFilter.textContent = 'Via locations';
        evenFilters.appendChild(wideFilter);
        const details = document.createElement('dl');
        details.className = 'workspace-detail-grid';
        for (let i = 0; i < 5; i++) {
          const item = document.createElement('div');
          item.className = 'workspace-detail-item';
          item.innerHTML = '<dt>Collection</dt><dd>Blackburn, BB1</dd>';
          details.appendChild(item);
        }
        const twoColumn = document.createElement('div');
        twoColumn.className = 'xdrive-two-column';
        twoColumn.style.cssText = 'display:grid;grid-template-columns:minmax(0,.79fr) minmax(0,1.2fr);gap:12px';
        for (let i = 0; i < 2; i++) {
          const panel = document.createElement('div');
          panel.textContent = `Panel ${i + 1}`;
          twoColumn.appendChild(panel);
        }
        probe.append(filters, evenFilters, details, twoColumn);
        scope.appendChild(probe);
        const columns = (element: HTMLElement) => new Set(Array.from(element.children)
          .map((child) => Math.round(child.getBoundingClientRect().left))).size;
        const result = {
          filterColumns: columns(filters),
          evenFilterColumns: columns(evenFilters),
          detailColumns: columns(details),
          twoColumnColumns: columns(twoColumn),
          twoColumnOverflow: twoColumn.scrollWidth > twoColumn.clientWidth + 1,
          filterOverflow: filters.scrollWidth > filters.clientWidth + 1,
          evenFilterOverflow: evenFilters.scrollWidth > evenFilters.clientWidth + 1,
          wideFilterIsFullWidth: Math.abs(wideFilter.getBoundingClientRect().width - evenFilters.getBoundingClientRect().width) < 2,
          detailOverflow: details.scrollWidth > details.clientWidth + 1,
          definitionMargin: getComputedStyle(details).margin,
          labelSize: getComputedStyle(details.querySelector('dt')!).fontSize,
          valueSize: getComputedStyle(details.querySelector('dd')!).fontSize,
        };
        probe.remove();
        return result;
      });
      expect(result, `shared filter/detail geometry at ${width}px`).toEqual({
        filterColumns: expected,
        evenFilterColumns: expected,
        detailColumns: expected,
        twoColumnColumns: width > 1024 ? 2 : 1,
        twoColumnOverflow: false,
        filterOverflow: false,
        evenFilterOverflow: false,
        wideFilterIsFullWidth: width <= 1024,
        detailOverflow: false,
        definitionMargin: '0px',
        labelSize: '11px',
        valueSize: '12px',
      });
    }
  });

  test('shared PageFrame keeps canonical responsive measured padding at every breakpoint', async ({ page }) => {
    test.setTimeout(90_000);
    await page.route('**/api/auth/context', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberships: [], current: null }),
    }));

    for (const role of ['customer', 'broker', 'carrier'] as const) {
      for (const width of [390, 1024, 1440]) {
        const expectedX = width <= 768 ? '8px' : width <= 1024 ? '10px' : '12px';
        await page.setViewportSize({ width, height: 900 });
        await gotoFixture(page, `/visual-fixture/workspace/${role}`);
        await expect(page.locator('.xdrive-owner-dashboard-grid')).toBeVisible();
        await page.waitForFunction((px) => {
          const root = document.querySelector('.xdrive-workspace-measured');
          return !!root && getComputedStyle(root).getPropertyValue('--ws-page-x').trim() === px;
        }, expectedX);
        const paddings = await page.evaluate(() => {
          const container = document.querySelector('.top-workspace-shell__content');
          if (!container) throw new Error('Missing live top-workspace content wrapper');
          const probe = document.createElement('div');
          probe.className = 'xdrive-page-frame';
          container.appendChild(probe);
          const style = getComputedStyle(probe);
          const result = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
          probe.remove();
          return result;
        });
        expect(paddings, `${role}/${width}px: baseline PageFrame spacing`).toEqual([expectedX, expectedX, '16px', expectedX]);
      }
    }
  });

  test('Return Journeys rail inherits the shared sticky offset and responsive filter width', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/api/auth/context', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memberships: [], current: null }),
    }));
    await gotoFixture(page, '/visual-fixture/workspace/owner-driver');
    await expect(page.locator('.xdrive-owner-dashboard-grid')).toBeVisible();
    // Inject the EXISTING live route stylesheet after the shared CSS; this
    // emulates the hardest cascade order without bypassing authentication.
    const returnsCss = fs.readFileSync('app/driver/returns/returns-exchange.css', 'utf8');
    await page.addStyleTag({ content: returnsCss });

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await page.evaluate(() => {
        const scope = document.querySelector('.xdrive-workspace-measured');
        if (!scope) throw new Error('Measured workspace wrapper missing');
        const exchange = document.createElement('div');
        exchange.className = 'driver-returns-exchange';
        const board = document.createElement('div');
        board.className = 'driver-returns-board';
        const rail = document.createElement('aside');
        rail.className = 'driver-filter-rail';
        const main = document.createElement('div');
        main.className = 'driver-board-main';
        board.append(rail, main);
        exchange.appendChild(board);
        scope.appendChild(exchange);
        const styles = getComputedStyle(rail);
        const result = {
          position: styles.position,
          top: styles.top,
          width: Math.round(rail.getBoundingClientRect().width),
          boardWidth: Math.round(board.getBoundingClientRect().width),
        };
        exchange.remove();
        return result;
      });
      if (width > 1024) {
        expect(result.position).toBe('sticky');
        expect(result.top).toBe('92px');
        expect(result.width).toBe(165);
      } else {
        expect(result.position).toBe('static');
        expect(result.width, `Return Journeys at ${width}px must fill its single-column board`)
          .toBeGreaterThanOrEqual(result.boardWidth - 1);
      }
    }
  });
});
