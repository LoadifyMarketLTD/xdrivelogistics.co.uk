import { expect, test } from '@playwright/test';
import { COMPANY, mockWorkspace } from './helpers/workspaceRecoveryFixtures';
import { mockDirectory } from './helpers/directoryFixtures';

test.use({ serviceWorkers: 'block' });
const widths = [1920, 1440, 1280, 1024, 768, 390] as const;

test.describe('Carrier Directory production-component visual and interaction gate', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Requires isolated visual fixtures.');
  test.beforeEach(async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    await mockDirectory(page);
  });
  for (const width of widths) {
    test(`Directory geometry and real records at ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/visual-fixture/carrier-directory');
      await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY);
      const root = page.locator('[data-carrier-directory="true"]');
      const records = root.locator('.directory-operational-row');
      await expect(records).toHaveCount(2);
      await expect(page.getByRole('heading', { level: 1, name: 'Directory' })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      const columns = await records.first().locator('.directory-operational-row__top').evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
      const rail = page.getByRole('complementary', { name: 'Directory filters' });
      if (width >= 1280) {
        expect(columns).toBe(4);
        expect(Math.round(await rail.evaluate((el) => el.getBoundingClientRect().width))).toBe(220);
        expect(Math.round(await root.locator('.directory-register-header').evaluate((el) => el.getBoundingClientRect().height))).toBe(78);
        expect(Math.round(await records.first().evaluate((el) => el.getBoundingClientRect().height))).toBe(92);
        expect(Math.round(await records.first().locator('.directory-record-footer').evaluate((el) => el.getBoundingClientRect().height))).toBe(32);
      } else expect(columns).toBe(width <= 768 ? 1 : 2);
      if (width >= 1280) {
        const maxOverflow = await records.first().evaluate((record) => {
          const primary = record.querySelector('.directory-operational-row__top')!.getBoundingClientRect();
          return Math.max(...Array.from(record.querySelectorAll('.driver-cell-secondary')).map((cell) => cell.getBoundingClientRect().bottom - primary.bottom));
        });
        expect(maxOverflow).toBeLessThanOrEqual(0);
      }
      await expect(records.first()).toContainText('Not enough evidence');
      await page.screenshot({ path: info.outputPath(`carrier-directory-${width}.png`), fullPage: true });
      await page.getByRole('tab', { name: /Drivers/ }).click();
      await expect(page.getByRole('tab', { name: /Drivers/ })).toHaveAttribute('aria-selected', 'true');
      await expect(records.first()).toContainText('Fixture Driver 1');
      await page.screenshot({ path: info.outputPath(`carrier-directory-drivers-${width}.png`), fullPage: true });
    });
  }
  test('filters, details, clear and message destination work', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visual-fixture/carrier-directory');
    await expect(page.locator('.directory-operational-row')).toHaveCount(2);
    await page.getByLabel('MEMBER / XDRIVE ID', { exact: true }).fill('North');
    await expect(page.locator('.directory-operational-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Less detail' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('.directory-operational-row')).toHaveCount(2);
    await page.locator('.directory-record-footer').first().getByRole('button', { name: 'Messages', exact: true }).click();
    await expect(page.getByTestId('navigation-target')).toHaveText('/admin/messages?companyId=44444444-4444-4444-8444-000000000001');
  });
  test('direct booking preserves the selected company and stays in Carrier', async ({ page }) => {
    await page.goto('/visual-fixture/carrier-directory');
    await expect(page.locator('.directory-operational-row')).toHaveCount(2);
    await page.locator('.directory-record-footer').first().getByRole('button', { name: 'Book Direct', exact: true }).click();
    await expect(page.getByTestId('navigation-target')).toHaveText('/admin/post-load?directCarrier=44444444-4444-4444-8444-000000000001');
  });
  test('nearest search sends the selected origin and radius to the real endpoint contract', async ({ page }) => {
    await page.goto('/visual-fixture/carrier-directory');
    await expect(page.locator('.directory-operational-row')).toHaveCount(2);
    await page.getByLabel('FIND MY NEAREST', { exact: true }).fill('BB1');
    await page.getByRole('combobox', { name: 'Directory search radius', exact: true }).selectOption('100');
    const request = page.waitForRequest((req) => req.url().includes('/api/directory?near=BB1&radiusMiles=100'));
    await page.getByRole('button', { name: 'Find My Nearest', exact: true }).click();
    await request;
  });
  test('local pagination renders further loaded records without claiming network completeness', async ({ page }) => {
    await mockDirectory(page, 26);
    await page.goto('/visual-fixture/carrier-directory');
    await expect(page.locator('.directory-operational-row')).toHaveCount(25);
    await page.locator('.directory-pagination').getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.directory-operational-row')).toHaveCount(26);
    await expect(page.locator('.directory-pagination')).toContainText('1-26 of 26');
  });
});
