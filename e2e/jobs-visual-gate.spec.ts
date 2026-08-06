/**
 * Jobs Visual Gate
 *
 * Renders the deterministic Jobs operational fixture at three canonical
 * viewports and asserts the rendered layout, column geometry, responsive
 * behaviour, action eligibility, driver-filter interaction and expand-row
 * detail panel.
 *
 * Fixture URL : /visual-fixture/jobs
 * Viewports   : 1440×900 (desktop) · 768×1024 (tablet) · 390×844 (mobile)
 * Guard       : E2E_VISUAL_FIXTURE=true (fail-closed in production builds)
 *
 * Reference   : docs/ui/cx/jobs.md, PR #338 directive §§1–5
 */

import { expect, test } from '@playwright/test';

const FIXTURE_URL = '/visual-fixture/jobs';

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900, mobile: false, tablet: false },
  { label: 'tablet',  width: 768,  height: 1024, mobile: false, tablet: true },
  { label: 'mobile',  width: 390,  height: 844,  mobile: true,  tablet: false },
] as const;

// Known non-user-facing Next.js dev endpoints — excluded from failed-request checks.
const FAILED_REQUEST_ALLOWLIST = [
  /\/__next\/webpack-hmr\b/i,
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
];

const HTTP_ERROR_ALLOWLIST = [
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
  /\/favicon\.ico$/i,
];

const isAllowlisted = (url: string, list: RegExp[]) => list.some((p) => p.test(url));

// ─── Driver IDs used in the fixture ──────────────────────────────────────────
const DRIVER_A_ID = 'fixture-driver-aaa-111'; // James Mitchell — assigned to JOB-F003 and JOB-F010
const DRIVER_B_ID = 'fixture-driver-bbb-222'; // Sarah Okafor    — assigned to JOB-F009

