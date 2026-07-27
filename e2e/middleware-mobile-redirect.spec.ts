/**
 * Middleware Mobile Redirect Contract Tests
 *
 * Verifies that:
 * 1. Mobile and desktop user agents can access /driver routes without forced redirect to /m
 * 2. /m and /m/driver routes remain accessible for authorized users (explicit fallback)
 * 3. Password change flow works for mobile browsers
 * 4. Other authentication/authorization redirects remain intact
 */
import { expect, test } from '@playwright/test';

const DRIVER_EMAIL = process.env.E2E_DRIVER_EMAIL ?? '';
const DRIVER_PASSWORD = process.env.E2E_DRIVER_PASSWORD ?? '';

async function loginAsDriver(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', DRIVER_EMAIL);
  await page.fill('input[type="password"]', DRIVER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

test.describe('middleware mobile redirect contract — static', () => {
  test('/m and /m/driver remain accessible as explicit launcher/fallback routes', async ({ page }) => {
    // /m is the native app deep-link landing page
    const mResponse = await page.goto('/m');
    expect(mResponse?.status()).not.toBe(500);
    await expect(page).toHaveURL(/\/m(\?|$)/);

    // /m/driver requires authentication (should redirect to login)
    const mDriverResponse = await page.goto('/m/driver');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    expect(mDriverResponse?.status()).not.toBe(500);
  });

  test('unauthenticated requests to /driver redirect to login, not /m', async ({ page }) => {
    // Desktop user agent
    const response = await page.goto('/driver');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    expect(response?.status()).not.toBe(500);
  });
});

test.describe('middleware mobile redirect contract — authenticated', () => {
  test.skip(!DRIVER_EMAIL, 'Set E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD to run authenticated middleware tests');

  test('mobile user agent can access /driver without forced redirect to /m', async ({ page, context }) => {
    // Set mobile user agent
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });

    await loginAsDriver(page);
    
    // Navigate to /driver - should NOT redirect to /m/driver
    await page.goto('/driver');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    
    const currentUrl = page.url();
    const pathname = new URL(currentUrl).pathname;
    
    // Should stay on /driver, not be redirected to /m
    expect(pathname).toMatch(/^\/driver/);
    expect(pathname).not.toMatch(/^\/m/);
  });

  test('desktop user agent can access /driver without redirect', async ({ page }) => {
    await loginAsDriver(page);
    
    await page.goto('/driver');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    
    const pathname = new URL(page.url()).pathname;
    expect(pathname).toMatch(/^\/driver/);
  });

  test('mobile user agent can access /driver/change-password without redirect to /m', async ({ page, context }) => {
    // Set mobile user agent
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0',
    });

    await loginAsDriver(page);
    
    // Navigate to /driver/change-password - should NOT redirect to /m
    await page.goto('/driver/change-password');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    
    const pathname = new URL(page.url()).pathname;
    
    // Should stay on /driver/change-password, not be redirected to /m
    expect(pathname).toBe('/driver/change-password');
    expect(pathname).not.toMatch(/^\/m/);
  });

  test('mobile user agent can access other /driver/* routes without redirect', async ({ page, context }) => {
    // Set mobile user agent (iPad)
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });

    await loginAsDriver(page);
    
    // Test various driver routes
    const routesToTest = ['/driver/jobs', '/driver/availability'];
    
    for (const route of routesToTest) {
      await page.goto(route);
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      
      const pathname = new URL(page.url()).pathname;
      
      // Should stay on the requested route, not be redirected to /m
      expect(pathname).toMatch(/^\/driver/);
      expect(pathname).not.toMatch(/^\/m/);
    }
  });

  test('/m/driver remains accessible for mobile users as explicit fallback', async ({ page, context }) => {
    // Set mobile user agent
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });

    await loginAsDriver(page);
    
    // Explicitly navigate to /m/driver - should work
    await page.goto('/m/driver');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    
    const pathname = new URL(page.url()).pathname;
    expect(pathname).toMatch(/^\/m\/driver/);
  });
});
