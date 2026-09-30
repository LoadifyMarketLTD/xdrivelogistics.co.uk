import { expect, test } from '@playwright/test';
import { mockLiveAvailability } from './helpers/liveAvailabilityFixtures';

test.use({ serviceWorkers: 'block' });
test.describe('Carrier Live Availability - production component fixture', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Local fixtures only.');
  test.beforeEach(async ({ page }) => { await mockLiveAvailability(page); });
  for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
    test(`layout, signal truth and register at ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/visual-fixture/workspace-recovery/carrier?screen=live-availability');
      await expect(page.getByRole('heading', { name: 'Live Availability', exact: true })).toBeVisible();
      await expect(page.getByText('Fixture Available Driver', { exact: true })).toBeVisible();
      const signals = page.getByRole('region', { name: 'Fleet availability signals' });
      await expect(signals.locator(':scope > *')).toHaveCount(6);
      await expect(signals.getByRole('group', { name: 'Available', exact: true })).toContainText('1');
      await expect(signals.getByRole('group', { name: 'Busy', exact: true })).toContainText('1');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      const split = page.getByTestId('carrier-map-register-split');
      expect(await split.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width >= 1200 ? 2 : 1);
      expect(Math.round(await page.getByTestId('carrier-map-body').evaluate((el) => el.getBoundingClientRect().height))).toBe(280);
      expect(Math.round(await page.getByTestId('carrier-register-body').evaluate((el) => el.getBoundingClientRect().height))).toBe(280);
      await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: info.outputPath(`carrier-live-${width}.png`), fullPage: true });
    });
  }
  test('future tab and return-journey destination are connected', async ({ page }, info) => {
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=live-availability');
    await page.getByRole('tab', { name: 'Future', exact: true }).click();
    await expect(page.getByTestId('carrier-register-body')).toContainText('Manchester M1');
    await page.screenshot({ path: info.outputPath('carrier-future.png'), fullPage: true });
    await page.getByTestId('carrier-live-availability').getByRole('button', { name: 'Return Journeys', exact: true }).click();
    await expect(page.getByTestId('navigation-target')).toHaveText('/admin/fleet/returns');
  });
  test('nearby preserves privacy, missing capacity and member-scoped booking', async ({ page }, info) => {
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=live-availability');
    await page.getByRole('tab', { name: 'Nearby Exchange', exact: true }).click();
    const register = page.getByTestId('carrier-register-body');
    await expect(page.getByRole('heading', { name: "Who's nearby", exact: true })).toBeVisible();
    await expect(register).toContainText('Fixture Exchange Member');
    await expect(register).toContainText('Capacity not published');
    await expect(register).not.toContainText('0 kg');
    await expect(register).toContainText('driver identity is not disclosed');
    await page.screenshot({ path: info.outputPath('carrier-nearby.png'), fullPage: true });
    await register.getByRole('button', { name: 'Book Direct', exact: true }).click();
    await expect(page.getByTestId('navigation-target')).toHaveText('/admin/post-load?directCarrier=33333333-3333-4333-8333-333333333333');
  });
  test('saved filter defaults are local and restore the chosen availability', async ({ page }) => {
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=live-availability');
    await expect(page.getByText('Fixture Busy Driver', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Availability', exact: true }).selectOption('busy');
    await page.getByRole('button', { name: 'Save Default', exact: true }).click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByText('Fixture Available Driver', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Load Default', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Availability', exact: true })).toHaveValue('busy');
    await expect(page.getByText('Fixture Available Driver', { exact: true })).toHaveCount(0);
  });

  test('unavailable fleet data never becomes a zero availability count', async ({ page }) => {
    await page.route('**/rest/v1/drivers?**', (route) => route.fulfill({ status: 503, json: { message: 'Fixture driver data unavailable', code: 'FIXTURE_ONLY' } }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=live-availability');
    await expect(page.getByText('Some workspace data is unavailable:', { exact: false }).first()).toBeVisible();
    const signal = page.getByRole('region', { name: 'Fleet availability signals' }).getByRole('group', { name: 'Available', exact: true });
    await expect(signal.locator('strong')).toHaveText('\u2014');
  });

  test('basemap tiles load in the browser', async ({ page }, info) => {
    const failures: string[] = [];
    page.on('requestfailed', (request) => { if (request.url().includes('tile.openstreetmap.org')) failures.push(request.url() + ': ' + request.failure()?.errorText); });
    page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=live-availability');
    try { await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 15000 }); }
    finally { await info.attach('map-network-diagnostics', { body: JSON.stringify(failures, null, 2), contentType: 'application/json' }); }
  });
});
