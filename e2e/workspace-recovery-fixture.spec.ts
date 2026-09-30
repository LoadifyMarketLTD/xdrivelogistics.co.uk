import { expect, test, type Page } from '@playwright/test';

// Service workers must not bypass this fixture's network interception.
test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });

import { COMPANY, roots, mockWorkspace } from './helpers/workspaceRecoveryFixtures';

test.describe('Workspace recovery - real components with isolated mocked services', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Requires local-only fixtures.');
  for (const role of ['carrier', 'customer', 'broker', 'owner'] as const) {
    test(`${role}: settings separates finance preferences, invoices and billing`, async ({ page }, info) => {
      await mockWorkspace(page, role);
      await page.goto(`/visual-fixture/workspace-recovery/${role}`);
      await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY, { timeout: 15000 });
      await page.screenshot({ path: info.outputPath(`${role}-settings.png`), fullPage: true });
      await page.getByRole('button', { name: 'Company Finance Settings', exact: true }).first().click();
      await expect(page.getByRole('tablist', { name: 'Finance settings' })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${role}-finance-settings.png`), fullPage: true });
      if (role === 'owner') await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Finance & Invoices', exact: true }).first().click();
      const finance = role === 'carrier' ? '/admin/invoices' : role === 'customer' ? '/customer/invoices' : `${roots[role]}/finance`;
      await expect(page.getByTestId('navigation-target')).toHaveText(finance);
      await page.goto(`/visual-fixture/workspace-recovery/${role}`);
      await page.getByRole('button', { name: 'Membership & Billing', exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'XDrive membership billing' })).toBeVisible();
      await expect(page.getByLabel('Billing company')).toHaveValue(COMPANY);
      await expect(page.getByLabel('Billing company')).toBeDisabled();
      await page.screenshot({ path: info.outputPath(`${role}-billing.png`), fullPage: true });
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.getByTestId('navigation-target')).toHaveText(`${roots[role]}/settings`);
    });
  }
  for (const role of ['carrier', 'customer', 'broker', 'owner'] as const) {
    for (const width of [1440, 390]) {
      test(`${role}: support stays in workspace at ${width}`, async ({ page }, info) => {
        await mockWorkspace(page, role);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/visual-fixture/workspace-recovery/${role}?screen=support`);
        await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible();
        await page.getByText('Finance settings, invoices or membership billing?', { exact: true }).click();
        await expect(page.getByText('Company Finance Settings contains', { exact: false })).toBeVisible();
        await expect(page.locator('a[href="/help"], a[href="/contact"]')).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'contact@xdrivelogistics.co.uk' })).toHaveAttribute('href', 'mailto:contact@xdrivelogistics.co.uk');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        await page.screenshot({ path: info.outputPath(`${role}-support-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Back to Settings' }).click();
        await expect(page.getByTestId('navigation-target')).toHaveText(`${roots[role]}/settings`);
      });
    }
  }
  test('billing failure exposes no checkout and never selects a different company', async ({ page }) => {
    await mockWorkspace(page, 'carrier', true);
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=billing');
    await expect(page.getByRole('heading', { name: 'Billing account unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start 3-month/ })).toHaveCount(0);
  });
  test('company driver cannot manage company finance or membership', async ({ page }) => {
    await mockWorkspace(page, 'driver');
    await page.goto('/visual-fixture/workspace-recovery/driver');
    await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY);
    await expect(page.getByRole('button', { name: 'Company Finance Settings', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Membership & Billing', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Finance & Invoices', exact: true })).toHaveCount(0);
  });
  async function completeLoad(page: Page) {
    const date = new Date(); date.setDate(date.getDate() + 2);
    await page.locator('input[type="date"]').first().fill(date.toISOString().slice(0, 10));
    await page.getByRole('combobox', { name: 'Collection time', exact: true }).selectOption('10:00');
    await page.getByPlaceholder('e.g. BB1 1AA').nth(0).fill('BB1 1AA');
    await page.getByPlaceholder('e.g. BB1 1AA').nth(1).fill('M1 1AA');
    await page.locator('textarea').nth(0).fill('Fixture collection address, Blackburn');
    await page.locator('textarea').nth(1).fill('Fixture delivery address, Manchester');
  }
  for (const role of ['carrier', 'customer', 'broker', 'owner'] as const) {
    test(`${role}: legal 409 offers the correct remediation action`, async ({ page }, info) => {
      await mockWorkspace(page, role);
      await page.goto(`/visual-fixture/workspace-recovery/${role}?screen=post-load`);
      await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY);
      await completeLoad(page);
      await page.getByRole('button', { name: 'Publish Load', exact: true }).click();
      const action = page.getByRole('button', { name: 'Review & accept legal agreements', exact: true });
      await expect(action).toBeVisible();
      await expect(page.locator('textarea').first()).toHaveValue('Fixture collection address, Blackburn');
      await page.screenshot({ path: info.outputPath(`${role}-legal-remediation.png`), fullPage: true });
      await action.click();
      await expect(page.getByTestId('navigation-target')).toHaveText(role === 'carrier' ? '/admin/settings/legal-agreements' : `${roots[role]}/account/legal-agreements`);
    });
  }

  test('counterparty legal restriction never offers self-acceptance', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    await page.route('**/api/jobs/create', (route) => route.fulfill({ status: 409, json: { code: 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED', error: 'Carrier must complete legal agreements.' } }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=post-load');
    await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY);
    await completeLoad(page);
    await page.getByRole('button', { name: 'Publish Load', exact: true }).click();
    await expect(page.getByText('Carrier must complete legal agreements.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review & accept legal agreements', exact: true })).toHaveCount(0);
  });
  test('legacy Stripe return restores workspace and preserves return parameters', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=legacy-billing&subscription=success&session_id=fixture');
    await expect(page.getByTestId('navigation-target')).toContainText('/admin/settings/billing?');
    await expect(page.getByTestId('navigation-target')).toContainText('subscription=success');
    await expect(page.getByLabel('Billing company')).toHaveValue(COMPANY);
  });
  test('billing fits mobile without page overflow', async ({ page }, info) => {
    await mockWorkspace(page, 'carrier');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=billing');
    await expect(page.getByLabel('Billing company')).toHaveValue(COMPANY);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: info.outputPath('carrier-billing-390.png'), fullPage: true });
  });

  test('personal customer billing survives workspace scoping without an unrelated company', async ({ page }) => {
    await mockWorkspace(page, 'customer', false, true);
    const accountRequest = page.waitForRequest((req) => new URL(req.url()).pathname === '/api/billing/status');
    await page.goto('/visual-fixture/workspace-recovery/customer?screen=billing');
    expect(new URL((await accountRequest).url()).searchParams.has('companyId')).toBe(false);
    await expect(page.getByRole('heading', { name: 'Personal membership account' })).toBeVisible();
    await expect(page.getByLabel('Billing company')).toHaveCount(0);
  });
  test('a malformed successful billing response cannot expose checkout', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    await page.route('**/api/billing/status?**', (route) => route.fulfill({ json: {} }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=billing');
    await expect(page.getByRole('heading', { name: 'Billing account unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start 3-month/ })).toHaveCount(0);
  });
});