test.describe('Jobs operational surface visual/interaction gate', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  test('Jobs fixture at desktop / tablet / mobile', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const failingResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (!isAllowlisted(url, FAILED_REQUEST_ALLOWLIST)) {
        failedRequests.push(`${req.method()} ${url} :: ${req.failure()?.errorText ?? 'unknown'}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !isAllowlisted(res.url(), HTTP_ERROR_ALLOWLIST)) {
        failingResponses.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(FIXTURE_URL);
      await page.waitForLoadState('networkidle');

      // ── Shell geometry (all viewports) ───────────────────────────────────

      // Header: 50px contract (±2px tolerance per §3)
      const actionCentreButton = page.getByRole('button', { name: 'Action Centre' });
      await expect(actionCentreButton).toBeVisible({ timeout: 15_000 });
      const header = actionCentreButton.locator('xpath=ancestor::header[1]');
      await expect(header).toBeVisible();
      const headerHeight = await header.evaluate((el) =>
        Math.round(el.getBoundingClientRect().height),
      );
      expect(headerHeight, `${vp.label}: header height`).toBeGreaterThanOrEqual(48);
      expect(headerHeight, `${vp.label}: header height`).toBeLessThanOrEqual(52);

      // Activity feed ticker
      await expect(page.locator('[aria-label="Activity feed"]')).toBeVisible();

      // No horizontal body overflow at any viewport
      const bodyOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(bodyOverflow, `${vp.label}: no body horizontal overflow`).toBe(false);

      // KPI strip — verify semantic job metrics, not a fixed card quota
      const kpiLabels = await page
        .locator('[aria-label="Operational key performance indicators"] > *')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim().split(/\s*\n+\s*/)[0] ?? '').filter(Boolean),
        );
      expect(kpiLabels, `${vp.label}: KPI labels`).toEqual([
        'All jobs',
        'Draft jobs',
        'Allocated jobs',
        'Assigned drivers',
      ]);

      // Status tab bar
      await expect(
        page.getByRole('tablist', { name: /filter jobs by status/i }),
        `${vp.label}: status tab bar`,
      ).toBeVisible();

      if (!vp.mobile) {
        // ── Desktop and tablet ──────────────────────────────────────────────

        // Table section is visible; mobile card list is hidden
        await expect(
          page.locator('[data-testid="jobs-desktop-table"]'),
          `${vp.label}: desktop table visible`,
        ).toBeVisible();

        const mobileListDisplay = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="jobs-mobile-cards"]');
          return el ? window.getComputedStyle(el).display : 'not-found';
        });
        expect(mobileListDisplay, `${vp.label}: mobile card list hidden`).toBe('none');

        // Overflow contract: table may scroll inside its own container; body must not
        const overflowContract = await page.evaluate(() => {
          const tableSection = document.querySelector('[data-testid="jobs-desktop-table"]');
          const scrollContainer = tableSection?.querySelector('[class*="operationalTableScroll"]') as HTMLElement | null;
          const table = tableSection?.querySelector('table') as HTMLElement | null;
          if (!scrollContainer || !table) return null;
          return {
            containerOverflowX: window.getComputedStyle(scrollContainer).overflowX,
            hasScroll: scrollContainer.scrollWidth > scrollContainer.clientWidth + 1,
            tableExceedsContainer: table.scrollWidth > scrollContainer.clientWidth + 1,
          };
        });
        expect(overflowContract, `${vp.label}: overflow contract objects`).not.toBeNull();
        expect(
          ['auto', 'scroll'],
          `${vp.label}: scroll container overflowX`,
        ).toContain(overflowContract!.containerOverflowX);
        if (overflowContract!.hasScroll) {
          expect(overflowContract!.tableExceedsContainer, `${vp.label}: table exceeds container when scrolling`).toBe(true);
        }

        // Sticky table header
        const stickyPos = await page
          .locator('[data-testid="jobs-desktop-table"] th')
          .first()
          .evaluate((el) => window.getComputedStyle(el).position);
        expect(stickyPos, `${vp.label}: sticky th`).toBe('sticky');

        if (!vp.tablet) {
          // ── Desktop-only ──────────────────────────────────────────────────

          // Sidebar: full 230px
          const sidebar = page.locator('aside[aria-label$="navigation"]');
          await expect(sidebar).toBeVisible();
          const sidebarWidth = await sidebar.evaluate((el) =>
            Math.round(el.getBoundingClientRect().width),
          );
          expect(sidebarWidth, 'desktop: sidebar width').toBeGreaterThanOrEqual(228);
          expect(sidebarWidth, 'desktop: sidebar width').toBeLessThanOrEqual(232);

          // At least 10 data rows visible (fixture has 12 records, perPage=10)
          const viewJobBtns = page.locator(
            '[data-testid="jobs-desktop-table"] [aria-label^="View job"]',
          );
          const rowCount = await viewJobBtns.count();
          expect(rowCount, 'desktop: at least 10 rows').toBeGreaterThanOrEqual(10);

          // Row density: first data row height ≤ 60px (contract ≤ 52px target, max 60px)
          const firstRowHeight = await page.evaluate(() => {
            const btn = document.querySelector(
              '[data-testid="jobs-desktop-table"] [aria-label^="View job"]',
            );
            const row = btn?.closest('tr');
            return row ? row.getBoundingClientRect().height : -1;
          });
          expect(firstRowHeight, 'desktop: first row height > 0').toBeGreaterThan(0);
          expect(firstRowHeight, 'desktop: first row height ≤ 60px').toBeLessThanOrEqual(60);

          // Pagination controls are rendered (totalFiltered=12 > perPage=10)
          await expect(
            page.locator('[aria-label="Pagination"]'),
            'desktop: pagination bar',
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: 'Next page' }),
            'desktop: Next page button enabled',
          ).toBeEnabled();

          // Driver filter select is visible (fixture has 2 drivers)
          const driverSelect = page.getByRole('combobox', { name: /filter by assigned driver/i });
          await expect(driverSelect, 'desktop: driver filter select').toBeVisible();

          // Driver filter interaction: filter by James Mitchell → 2 jobs (F003 + F010)
          await driverSelect.selectOption(DRIVER_A_ID);
          await page.waitForTimeout(100); // allow React state update
          const filteredCount = await page
            .locator('[data-testid="jobs-desktop-table"] [aria-label^="View job"]')
            .count();
          expect(filteredCount, 'desktop: driver A filter → 2 rows').toBe(2);

          // Driver filter interaction: filter by Sarah Okafor → 1 job (F009)
          await driverSelect.selectOption(DRIVER_B_ID);
          await page.waitForTimeout(100);
          const filteredCountB = await page
            .locator('[data-testid="jobs-desktop-table"] [aria-label^="View job"]')
            .count();
          expect(filteredCountB, 'desktop: driver B filter → 1 row').toBe(1);

          // Reset driver filter
          await driverSelect.selectOption('');
          await page.waitForTimeout(100);

          // Post action: only visible for draft jobs (JOB-F001 is first row)
          // The Post button for JOB-F001 should be present in the table
          await expect(
            page.locator(
              '[data-testid="jobs-desktop-table"] [aria-label="Post job JOB-F001 to marketplace"]',
            ),
            'desktop: Post button for draft job JOB-F001',
          ).toBeVisible();

          // No Post button for the delivered job (JOB-F004) — terminal status
          await expect(
            page.locator(
              '[data-testid="jobs-desktop-table"] [aria-label="Post job JOB-F004 to marketplace"]',
            ),
            'desktop: no Post button for delivered job JOB-F004',
          ).toHaveCount(0);

          // Direct Invite button present for private/unawarded draft job (JOB-F001)
          await expect(
            page.locator(
              '[data-testid="jobs-desktop-table"] [aria-label="Invite carrier for job JOB-F001"]',
            ),
            'desktop: Invite button for JOB-F001',
          ).toBeVisible();

          // No Invite button for public draft job (JOB-F005 — public visibility)
          await expect(
            page.locator(
              '[data-testid="jobs-desktop-table"] [aria-label="Invite carrier for job JOB-F005"]',
            ),
            'desktop: no Invite for public job JOB-F005',
          ).toHaveCount(0);

          // Expand toggle: click for JOB-F001, verify detail area with client email
          const expandBtn = page.locator(
            '[aria-label="Expand details for job JOB-F001"]',
          ).first();
          await expandBtn.click();
          await expect(
            page.getByText('ops@acmefreight.co.uk'),
            'desktop: expand shows client email',
          ).toBeVisible();
          // Collapse
          await page.locator('[aria-label="Collapse details for job JOB-F001"]').first().click();

        } else {
          // ── Tablet-only ───────────────────────────────────────────────────

          // Sidebar: collapsed icon-only (56px)
          const sidebar = page.locator('aside[aria-label$="navigation"]');
          await expect(sidebar).toBeVisible();
          const sidebarWidth = await sidebar.evaluate((el) =>
            Math.round(el.getBoundingClientRect().width),
          );
          expect(sidebarWidth, 'tablet: sidebar width').toBeGreaterThanOrEqual(54);
          expect(sidebarWidth, 'tablet: sidebar width').toBeLessThanOrEqual(58);

          // Customer column hidden (display: none at ≤768px)
          const customerHeaderDisplay = await page.evaluate(() => {
            const ths = Array.from(document.querySelectorAll('th'));
            const th = ths.find((el) => el.textContent?.trim() === 'Customer');
            return th ? window.getComputedStyle(th).display : 'not-found';
          });
          expect(customerHeaderDisplay, 'tablet: Customer column hidden').toBe('none');

          // Distance column hidden
          const distHeaderDisplay = await page.evaluate(() => {
            const ths = Array.from(document.querySelectorAll('th'));
            const th = ths.find((el) => el.textContent?.trim() === 'Dist.');
            return th ? window.getComputedStyle(th).display : 'not-found';
          });
          expect(distHeaderDisplay, 'tablet: Distance column hidden').toBe('none');

          // Required columns remain visible
          for (const colName of ['Status', 'Ref', 'Route', 'Pickup', 'Delivery', 'Vehicle']) {
            const display = await page.evaluate((name) => {
              const ths = Array.from(document.querySelectorAll('th'));
              const th = ths.find((el) => el.textContent?.trim() === name);
              return th ? window.getComputedStyle(th).display : 'not-found';
            }, colName);
            expect(display, `tablet: '${colName}' column visible`).not.toBe('none');
            expect(display, `tablet: '${colName}' column not not-found`).not.toBe('not-found');
          }

          // KPI strip contained (no overflow at tablet width)
          const kpiStripOverflow = await page.evaluate(() => {
            const strip = document.querySelector('[aria-label="Operational key performance indicators"]');
            return strip
              ? strip.scrollWidth > strip.clientWidth + 1
              : false;
          });
          expect(kpiStripOverflow, 'tablet: KPI strip no overflow').toBe(false);

          // Toolbar wraps and does not cause page overflow
          const toolbarOverflow = await page.evaluate(() => {
            const toolbar = document.querySelector('[role="search"][aria-label="Filter jobs"]');
            if (!toolbar) return false;
            const parentRect = toolbar.parentElement?.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            return toolbarRect.right > (parentRect?.right ?? toolbarRect.right) + 2;
          });
          expect(toolbarOverflow, 'tablet: toolbar does not overflow parent').toBe(false);
        }

      } else {
        // ── Mobile ─────────────────────────────────────────────────────────

        // Mobile hamburger visible
        await expect(
          page.getByRole('button', { name: 'Open menu' }),
          'mobile: hamburger button',
        ).toBeVisible();

        // Desktop table section hidden (CSS display: none at ≤480px)
        const tableDisplay = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="jobs-desktop-table"]');
          return el ? window.getComputedStyle(el).display : 'not-found';
        });
        expect(tableDisplay, 'mobile: desktop table hidden').toBe('none');

        // Mobile card list is visible (display: flex at ≤480px)
        const cardListDisplay = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="jobs-mobile-cards"]');
          return el ? window.getComputedStyle(el).display : 'not-found';
        });
        expect(cardListDisplay, 'mobile: card list display').toBe('flex');

        // Cards are rendered
        const cards = page.locator('[data-testid="jobs-mobile-card"]');
        const cardCount = await cards.count();
        expect(cardCount, 'mobile: at least 10 cards (perPage=10)').toBeGreaterThanOrEqual(10);

        // First card (JOB-F001) has required structural elements
        const firstCard = cards.first();
        await expect(firstCard, 'mobile: first card visible').toBeVisible();

        // Expand toggle in first card
        await expect(
          firstCard.getByRole('button', { name: /expand details for job JOB-F001/i }),
          'mobile: expand toggle in first card',
        ).toBeVisible();

        // View action in first card
        await expect(
          firstCard.getByRole('button', { name: /view job JOB-F001/i }),
          'mobile: View action in first card',
        ).toBeVisible();

        // Post action visible for draft job JOB-F001
        await expect(
          firstCard.getByRole('button', { name: /post job JOB-F001 to marketplace/i }),
          'mobile: Post action for draft job JOB-F001',
        ).toBeVisible();

        // Invite action visible for private/unawarded job JOB-F001
        await expect(
          firstCard.getByRole('button', { name: /invite carrier for job JOB-F001/i }),
          'mobile: Invite action for JOB-F001',
        ).toBeVisible();

        // Status badge present in first card
        await expect(
          firstCard.locator('[aria-label^="Status:"]').first(),
          'mobile: status badge in first card',
        ).toBeVisible();

        // Route block: pickup + delivery locations
        await expect(
          firstCard.getByText('Birmingham'),
          'mobile: pickup location in first card',
        ).toBeVisible();
        await expect(
          firstCard.getByText('Manchester'),
          'mobile: delivery location in first card',
        ).toBeVisible();

        // Driver label present
        await expect(
          firstCard.locator('[class*="jobsMobileCardLabel"]', { hasText: 'Driver' }),
          'mobile: Driver label in first card',
        ).toBeVisible();

        // Expand first card → detail fields appear
        await firstCard
          .getByRole('button', { name: /expand details for job JOB-F001/i })
          .click();
        await expect(
          firstCard.getByText('ops@acmefreight.co.uk'),
          'mobile: expand shows client email',
        ).toBeVisible();
        await expect(
          firstCard.getByText(/30 days/),
          'mobile: expand shows payment terms',
        ).toBeVisible();
      }

      // Screenshot artifact for each viewport
      await page.screenshot({
        path: testInfo.outputPath(`jobs-fixture-${vp.label}.png`),
        fullPage: true,
      });
    }

    // ── Final signal hygiene ────────────────────────────────────────────────
    const nonHydrationErrors = consoleErrors.filter(
      (e) =>
        !e.includes("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."),
    );
    const cspErrors = nonHydrationErrors.filter((e) =>
      /content security policy|csp/i.test(e),
    );
    expect(cspErrors, 'no CSP errors').toEqual([]);
    expect(nonHydrationErrors, 'no console errors').toEqual([]);
    expect(failedRequests, 'no failed requests').toEqual([]);
    expect(failingResponses, 'no HTTP errors').toEqual([]);
  });
});
