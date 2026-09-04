import { expect, test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 } as const;
const PUBLIC_ROUTES = ['/', '/login', '/register', '/contact', '/privacy', '/subscription-terms'] as const;
const WORKSPACE_ROLES = ['carrier', 'broker', 'customer', 'driver', 'fleet', 'operations'] as const;

const ALLOWED_HTTP_ERRORS = [
  /\/favicon\.ico$/i,
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
];

const allowlisted = (url: string) => ALLOWED_HTTP_ERRORS.some((pattern) => pattern.test(url));

const assertNoPageOverflow = async (page: import('@playwright/test').Page, label: string) => {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    geometry.scrollWidth <= geometry.clientWidth + 1,
    `${label}: document must not overflow horizontally at 390px`,
  ).toBe(true);
};

test.describe('mobile web release gate', () => {
  test.use({ viewport: MOBILE });

  for (const route of PUBLIC_ROUTES) {
    test(`public route ${route} is usable at 390px`, async ({ page }) => {
      const failedRequests: string[] = [];
      const serverErrors: string[] = [];

      page.on('requestfailed', (request) => {
        failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
      });
      page.on('response', (response) => {
        if (response.status() >= 500 && !allowlisted(response.url())) {
          serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status() ?? 0, `${route}: route must not return 5xx`).toBeLessThan(500);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await assertNoPageOverflow(page, route);

      const body = page.locator('body');
      await expect(body).toBeVisible();
      expect(await body.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(300);

      expect(failedRequests, `${route}: no failed network requests`).toEqual([]);
      expect(serverErrors, `${route}: no server-side 5xx responses`).toEqual([]);
    });
  }

  test.describe('workspace role fixtures at mobile width', () => {
    test.skip(
      process.env.E2E_VISUAL_FIXTURE !== 'true',
      'Set E2E_VISUAL_FIXTURE=true to exercise deterministic workspace role fixtures.',
    );

    for (const role of WORKSPACE_ROLES) {
      test(`${role} workspace shell remains usable at 390px`, async ({ page }) => {
        await page.route('**/api/auth/context', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              memberships: [],
              current: null,
              companySelectionRequired: false,
              workspaceSelectionRequired: false,
              selectedCompanyId: null,
            }),
          });
        });

        const response = await page.goto(`/visual-fixture/workspace/${role}`, { waitUntil: 'networkidle' });
        expect(response?.status() ?? 0, `${role}: fixture route must load`).toBeLessThan(500);

        const nav = role === 'driver' ? page.locator('.driver-top-nav') : page.locator('.top-workspace-nav');
        await expect(nav).toBeVisible();

        const overflow = await nav.evaluate((el) => ({
          overflowX: window.getComputedStyle(el).overflowX,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }));
        if (overflow.scrollWidth > overflow.clientWidth + 1) {
          expect(['auto', 'scroll']).toContain(overflow.overflowX);
        }

        await expect(page.getByRole('button', { name: /Notifications/i })).toBeVisible();
        await assertNoPageOverflow(page, `${role} workspace`);
      });
    }
  });
});
