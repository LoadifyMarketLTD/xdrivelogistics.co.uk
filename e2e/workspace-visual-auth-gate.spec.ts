import { expect, test } from '@playwright/test';

type Role = 'admin' | 'broker' | 'customer' | 'driver' | 'operations';

const roles: Role[] = ['admin', 'broker', 'customer', 'driver', 'operations'];

const viewports = [
  { label: 'desktop', width: 1440, height: 900, compact: false },
  { label: 'tablet', width: 768, height: 1024, compact: true },
  { label: 'mobile', width: 390, height: 844, compact: true },
] as const;

const toHex = (value: string) => {
  const match = value.match(/\d+/g);
  if (!match || match.length < 3) return value.trim().toLowerCase();
  const [r, g, b] = match.slice(0, 3).map((entry) => Number(entry));
  return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, '0')).join('')}`;
};

test.describe('authenticated workspace visual verification gate (fixture harness)', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  for (const role of roles) {
    test(`${role} visual contract at desktop/tablet/mobile`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/visual-fixture/workspace/${role}`);
        await page.waitForLoadState('networkidle');

        const header = page
          .locator('header')
          .filter({ has: page.getByRole('button', { name: 'Action Centre' }) })
          .first();
        await expect(header).toBeVisible();

        const sidebar = page.locator('aside[aria-label$="navigation"]');
        if (viewport.compact) {
          await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
          const rightEdge = await sidebar.evaluate((el) => el.getBoundingClientRect().right);
          expect(rightEdge).toBeLessThanOrEqual(1);
        } else {
          await expect(sidebar).toBeVisible();
          const width = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
          expect(width).toBeGreaterThanOrEqual(260);
          expect(width).toBeLessThanOrEqual(280);
        }

        const headerHeight = await header.evaluate((el) => Math.round(el.getBoundingClientRect().height));
        expect(headerHeight).toBeGreaterThanOrEqual(56);
        const headerMinHeight = await header.evaluate((el) => window.getComputedStyle(el).minHeight);
        expect(headerMinHeight).toBe('60px');

        const actionCentreButton = page.getByRole('button', { name: 'Action Centre' });
        const notificationsButton = page.getByRole('button', { name: /Notifications/i });
        await expect(actionCentreButton).toBeVisible();
        await expect(notificationsButton).toBeVisible();
        const actionRoute = await actionCentreButton.getAttribute('data-route');
        const notificationRoute = await notificationsButton.getAttribute('data-route');
        expect(actionRoute).toBeTruthy();
        expect(notificationRoute).toBeTruthy();
        expect(actionRoute).not.toBe(notificationRoute);

        const ticker = page.locator('[aria-label="Activity feed"]');
        await expect(ticker).toBeVisible();
        const tickerTop = await ticker.evaluate((el) => el.getBoundingClientRect().top);
        const mainTop = await page.locator('main').first().evaluate((el) => el.getBoundingClientRect().top);
        expect(tickerTop).toBeLessThan(mainTop);

        const kpiCards = page.locator('[aria-label="Operational key performance indicators"] [role="group"], [aria-label="Operational key performance indicators"] button');
        const kpiCount = await kpiCards.count();
        expect(kpiCount).toBeGreaterThanOrEqual(4);
        expect(kpiCount).toBeLessThanOrEqual(6);

        const table = page.locator('table').first();
        await expect(table).toBeVisible();
        const stickyPosition = await page.locator('th').first().evaluate((el) => window.getComputedStyle(el).position);
        expect(stickyPosition).toBe('sticky');
        await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
        await expect(page.locator('span', { hasText: /Pending|In Progress|Delivered/ }).first()).toBeVisible();

        const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(bodyOverflow).toBe(false);

        if (viewport.compact) {
          const tableScroll = page.locator('div').filter({ has: table }).first();
          const hasHorizontalScroll = await tableScroll.evaluate((el) => el.scrollWidth >= el.clientWidth);
          expect(hasHorizontalScroll).toBe(true);
        }

        if (role !== 'admin') {
          await expect(page.getByText('Admin-only escalation queue')).toHaveCount(0);
        } else {
          await expect(page.getByText('Admin-only escalation queue')).toBeVisible();
        }

        const paletteSample = await page.evaluate(() => {
          const ticker = document.querySelector('[aria-label="Activity feed"]');
          const tickerBg = ticker ? window.getComputedStyle(ticker).backgroundColor : '';
          const primaryAction = Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.includes('Primary action'));
          const primaryBg = primaryAction ? window.getComputedStyle(primaryAction).backgroundColor : '';
          return { tickerBg, primaryBg };
        });
        expect(toHex(paletteSample.tickerBg)).toBe('#0b2f6b');
        expect(toHex(paletteSample.primaryBg)).toBe('#1d57d8');

        await expect(page.getByRole('button', { name: /Open menu|Action Centre|Notifications/i }).first()).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`workspace-fixture-${role}-${viewport.label}.png`),
          fullPage: true,
        });
      }

      const nonHydrationErrors = consoleErrors.filter(
        (entry) => !entry.includes("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."),
      );
      const cspErrors = nonHydrationErrors.filter((entry) => /content security policy|csp/i.test(entry));
      expect(cspErrors).toEqual([]);
      expect(nonHydrationErrors).toEqual([]);
    });
  }
});
