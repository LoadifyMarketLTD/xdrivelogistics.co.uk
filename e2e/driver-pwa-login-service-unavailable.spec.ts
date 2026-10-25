import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Driver PWA sign-in explains server-side account verification failures', async ({ page }) => {
  await page.goto('/login?next=%2Fm%2Fdriver%2Fjobs&reason=service_unavailable');
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('Sign-in is temporarily unavailable.');
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('no need to reset your password');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('Driver PWA ordinary login does not falsely display a server error', async ({ page }) => {
  await page.goto('/login?next=%2Fm%2Fdriver%2Fjobs');
  await expect(page.getByText('Sign-in is temporarily unavailable.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
