import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type QuoteRole = {
  id: string;
  emailKey: string;
  passwordKey: string;
  path: string;
};

const roles: QuoteRole[] = [
  { id: 'carrier-admin', emailKey: 'E2E_CARRIER_ADMIN_EMAIL', passwordKey: 'E2E_CARRIER_ADMIN_PASSWORD', path: '/admin/marketplace' },
  { id: 'owner-driver', emailKey: 'E2E_OWNER_DRIVER_EMAIL', passwordKey: 'E2E_OWNER_DRIVER_PASSWORD', path: '/driver/loads' },
  { id: 'company-driver', emailKey: 'E2E_COMPANY_DRIVER_EMAIL', passwordKey: 'E2E_COMPANY_DRIVER_PASSWORD', path: '/driver/loads' },
];

const outDir = path.join(process.cwd(), '_audit', 'workspace-unification', 'runs', '20261017-quote-now-local');
fs.mkdirSync(outDir, { recursive: true });

type QuoteGeometry = {
  width: number;
  memberHeight: number | null;
  routeRowHeight: number | null;
  amountHeight: number | null;
  totalHeight: number | null;
};

let adminBaseline: QuoteGeometry | null = null;

test.describe.configure({ mode: 'serial' });

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => null);

  let authenticated = !new URL(page.url()).pathname.startsWith('/login');
  for (let attempt = 1; attempt <= 3 && !authenticated; attempt += 1) {
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 15_000 });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);

    const button = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    if (await button.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await button.click({ timeout: 5_000 }).catch(() => null);
    } else {
      const form = page.locator('form').first();
      if (await form.count()) await form.evaluate((node) => (node as HTMLFormElement).requestSubmit());
    }

    await page.waitForTimeout(5_000);
    authenticated = !new URL(page.url()).pathname.startsWith('/login');
    if (!authenticated && attempt < 3) {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1_000);
    }
  }

  expect(new URL(page.url()).pathname).not.toMatch(/^\/login/);
}

for (const role of roles) {
  test(role.id + ' uses the Admin Marketplace Quote Now visual model', async ({ page }) => {
    test.setTimeout(120_000);
    const email = process.env[role.emailKey] ?? '';
    const password = process.env[role.passwordKey] ?? '';
    test.skip(!email || !password, 'Missing quote audit credentials');

    await page.setViewportSize({ width: 1680, height: 900 });
    await login(page, email, password);
    await page.goto(role.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);

    const quoteButton = page.locator('button:has-text("Quote Now")').first();
    await expect(quoteButton, role.id + ': Quote Now action must exist').toBeVisible({ timeout: 20_000 });
    await quoteButton.click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Quote Now' }).first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('.xdrive-quote-modal__member')).toBeVisible();
    await expect(dialog.locator('.xdrive-quote-modal__route')).toBeVisible();
    await expect(dialog.getByText('Choose currency:', { exact: true })).toBeVisible();
    await expect(dialog.locator('.xdrive-quote-modal__price-row > label').first()).toContainText('My Quote:');
    await expect(dialog.locator('.xdrive-quote-modal__total')).toContainText('Total:');
    await expect(dialog.locator('.xdrive-quote-modal__notes')).toContainText('Notes:');
    await expect(dialog.getByRole('button', { name: 'Submit Quote' })).toBeVisible();

    const geometry = await dialog.evaluate((node) => {
      const root = node as HTMLElement;
      const rect = root.getBoundingClientRect();
      const member = root.querySelector('.xdrive-quote-modal__member') as HTMLElement | null;
      const routeRow = root.querySelector('.xdrive-quote-modal__route > div') as HTMLElement | null;
      const amount = root.querySelector('.xdrive-quote-modal__price-row input') as HTMLElement | null;
      const total = root.querySelector('.xdrive-quote-modal__total') as HTMLElement | null;
      const box = (el: HTMLElement | null) => el ? el.getBoundingClientRect() : null;
      const memberRect = box(member);
      const routeRect = box(routeRow);
      const amountRect = box(amount);
      const totalRect = box(total);
      return {
        width: Math.round(rect.width),
        memberHeight: memberRect ? Math.round(memberRect.height) : null,
        routeRowHeight: routeRect ? Math.round(routeRect.height) : null,
        amountHeight: amountRect ? Math.round(amountRect.height) : null,
        totalHeight: totalRect ? Math.round(totalRect.height) : null,
      };
    });

    expect(geometry.width).toBe(468);
    expect(geometry.memberHeight).toBeGreaterThanOrEqual(94);
    expect(geometry.routeRowHeight).toBeGreaterThanOrEqual(38);
    expect(geometry.amountHeight).toBeGreaterThan(0);
    expect(geometry.totalHeight).toBeGreaterThanOrEqual(94);

    if (role.id === 'carrier-admin') {
      adminBaseline = geometry;
    } else {
      expect(adminBaseline, role.id + ': carrier-admin geometry must be measured first').not.toBeNull();
      expect(geometry).toEqual(adminBaseline);
    }

    await page.screenshot({ path: path.join(outDir, role.id + '-quote-now.png'), fullPage: true });
    fs.writeFileSync(path.join(outDir, role.id + '-geometry.json'), JSON.stringify(geometry, null, 2));
  });
}
