import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

for (const route of [
  '/m/driver/availability',
  '/m/driver/return-journeys',
  '/m/driver/messages',
  '/m/driver/settings',
]) {
  test(route + ' sends unauthenticated drivers to sign-in without rendering private data', async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(url =>
      url.pathname === '/login' && url.searchParams.get('next') === route, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Driver navigation' })).toHaveCount(0);
  });
}
