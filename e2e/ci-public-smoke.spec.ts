import { expect, test } from '@playwright/test';

test.describe('CI public smoke', () => {
  test('homepage responds and identifies XDrive', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/XDrive/i);
  });

  test('login page exposes the email field', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('input[type="email"], [data-testid="email"]').first()).toBeVisible();
  });
});
