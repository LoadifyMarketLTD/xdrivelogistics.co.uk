import { expect, test, type Page } from '@playwright/test';

const isProductionTarget = /https:\/\/xdrivelogistics\.co\.uk\/?$/i.test(
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? ''
);
const allowProductionMutation = process.env.E2E_ALLOW_PRODUCTION_MUTATION === 'true';

const approvedTestEmails = new Set(
  (process.env.E2E_APPROVED_TEST_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const dedicatedAccount = (name: string) => {
  const email = (process.env[`${name}_EMAIL`] ?? '').trim().toLowerCase();
  const password = process.env[`${name}_PASSWORD`] ?? '';
  const hasE2EMarker = /(^|[+._-])e2e([+._-]|@)/i.test(email);
  const explicitlyApproved = approvedTestEmails.has(email);
  const approvedForTesting = hasE2EMarker || explicitlyApproved;

  return {
    email,
    password,
    approvedForTesting,
    ready: Boolean(email && password && approvedForTesting),
  };
};

const driver = dedicatedAccount('E2E_LIFECYCLE_DRIVER');
const ownerDriver = dedicatedAccount('E2E_LIFECYCLE_OWNER_DRIVER');
const carrierOwner = dedicatedAccount('E2E_LIFECYCLE_CARRIER_OWNER');

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('registration role contract (read-only)', () => {
  test('registration exposes an individual driver path', async ({ page }) => {
    await page.goto('/register');
    const accountType = page.locator('#register-role');
    await expect(accountType).toBeVisible();
    await expect(accountType.locator('option')).toContainText([
      /individual driver|driver only|courier driver/i,
    ]);
  });

  test('registration exposes owner-driver workspace choice', async ({ page }) => {
    await page.goto('/register');
    const accountType = page.locator('#register-role');
    await expect(accountType.locator('option')).toContainText([/owner operator/i]);
    await expect(
      page.getByText(/owner operators can choose whether they need their own operations workspace/i)
    ).toBeVisible();
  });

  test('public user cannot open protected dashboards', async ({ page }) => {
    for (const path of ['/admin', '/driver/jobs', '/customer', '/broker']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(`${path.replace('/', '\\/')}/?$`));
      await expect(page).toHaveURL(/\/(login|forbidden|pending-approval)(\?|$)/);
    }
  });
});

test.describe('production lifecycle evidence', () => {
  test.skip(!isProductionTarget, 'Set PLAYWRIGHT_BASE_URL=https://xdrivelogistics.co.uk for production evidence.');
  test.skip(!allowProductionMutation, 'Set E2E_ALLOW_PRODUCTION_MUTATION=true only for approved test accounts.');

  test('individual driver reaches only the driver workspace', async ({ page }) => {
    test.skip(!driver.ready, 'Approved driver test credentials are required.');
    await login(page, driver.email, driver.password);
    await expect(page).toHaveURL(/\/(driver|onboarding|pending-approval)(\/|\?|$)/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/(forbidden|login|pending-approval)(\?|$)/);
  });

  test('owner-driver reaches the intended operations workspace', async ({ page }) => {
    test.skip(!ownerDriver.ready, 'Approved owner-driver test credentials are required.');
    await login(page, ownerDriver.email, ownerDriver.password);
    await expect(page).toHaveURL(/\/(admin|driver|onboarding|pending-approval)(\/|\?|$)/);
  });

  test('carrier owner reaches company operations and not super-admin', async ({ page }) => {
    test.skip(!carrierOwner.ready, 'Approved carrier-owner test credentials are required.');
    await login(page, carrierOwner.email, carrierOwner.password);
    await expect(page).toHaveURL(/\/(admin|onboarding|pending-approval)(\/|\?|$)/);

    await page.goto('/super-admin');
    await expect(page).toHaveURL(/\/(forbidden|login)(\?|$)/);
  });
});
