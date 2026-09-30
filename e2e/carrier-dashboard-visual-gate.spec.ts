import { expect, test } from '@playwright/test';

const viewports = [
  { label: '1920', width: 1920, height: 1080 },
  { label: '1440', width: 1440, height: 900 },
  { label: '1280', width: 1280, height: 800 },
  { label: '1024', width: 1024, height: 900 },
  { label: '768', width: 768, height: 1024 },
  { label: '390', width: 390, height: 844 },
] as const;

test.describe('Carrier dashboard CX-reference visual gate', () => {
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
    test(`Carrier Dashboard CX geometry at ${viewport.label}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/carrier-dashboard', { waitUntil: 'domcontentloaded' });

      const pageRoot = page.getByTestId('carrier-dashboard-fixture');
      const shellHeader = page.locator('.top-workspace-shell__header');
      const shellNav = page.locator('.top-workspace-nav--primary');
      const grid = page.getByTestId('carrier-dashboard-grid');

      await expect(pageRoot).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Reports & Statistics' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Activity at a glance' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Accounts Payable' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Feedback in Last 90 Days' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Compliance - Drivers & Vehicles' })).toBeVisible();

      if (viewport.width >= 769) {
        expect(Math.round(await shellHeader.evaluate((el) => el.getBoundingClientRect().height))).toBe(50);
        expect(Math.round(await shellNav.evaluate((el) => el.getBoundingClientRect().height))).toBe(40);
      }

      const bodyOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(bodyOverflow).toBeLessThanOrEqual(0);

      const columns = await grid.evaluate((el) =>
        getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
      );
      if (viewport.width >= 1025) {
        expect(columns).toBe(2);
      } else {
        expect(columns).toBe(1);
      }

      const panelHeaders = page.locator('section').filter({ has: page.locator('h3') }).locator('header');
      const panelHeaderCount = await panelHeaders.count();
      expect(panelHeaderCount).toBe(6);
      for (let i = 0; i < panelHeaderCount; i += 1) {
        expect(Math.round(await panelHeaders.nth(i).evaluate((el) => el.getBoundingClientRect().height))).toBe(36);
      }

      const bookingCards = page.locator('article');
      await expect(bookingCards).toHaveCount(4);

      if (viewport.width >= 1025) {
        const box = await grid.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.width ?? 0).toBeGreaterThan(900);
      }

      await page.screenshot({
        path: testInfo.outputPath(`carrier-dashboard-${viewport.label}.png`),
        fullPage: true,
      });
    });
  }
});
