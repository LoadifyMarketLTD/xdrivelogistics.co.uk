import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

const roles = [
  { name: 'Fleet Manager', prefix: 'E2E_FLEET_MANAGER', path: '/admin/fleet' },
  { name: 'Owner Driver', prefix: 'E2E_OWNER_DRIVER', path: '/driver/fleet' },
] as const;

for (const role of roles) test(`${role.name} live Fleet Documents/Compliance tabs use distinct content`, async ({ page }) => {
  test.setTimeout(120000);
  const email = process.env[role.prefix + '_EMAIL'] || '';
  const password = process.env[role.prefix + '_PASSWORD'] || '';
  test.skip(!email || !password, 'No account credentials');
  await loginWithCredentials(page, email, password);
  const response = await page.goto(role.path, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  const fleet = page.locator('[data-master-fleet="3150-canonical-real"]').first();
  await expect(fleet).toBeVisible({ timeout: 30000 });
  await fleet.getByRole('tab', { name: 'Documents' }).click();
  await expect(fleet.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await fleet.getByRole('tab', { name: 'Compliance' }).click();
  await expect(fleet.getByRole('heading', { name: 'Compliance' })).toBeVisible();
  await expect(fleet.getByText('Compliance flags use recorded document status and expiry dates; absence of a flag is not proof of full compliance.')).toBeVisible();
});