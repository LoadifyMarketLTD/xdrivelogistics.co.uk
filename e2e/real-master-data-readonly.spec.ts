import { expect, test } from '@playwright/test';
import { loginWithCredentials } from './helpers/authLogin';

const roleCases = [
  { role: 'customer', prefix: 'E2E_CUSTOMER', root: '/customer', routes: [
    { path: '/customer/fleet', api: '/api/workspace/fleet-overview' },
    { path: '/customer/drivers', api: '/api/workspace/fleet-overview' },
    { path: '/customer/directory', api: '/api/directory' },
    { path: '/customer/live-availability', api: '/api/availability/nearby' },
    { path: '/customer/returns', api: '/api/workspace/return-journeys' },
    { path: '/customer/reports', api: null },
    { path: '/customer/freight-vision', api: null },
  ] },
  { role: 'broker', prefix: 'E2E_BROKER', root: '/broker', routes: [
    { path: '/broker/fleet', api: '/api/workspace/fleet-overview' },
    { path: '/broker/drivers', api: '/api/workspace/fleet-overview' },
    { path: '/broker/directory', api: '/api/directory' },
    { path: '/broker/live-availability', api: '/api/availability/nearby' },
    { path: '/broker/returns', api: '/api/workspace/return-journeys' },
    { path: '/broker/reports', api: null },
    { path: '/broker/freight-vision', api: null },
  ] },
] as const;

for (const item of roleCases) {
  test(item.role + ' Master real-data read-only routes', async ({ page }) => {
    test.setTimeout(240_000);
    const email = process.env[item.prefix + '_EMAIL'] || '';
    const password = process.env[item.prefix + '_PASSWORD'] || '';
    test.skip(!email || !password, 'Account credentials unavailable');
    await loginWithCredentials(page, email.trim(), password.trim());
    const failures: string[] = [];
    for (const route of item.routes) {
      const events: Array<{ api: string; status: number }> = [];
      const listener = (res: import('@playwright/test').Response) => {
        if (!route.api || !new URL(res.url()).pathname.startsWith(route.api)) return;
        if (res.request().method() !== 'GET') return;
        events.push({ api: route.api, status: res.status() });
      };
      page.on('response', listener);
      try {
        const response = await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(4500);
        const path = new URL(page.url()).pathname;
        const status = response?.status();
        console.log(JSON.stringify({ role: item.role, path: route.path, currentPath: path, status, verifiedApi: events }));
        if (!status || status >= 400) failures.push(`${route.path}: HTTP ${status ?? 'missing'}`);
        if (path !== route.path) failures.push(`${route.path}: redirected to ${path}`);
        const body = await page.locator('body').innerText();
        if (/sign-in is temporarily unavailable|login service unavailable/i.test(body)) failures.push(`${route.path}: sign-in unavailable`);
        if (route.api && !events.some((event) => event.status === 200)) {
          failures.push(`${route.path}: live API failed (${events.map((event) => event.status).join(', ') || 'no request'})`);
        }
      } finally {
        page.off('response', listener);
      }
    }
    expect(failures, item.role + ' all real-data routes should work').toEqual([]);
  });
}
