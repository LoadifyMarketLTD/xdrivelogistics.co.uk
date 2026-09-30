import { expect, test } from '@playwright/test';
import { COMPANY, mockWorkspace } from './helpers/workspaceRecoveryFixtures';

test.use({ serviceWorkers: 'block' });
const job = { id: '99999999-9999-4999-8999-999999999999', company_id: '33333333-3333-4333-8333-333333333333', awarded_carrier_company_id: COMPANY, status: 'awarded', current_status: 'awarded', assigned_driver_id: null, pickup_location: 'Fixture Blackburn', delivery_location: 'Fixture Manchester', pickup_datetime: '2026-10-03T09:00:00Z', delivery_datetime: '2026-10-03T11:00:00Z', vehicle_type: 'Luton', delivery_photos: [], created_at: '2026-09-30T09:00:00Z', updated_at: '2026-09-30T09:00:00Z' };

test.describe('Carrier Dashboard real component recovery', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Local isolated fixtures only.');
  for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
    test(`CX panels, real actions and no overflow at ${width}`, async ({ page }, info) => {
      await mockWorkspace(page, 'carrier', false, false, { jobs: [job] });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/visual-fixture/workspace-recovery/carrier?screen=dashboard');
      await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY);
      await expect(page.getByRole('heading', { name: 'Carrier Dashboard', level: 1 })).toHaveCount(1);
      const headingBox = await page.getByRole('heading', { name: 'Carrier Dashboard', level: 1 }).boundingBox();
      expect(headingBox?.width).toBe(1);
      expect(headingBox?.height).toBe(1);
      const activity = page.getByRole('region', { name: 'Activity at a glance' });
      await expect(activity).toContainText('Fixture Blackburn');
      for (const title of ['Reports & Statistics', 'Accounts Payable', 'Reports', 'Feedback in Last 90 Days', 'Compliance - Drivers & Vehicles']) {
        await expect(page.getByRole('region', { name: title, exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      await page.screenshot({ path: info.outputPath(`carrier-dashboard-${width}.png`), fullPage: true });
      await activity.getByRole('button', { name: 'Allocate', exact: true }).click();
      await expect(page.getByTestId('navigation-target')).toHaveText(`/admin/fleet/assignments?job=${job.id}`);
    });
  }
  test('failed reads never look like a clean empty queue or settled finances', async ({ page }, info) => {
    await mockWorkspace(page, 'carrier');
    await page.route('**/rest/v1/jobs?**', (route) => route.fulfill({ status: 503, json: { message: 'Fixture jobs unavailable' } }));
    await page.route('**/rest/v1/invoices?**', (route) => route.fulfill({ status: 503, json: { message: 'Fixture invoices unavailable' } }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=dashboard');
    const activity = page.getByRole('region', { name: 'Activity at a glance' });
    await expect(activity).toContainText('Job data unavailable');
    await expect(activity).not.toContainText('No recent carrier bookings');
    const payable = page.getByRole('region', { name: 'Accounts Payable', exact: true });
    await expect(payable).not.toContainText('0 awaiting payment');
    await expect(payable).not.toContainText('0 overdue');
    await page.screenshot({ path: info.outputPath('carrier-dashboard-unavailable.png'), fullPage: true });
  });
  test('canonical navbar order and contextual financial navigation remain intact', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=dashboard');
    await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY);
    const nav = page.getByRole('navigation', { name: 'Company Owner navigation' });
    const labels = (await nav.getByRole('button').allTextContents()).map((label) => label.replace(/\s+/g, ' ').trim());
    expect(labels.slice(0, 11)).toEqual(['Dashboard', 'Directory', 'Live Availability', 'My Fleet', 'Return Journeys', 'Loads', 'Quotes', 'Diary', 'Freight Vision', 'Drivers & Vehicles', 'Settings']);
    await page.getByRole('region', { name: 'Reports', exact: true }).getByRole('button', { name: 'Invoice reporting', exact: true }).click();
    await expect(page.getByTestId('navigation-target')).toHaveText('/admin/invoices');
  });
});
