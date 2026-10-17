import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type AuditRole = {
  id: string;
  emailKey: string;
  passwordKey: string;
  routes: Array<{ kind: 'loads' | 'quotes' | 'diary'; path: string }>;
  deniedRoutes?: Array<{ kind: 'loads' | 'quotes'; path: string }>;
};

const roles: AuditRole[] = [
  { id: 'customer', emailKey: 'E2E_CUSTOMER_EMAIL', passwordKey: 'E2E_CUSTOMER_PASSWORD', routes: [
    { kind: 'loads', path: '/customer/loads' }, { kind: 'quotes', path: '/customer/quotes' }, { kind: 'diary', path: '/customer/diary' },
  ]},
  { id: 'broker', emailKey: 'E2E_BROKER_EMAIL', passwordKey: 'E2E_BROKER_PASSWORD', routes: [
    { kind: 'loads', path: '/broker/loads' }, { kind: 'quotes', path: '/broker/bids' }, { kind: 'diary', path: '/broker/diary' },
  ]},
  { id: 'operations-dispatcher', emailKey: 'E2E_ADMIN_EMAIL', passwordKey: 'E2E_ADMIN_PASSWORD', routes: [
    { kind: 'diary', path: '/admin/diary' },
  ], deniedRoutes: [
    { kind: 'loads', path: '/admin/marketplace' }, { kind: 'quotes', path: '/admin/exchange' },
  ]},
  { id: 'fleet-manager', emailKey: 'E2E_FLEET_MANAGER_EMAIL', passwordKey: 'E2E_FLEET_MANAGER_PASSWORD', routes: [
    { kind: 'diary', path: '/admin/diary' },
  ], deniedRoutes: [
    { kind: 'loads', path: '/admin/marketplace' }, { kind: 'quotes', path: '/admin/exchange' },
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

const roleFilter = process.env.E2E_AUDIT_ROLE?.trim() ?? '';

const selectorFor = (kind: 'loads' | 'quotes' | 'diary') =>
  kind === 'loads' ? '.xdrive-cx-load-card' : kind === 'quotes' ? '.xdrive-cx-quote-card' : '.xdrive-cx-diary-card';

const results: Array<Record<string, unknown>> = [];
const auditTarget = (process.env.E2E_AUDIT_TARGET?.trim() || 'run').replace(/[^a-z0-9_-]+/gi, '-');
const outDir = path.join(process.cwd(), '_audit', 'workspace-unification', 'runs', `20261017-lqd-${auditTarget}`);
fs.mkdirSync(outDir, { recursive: true });

for (const role of roles) {
  test(role.id + ' Loads Quotes Diary production identity', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(Boolean(roleFilter) && role.id !== roleFilter, 'Filtered audit role');
    const email = process.env[role.emailKey] ?? '';
    const password = process.env[role.passwordKey] ?? '';
    test.skip(!email || !password, 'Missing credentials for ' + role.id);

    await page.setViewportSize({ width: 1680, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const form = document.querySelector('form');
      return Boolean(form && Object.keys(form).some((key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$')));
    }, undefined, { timeout: 30_000 });
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue(password);
    let authenticated = !new URL(page.url()).pathname.startsWith('/login');
    let loginAlert: string | null = null;
    for (let attempt = 1; attempt <= 3 && !authenticated; attempt += 1) {
      const signIn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
      if (await signIn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await signIn.click({ timeout: 10_000 });
      }
      await page.waitForTimeout(5_000);
      authenticated = !new URL(page.url()).pathname.startsWith('/login');
      if (!authenticated) {
        loginAlert = (await page.locator('[role="alert"]').first().textContent().catch(() => null))?.trim() ?? null;
        if (attempt < 3) {
          await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 20_000 });
          await page.locator('#email').fill(email);
          await page.locator('#password').fill(password);
          await page.waitForTimeout(1500);
        }
      }
    }
    if (!authenticated) {
      results.push({ role: role.id, kind: 'login', status: 'blocked', url: page.url(), alert: loginAlert });
      fs.writeFileSync(path.join(outDir, 'live-lqd-audit.json'), JSON.stringify(results, null, 2));
      throw new Error(role.id + ': login blocked after 3 attempts' + (loginAlert ? ' — ' + loginAlert : ''));
    }
    expect(page.url(), role.id + ': authenticated session must leave /login').not.toMatch(/\/login(?:\?|$)/);

    for (const route of role.routes) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        return !/(?:Loading[^\n]*(?:loads|quotes|diary|freight)|Refreshing[^\n]*|Searching[^\n]*)/i.test(text);
      }, undefined, { timeout: 30_000 }).catch(() => null);
      await page.waitForTimeout(1_000);
      const url = page.url();
      const actualPath = new URL(url).pathname;
      expect(actualPath, role.id + ' ' + route.kind + ': route must stay on requested page').toBe(route.path);
      const selector = selectorFor(route.kind);
      const cardCount = await page.locator(selector).count();
      const measuredRoot = await page.locator('.xdrive-workspace-measured').count();
      const loginVisible = await page.locator('input[type="password"]').count();
      const shellGeometry = await page.evaluate(() => {
        const rect = (selector: string) => {
          const el = document.querySelector(selector) as HTMLElement | null;
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), fontSize: s.fontSize };
        };
        return {
          header: rect('.top-workspace-shell__header'),
          nav: rect('.top-workspace-nav--primary'),
          content: rect('.top-workspace-shell__content'),
        };
      });
      const bodyText = (await page.locator('body').innerText()).slice(0, 500);
      let geometry = null;
      if (cardCount > 0) {
        geometry = await page.locator(selector).first().evaluate((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          const vehicle = el.querySelector('.xdrive-cx-load-card__vehicle-image, .xdrive-cx-diary-card__vehicle-image') as HTMLElement | null;
          const vr = vehicle?.getBoundingClientRect();
          const vs = vehicle ? getComputedStyle(vehicle) : null;
          return {
            width: Math.round(r.width), height: Math.round(r.height), fontSize: s.fontSize,
            border: s.borderTopWidth + ' ' + s.borderTopStyle,
            vehicle: vr && vs ? { width: Math.round(vr.width), height: Math.round(vr.height), objectFit: vs.objectFit, marginRight: vs.marginRight } : null,
          };
        });
      }
      expect(loginVisible, role.id + ' ' + route.kind + ': route must remain authenticated').toBe(0);
      expect(url, role.id + ' ' + route.kind + ': route must not redirect to login').not.toMatch(/\/login(?:\?|$)/);
      expect(measuredRoot, role.id + ' ' + route.kind + ': measured workspace root').toBeGreaterThan(0);
      const record = { role: role.id, kind: route.kind, path: route.path, status: response?.status() ?? null, url, cardCount, measuredRoot, loginVisible, shellGeometry, geometry, bodyText };
      results.push(record);
      await page.screenshot({ path: path.join(outDir, role.id + '-' + route.kind + '.png'), fullPage: true });
    }

    for (const route of role.deniedRoutes ?? []) {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1_500);
      const url = page.url();
      const actualPath = new URL(url).pathname;
      const loginVisible = await page.locator('input[type="password"]').count();
      expect(loginVisible, role.id + ' ' + route.kind + ': denied route must not log the user out').toBe(0);
      expect(actualPath, role.id + ' ' + route.kind + ': denied route must be redirected away').not.toBe(route.path);
      results.push({
        role: role.id,
        kind: route.kind,
        path: route.path,
        status: response?.status() ?? null,
        url,
        access: 'denied-as-designed',
      });
    }

    fs.writeFileSync(path.join(outDir, 'live-lqd-audit.json'), JSON.stringify(results, null, 2));
  });
}

test.afterAll(() => {
  fs.writeFileSync(path.join(outDir, 'live-lqd-audit.json'), JSON.stringify(results, null, 2));
});
