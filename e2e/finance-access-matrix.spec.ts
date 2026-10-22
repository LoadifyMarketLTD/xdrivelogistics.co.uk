import { expect, test } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

type Case = {
  name: string;
  emailKey: string;
  passwordKey: string;
  fallbackEmailKey?: string;
  fallbackPasswordKey?: string;
  route: string;
  apiPath?: string;
  expectedStatus?: number;
  blockedPath?: string;
};

const cases: Case[] = [
  { name: 'carrier-admin', emailKey: 'E2E_CARRIER_ADMIN_EMAIL', passwordKey: 'E2E_CARRIER_ADMIN_PASSWORD', fallbackEmailKey: 'E2E_ADMIN_EMAIL', fallbackPasswordKey: 'E2E_ADMIN_PASSWORD', route: '/admin/finance', apiPath: '/api/workspace/finance/control', expectedStatus: 200 },
  { name: 'fleet-manager', emailKey: 'E2E_FLEET_MANAGER_EMAIL', passwordKey: 'E2E_FLEET_MANAGER_PASSWORD', route: '/admin/finance', apiPath: '/api/workspace/finance/control', expectedStatus: 200 },
  { name: 'dispatcher', emailKey: 'E2E_DISPATCHER_EMAIL', passwordKey: 'E2E_DISPATCHER_PASSWORD', route: '/admin/finance', blockedPath: '/admin' },
  { name: 'broker', emailKey: 'E2E_BROKER_EMAIL', passwordKey: 'E2E_BROKER_PASSWORD', route: '/broker/finance', apiPath: '/api/workspace/finance/control', expectedStatus: 200 },
  { name: 'customer', emailKey: 'E2E_CUSTOMER_EMAIL', passwordKey: 'E2E_CUSTOMER_PASSWORD', route: '/customer/invoices', apiPath: '/api/workspace/finance/control', expectedStatus: 200 },
  { name: 'owner-driver', emailKey: 'E2E_OWNER_DRIVER_EMAIL', passwordKey: 'E2E_OWNER_DRIVER_PASSWORD', fallbackEmailKey: 'E2E_LIFECYCLE_OWNER_DRIVER_EMAIL', fallbackPasswordKey: 'E2E_LIFECYCLE_OWNER_DRIVER_PASSWORD', route: '/driver/finance', apiPath: '/api/driver/finance/invoices', expectedStatus: 200 },
  { name: 'company-driver', emailKey: 'E2E_COMPANY_DRIVER_EMAIL', passwordKey: 'E2E_COMPANY_DRIVER_PASSWORD', fallbackEmailKey: 'E2E_LIFECYCLE_DRIVER_EMAIL', fallbackPasswordKey: 'E2E_LIFECYCLE_DRIVER_PASSWORD', route: '/driver/finance', blockedPath: '/driver' },
];

for (const item of cases) {
  test(item.name + ' finance access matrix', async ({ page }) => {
    test.setTimeout(120_000);
    const email = process.env[item.emailKey] ?? (item.fallbackEmailKey ? process.env[item.fallbackEmailKey] : '') ?? '';
    const password = process.env[item.passwordKey] ?? (item.fallbackPasswordKey ? process.env[item.fallbackPasswordKey] : '') ?? '';
    test.skip(!email || !password, 'Missing E2E credentials for ' + item.name);

    await loginWithCredentials(page, email.trim(), password.trim());

    if (item.blockedPath) {
      await page.goto(item.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page).toHaveURL(new RegExp(item.blockedPath.replaceAll('/', '\\/') + '(?:\\?|$)'), { timeout: 30_000 });
      return;
    }

    if (!item.apiPath || item.expectedStatus == null) throw new Error('Finance matrix case is missing its API contract.');
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === item.apiPath && response.request().method() === 'GET',
      { timeout: 45_000 },
    );

    await page.goto(item.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const response = await responsePromise;
    expect(response.status(), item.name + ' ' + item.apiPath).toBe(item.expectedStatus);

    if (item.expectedStatus === 200) {
      await expect(page.locator('body')).not.toContainText(/finance access is not available|owner-driver or company-admin finance access is required/i);
    } else {
      await expect(page.locator('body')).toContainText(/finance access is not available|owner-driver or company-admin finance access is required/i);
    }
  });
}
