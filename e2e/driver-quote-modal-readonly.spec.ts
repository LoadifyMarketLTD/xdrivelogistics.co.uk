import { expect, test } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

for (const role of ['owner-driver','company-driver'] as const) {
  test(role + ' can open the real marketplace quote form without submitting', async ({ page }) => {
    test.setTimeout(100_000);
    const prefix = role === 'owner-driver' ? 'E2E_OWNER_DRIVER' : 'E2E_COMPANY_DRIVER';
    const email = process.env[prefix + '_EMAIL'] || '';
    const password = process.env[prefix + '_PASSWORD'] || '';
    test.skip(!email || !password, role + ' test credentials not supplied');
    await loginWithCredentials(page, email.trim(), password.trim());
    const response = await page.goto('/driver/loads', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('.xdrive-cx-load-card').first()).toBeVisible({ timeout: 40_000 });
    const quote = page.getByRole('button', { name: 'Quote Now' }).first();
    await expect(quote).toBeVisible({ timeout: 15_000 });
    await expect(quote).toBeEnabled();
    await quote.click();
    await expect(page.getByRole('dialog', { name: /Submit marketplace quote/i })).toBeVisible();
    await expect(page.locator('#marketplace-quote-amount')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Quote' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await expect(page.getByRole('dialog', { name: /Submit marketplace quote/i })).toHaveCount(0);
    await expect(page).toHaveURL(/\/driver\/loads(?:\?|$)/);
  });
}
