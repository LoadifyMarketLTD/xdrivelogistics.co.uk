import { expect, test } from '@playwright/test';

const viewports = [
  { label: '1440', width: 1440, height: 900 },
  { label: '1024', width: 1024, height: 900 },
  { label: '390', width: 390, height: 844 },
] as const;

test.describe('Carrier Directory CX-reference visual gate', () => {
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
    test(`Carrier Directory CX geometry at ${viewport.label}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/carrier-directory', { waitUntil: 'domcontentloaded' });

      const root = page.getByTestId('carrier-directory-fixture');
      const header = page.getByTestId('directory-header');
      const layout = page.getByTestId('directory-layout');
      const rail = page.getByRole('complementary', { name: 'Directory filters' });

      await expect(root).toBeVisible();
      expect(Math.round(await header.evaluate((el) => el.getBoundingClientRect().height))).toBe(36);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      const columns = await layout.evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
      if (viewport.width >= 1025) {
        expect(columns).toBe(2);
        expect(Math.round(await rail.evaluate((el) => el.getBoundingClientRect().width))).toBe(200);
        const firstRowColumns = await page.locator('.directory-operational-row__top').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
        expect(firstRowColumns).toBe(5);
      } else {
        expect(columns).toBe(1);
        expect(Math.round(await rail.evaluate((el) => el.getBoundingClientRect().width))).toBe(Math.round((await layout.boundingBox())?.width ?? 0));
      }

      await expect(page.locator('.directory-operational-row')).toHaveCount(2);
      await page.screenshot({
        path: testInfo.outputPath(`carrier-directory-${viewport.label}.png`),
        fullPage: true,
      });
    });
  }
});
