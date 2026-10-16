import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type AuditRole = {
  id: string;
  emailKey: string;
  passwordKey: string;
  routes: Array<{ kind: 'loads' | 'quotes' | 'diary'; path: string }>;
};

const roles: AuditRole[] = [
  { id: 'customer', emailKey: 'E2E_CUSTOMER_EMAIL', passwordKey: 'E2E_CUSTOMER_PASSWORD', routes: [
    { kind: 'loads', path: '/customer/loads' }, { kind: 'quotes', path: '/customer/quotes' }, { kind: 'diary', path: '/customer/diary' },
  ]},
  { id: 'broker', emailKey: 'E2E_BROKER_EMAIL', passwordKey: 'E2E_BROKER_PASSWORD', routes: [
    { kind: 'loads', path: '/broker/loads' }, { kind: 'quotes', path: '/broker/bids' }, { kind: 'diary', path: '/broker/diary' },
  ]},
  { id: 'admin', emailKey: 'E2E_ADMIN_EMAIL', passwordKey: 'E2E_ADMIN_PASSWORD', routes: [
    { kind: 'loads', path: '/admin/marketplace' }, { kind: 'quotes', path: '/admin/exchange' }, { kind: 'diary', path: '/admin/diary' },
  ]},
  { id: 'fleet-manager', emailKey: 'E2E_FLEET_MANAGER_EMAIL', passwordKey: 'E2E_FLEET_MANAGER_PASSWORD', routes: [
    { kind: 'loads', path: '/admin/marketplace' }, { kind: 'quotes', path: '/admin/exchange' }, { kind: 'diary', path: '/admin/diary' },
  ]},
  { id: 'dispatcher', emailKey: 'E2E_DISPATCHER_EMAIL', passwordKey: 'E2E_DISPATCHER_PASSWORD', routes: [
    { kind: 'loads', path: '/admin/marketplace' }, { kind: 'quotes', path: '/admin/exchange' }, { kind: 'diary', path: '/admin/diary' },
  ]},
  { id: 'owner-driver', emailKey: 'E2E_OWNER_DRIVER_EMAIL', passwordKey: 'E2E_OWNER_DRIVER_PASSWORD', routes: [
    { kind: 'loads', path: '/driver/loads' }, { kind: 'quotes', path: '/driver/quotes' }, { kind: 'diary', path: '/driver/history' },
  ]},
  { id: 'carrier-admin', emailKey: 'E2E_CARRIER_ADMIN_EMAIL', passwordKey: 'E2E_CARRIER_ADMIN_PASSWORD', routes: [
    { kind: 'loads', path: '/admin/marketplace' }, { kind: 'quotes', path: '/admin/exchange' }, { kind: 'diary', path: '/admin/diary' },
  ]},
  { id: 'company-driver', emailKey: 'E2E_COMPANY_DRIVER_EMAIL', passwordKey: 'E2E_COMPANY_DRIVER_PASSWORD', routes: [
    { kind: 'loads', path: '/driver/loads' }, { kind: 'quotes', path: '/driver/quotes' }, { kind: 'diary', path: '/driver/history' },
  ]},
];

const selectorFor = (kind: 'loads' | 'quotes' | 'diary') =>
  kind === 'loads' ? '.xdrive-cx-load-card' : kind === 'quotes' ? '.xdrive-cx-quote-card' : '.xdrive-cx-diary-card';

const results: Array<Record<string, unknown>> = [];
const outDir = path.join(process.cwd(), '_audit', 'workspace-unification', 'runs', '20261016-live-lqd');
fs.mkdirSync(outDir, { recursive: true });

for (const role of roles) {
  test(role.id + ' Loads Quotes Diary production identity', async ({ page }) => {
    test.setTimeout(120_000);
    const email = process.env[role.emailKey] ?? '';
    const password = process.env[role.passwordKey] ?? '';
    test.skip(!email || !password, 'Missing credentials for ' + role.id);

    await page.setViewportSize({ width: 1680, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 25_000 });
    expect(page.url(), role.id + ': authenticated session must leave /login').not.toMatch(/\/login(?:\?|$)/);

    for (const route of role.routes) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const url = page.url();
      const selector = selectorFor(route.kind);
      const cardCount = await page.locator(selector).count();
      const measuredRoot = await page.locator('.xdrive-workspace-measured').count();
      const loginVisible = await page.locator('input[type="password"]').count();
      const bodyText = (await page.locator('body').innerText()).slice(0, 500);
      let geometry = null;
      if (cardCount > 0) {
        geometry = await page.locator(selector).first().evaluate((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { width: Math.round(r.width), height: Math.round(r.height), fontSize: s.fontSize, border: s.borderTopWidth + ' ' + s.borderTopStyle };
        });
      }
      expect(loginVisible, role.id + ' ' + route.kind + ': route must remain authenticated').toBe(0);
      expect(url, role.id + ' ' + route.kind + ': route must not redirect to login').not.toMatch(/\/login(?:\?|$)/);
      expect(measuredRoot, role.id + ' ' + route.kind + ': measured workspace root').toBeGreaterThan(0);
      const record = { role: role.id, kind: route.kind, path: route.path, status: response?.status() ?? null, url, cardCount, measuredRoot, loginVisible, geometry, bodyText };
      results.push(record);
      await page.screenshot({ path: path.join(outDir, role.id + '-' + route.kind + '.png'), fullPage: true });
    }
    fs.writeFileSync(path.join(outDir, 'live-lqd-audit.json'), JSON.stringify(results, null, 2));
  });
}

test.afterAll(() => {
  fs.writeFileSync(path.join(outDir, 'live-lqd-audit.json'), JSON.stringify(results, null, 2));
});
