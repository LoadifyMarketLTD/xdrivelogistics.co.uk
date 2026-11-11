import { test, expect } from '@playwright/test';
test.use({ screenshot: 'off', video: 'off', trace: 'off' });
test('integrated driver preview fails closed without session and does not render fixtures', async ({ page }) => {
  await page.goto('/driver/official-pwa-live');
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('TEST-1099');
  await expect(page.locator('body')).not.toContainText('XDrive Sample Customer');
});
