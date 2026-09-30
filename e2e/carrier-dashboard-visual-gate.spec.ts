import { expect, test } from '@playwright/test';

const viewports = [
  { label: '1920', width: 1920, height: 1080 },
  { label: '1440', width: 1440, height: 900 },
  { label: '1280', width: 1280, height: 800 },
  { label: '1024', width: 1024, height: 900 },
  { label: '768', width: 768, height: 1024 },
  { label: '390', width: 390, height: 844 },
] as const;

test.describe('Carrier dashboard blueprint visual gate', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Requires deterministic visual fixture mode.');

  test.beforeEach(async ({ page }) => {
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
  });
  for (const viewport of viewports) {
    test(`Carrier Control Desk exact geometry at ${viewport.label}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/carrier-dashboard', { waitUntil: 'domcontentloaded' });

      const pageRoot = page.getByTestId('carrier-dashboard-fixture');
      const shellHeader = page.locator('.top-workspace-shell__header');
      const shellNav = page.locator('.top-workspace-nav--primary');
      const header = page.getByTestId('carrier-page-header');
      const toolbar = pageRoot.locator(':scope > div').first();
      const signals = page.getByTestId('carrier-signal-strip');
      const filterRail = page.locator('[aria-label="Search and filters"]');
      const workboardHeader = page.getByTestId('carrier-workboard-header');
      const tabs = page.getByTestId('carrier-tabs');
      const footer = page.getByTestId('carrier-workboard-footer');
      const lowerGrid = page.getByTestId('carrier-lower-grid');

      await expect(pageRoot).toBeVisible();
      await expect(signals.locator('button')).toHaveCount(6);

      if (viewport.width >= 769) {
        expect(Math.round(await shellHeader.evaluate((el) => el.getBoundingClientRect().height))).toBe(50);
        expect(Math.round(await shellNav.evaluate((el) => el.getBoundingClientRect().height))).toBe(40);
      }

      const toolbarHeight = Math.round(await toolbar.evaluate((el) => el.getBoundingClientRect().height));
      if (viewport.width >= 1025) {
        expect(toolbarHeight).toBe(40);
      } else {
        expect(toolbarHeight).toBeGreaterThanOrEqual(40);
      }

      const lowerColumns = await lowerGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
      if (viewport.width >= 1025) {
        expect(lowerColumns).toBe(2);
      } else {
        expect(lowerColumns).toBe(1);
      }

      const bodyOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(bodyOverflow).toBeLessThanOrEqual(0);

      if (viewport.width >= 1024) {
        const workboardTable = page.getByTestId('carrier-workboard').locator('table').first();
        const workboardOverflow = await workboardTable.evaluate((table) => {
          const scroll = table.parentElement;
          return scroll ? scroll.scrollWidth - scroll.clientWidth : 0;
        });
        expect(workboardOverflow).toBeLessThanOrEqual(0);

        const activityHeading = page.getByRole('heading', { name: 'Activity at a glance' });
        const activityTable = activityHeading.locator('xpath=ancestor::section[1]').locator('table').first();
        const activityOverflow = await activityTable.evaluate((table) => {
          const scroll = table.parentElement;
          return scroll ? scroll.scrollWidth - scroll.clientWidth : 0;
        });
        expect(activityOverflow).toBeLessThanOrEqual(0);
      }

      if (viewport.width >= 1025) {
        expect(Math.round(await header.evaluate((el) => el.getBoundingClientRect().height))).toBe(78);
        expect(Math.round(await filterRail.evaluate((el) => el.getBoundingClientRect().width))).toBe(220);
        const filterBox = await filterRail.boundingBox();
        const workboardBox = await page.getByTestId('carrier-workboard').boundingBox();
        expect(filterBox).not.toBeNull();
        expect(workboardBox).not.toBeNull();
        expect(Math.abs(Math.round((filterBox?.y ?? 0) - (workboardBox?.y ?? 0)))).toBeLessThanOrEqual(1);
      } else {
        const filterBox = await filterRail.boundingBox();
        const workboardBox = await page.getByTestId('carrier-workboard').boundingBox();
        expect(filterBox).not.toBeNull();
        expect(workboardBox).not.toBeNull();
        expect(Math.round((workboardBox?.y ?? 0) - ((filterBox?.y ?? 0) + (filterBox?.height ?? 0)))).toBe(12);
      }

      for (const signal of await signals.locator('button').all()) {
        expect(Math.round(await signal.evaluate((el) => el.getBoundingClientRect().height))).toBe(56);
      }
      const workboardHeaderHeight = Math.round(await workboardHeader.evaluate((el) => el.getBoundingClientRect().height));
      if (viewport.width > 768) {
        expect(workboardHeaderHeight).toBe(44);
      } else {
        expect(workboardHeaderHeight).toBeGreaterThanOrEqual(44);
      }
      expect(Math.round(await tabs.evaluate((el) => el.getBoundingClientRect().height))).toBe(32);

      if (viewport.width > 768) {
        expect(Math.round(await footer.evaluate((el) => el.getBoundingClientRect().height))).toBe(32);
      } else {
        expect(Math.round(await footer.evaluate((el) => el.getBoundingClientRect().height))).toBeGreaterThanOrEqual(32);
      }

      const panelHeaders = page.locator('section').filter({ has: page.locator('h3') }).locator('header');
      const panelHeaderCount = await panelHeaders.count();
      expect(panelHeaderCount).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < panelHeaderCount; i += 1) {
        expect(Math.round(await panelHeaders.nth(i).evaluate((el) => el.getBoundingClientRect().height))).toBe(44);
      }

      if (viewport.width >= 1025) {
        const th = page.locator('th').first();
        const td = page.locator('tbody td').first();
        await expect(th).toBeVisible();
        await expect(td).toBeVisible();
        expect(Math.round(await th.evaluate((el) => el.getBoundingClientRect().height))).toBe(36);
        expect(Math.round(await td.evaluate((el) => el.getBoundingClientRect().height))).toBe(44);
      }

      await page.screenshot({
        path: testInfo.outputPath(`carrier-dashboard-${viewport.label}.png`),
        fullPage: true,
      });
    });
  }
});
