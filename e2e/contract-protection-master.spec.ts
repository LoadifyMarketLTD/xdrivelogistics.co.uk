import { expect, test, type Page } from '@playwright/test';

const credentials = {
  customer: { email: process.env.E2E_CUSTOMER_EMAIL ?? '', password: process.env.E2E_CUSTOMER_PASSWORD ?? '' },
  broker: { email: process.env.E2E_BROKER_EMAIL ?? '', password: process.env.E2E_BROKER_PASSWORD ?? '' },
  carrier: { email: process.env.E2E_CARRIER_EMAIL ?? '', password: process.env.E2E_CARRIER_PASSWORD ?? '' },
  ownerDriver: { email: process.env.E2E_DRIVER_EMAIL ?? '', password: process.env.E2E_DRIVER_PASSWORD ?? '' },
};

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

const blocked = (role: keyof typeof credentials) => {
  const value = credentials[role];
  return !value.email || !value.password;
};

test.describe('Contract Protection Master - authenticated browser preflight', () => {
  test('Customer contractual surfaces', async ({ page }) => {
    test.skip(blocked('customer'), 'BLOCKED: set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD.');
    await login(page, credentials.customer.email, credentials.customer.password);
    for (const path of ['/customer/post-load', '/customer/quotes', '/customer/diary', '/customer/disputes', '/customer/account/legal-agreements']) {
      const response = await page.goto(path);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    }
  });

  test('Broker contractual surfaces', async ({ page }) => {
    test.skip(blocked('broker'), 'BLOCKED: set E2E_BROKER_EMAIL and E2E_BROKER_PASSWORD.');
    await login(page, credentials.broker.email, credentials.broker.password);
    for (const path of ['/broker/post-load', '/broker/bids', '/broker/diary', '/broker/disputes', '/broker/account/legal-agreements']) {
      const response = await page.goto(path);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    }
  });

  test('Carrier/Fleet buyer contractual surfaces', async ({ page }) => {
    test.skip(blocked('carrier'), 'BLOCKED: set E2E_CARRIER_EMAIL and E2E_CARRIER_PASSWORD.');
    await login(page, credentials.carrier.email, credentials.carrier.password);
    for (const path of ['/admin/post-load', '/admin/bids', '/admin/diary', '/admin/disputes', '/admin/settings/legal-agreements']) {
      const response = await page.goto(path);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    }
  });

  test('Owner Driver carrier-acceptance and agreements surfaces', async ({ page }) => {
    test.skip(blocked('ownerDriver'), 'BLOCKED: set E2E_DRIVER_EMAIL and E2E_DRIVER_PASSWORD.');
    await login(page, credentials.ownerDriver.email, credentials.ownerDriver.password);
    for (const path of ['/driver/won-work', '/driver/account/legal-agreements']) {
      const response = await page.goto(path);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    }
  });
});

test.describe('Contract Protection Master - production mutation gate', () => {
  test('explicitly requires mutation opt-in for live browser lifecycle', async () => {
    test.skip(process.env.E2E_ALLOW_PRODUCTION_MUTATION !== 'true', 'BLOCKED: E2E_ALLOW_PRODUCTION_MUTATION=true is required before browser tests may create or mutate live transport records.');
    expect(process.env.E2E_ALLOW_PRODUCTION_MUTATION).toBe('true');
  });
});
