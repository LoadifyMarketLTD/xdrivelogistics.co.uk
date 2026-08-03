import { expect, test } from '@playwright/test';

const FIXTURE_URL = '/visual-fixture/driver';

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900, mobile: false, tablet: false },
  { label: 'tablet', width: 768, height: 1024, mobile: false, tablet: true },
  { label: 'mobile', width: 390, height: 844, mobile: true, tablet: false },
] as const;

test.describe('driver dashboard visual contract gate', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  test('owner-driver dashboard remains within the numeric visual contract', async ({ page }, testInfo) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(FIXTURE_URL);
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'Owner Driver Dashboard' })).toBeVisible();

      const actionCentreButton = page.getByRole('button', { name: 'Action Centre' });
      await expect(actionCentreButton).toBeVisible({ timeout: 15_000 });
      const header = actionCentreButton.locator('xpath=ancestor::header[1]');
      const headerHeight = await header.evaluate((node) => Math.round(node.getBoundingClientRect().height));
      expect(headerHeight, `${viewport.label}: header height`).toBeGreaterThanOrEqual(48);
      expect(headerHeight, `${viewport.label}: header height`).toBeLessThanOrEqual(52);

      const sidebar = page.locator('aside[aria-label$="navigation"]');
      if (viewport.mobile) {
        await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
        const rightEdge = await sidebar.evaluate((node) => node.getBoundingClientRect().right);
        expect(rightEdge, `${viewport.label}: drawer stays off-canvas`).toBeLessThanOrEqual(1);
      } else if (viewport.tablet) {
        const width = await sidebar.evaluate((node) => Math.round(node.getBoundingClientRect().width));
        expect(width, `${viewport.label}: tablet sidebar width`).toBeGreaterThanOrEqual(54);
        expect(width, `${viewport.label}: tablet sidebar width`).toBeLessThanOrEqual(58);
      } else {
        const width = await sidebar.evaluate((node) => Math.round(node.getBoundingClientRect().width));
        expect(width, `${viewport.label}: desktop sidebar width`).toBeGreaterThanOrEqual(228);
        expect(width, `${viewport.label}: desktop sidebar width`).toBeLessThanOrEqual(232);
      }

      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(pageOverflow, `${viewport.label}: no body overflow`).toBe(false);

      const kpiStrip = page.locator('[aria-label="Operational key performance indicators"]');
      const kpiCards = kpiStrip.locator('[role="group"], button');
      await expect(kpiCards).toHaveCount(6);
      await expect(kpiStrip.getByText('Won work')).toHaveCount(0);
      await expect(kpiStrip.getByText('Pending invoices')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Won work \(accepted\)/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Pending invoices/i })).toBeVisible();

      const kpiHeights = await kpiCards.evaluateAll((nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
      );
      expect(Math.max(...kpiHeights), `${viewport.label}: KPI height max`).toBeLessThanOrEqual(80);
      expect(Math.min(...kpiHeights), `${viewport.label}: KPI height min`).toBeGreaterThanOrEqual(72);

      const pageHeaderActions = page
        .getByRole('heading', { name: 'Owner Driver Dashboard' })
        .locator('xpath=ancestor::header[contains(@class,"xdrive-page-header")][1]');
      const actionHeights = await pageHeaderActions.locator('button').evaluateAll((nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
      );
      for (const height of actionHeights) {
        expect(height, `${viewport.label}: page header action height`).toBeGreaterThanOrEqual(30);
        expect(height, `${viewport.label}: page header action height`).toBeLessThanOrEqual(34);
      }

      const panelHeaderHeight = await page.evaluate(() => {
        const heading = Array.from(document.querySelectorAll('h3')).find((node) => node.textContent?.trim() === 'Current job');
        const headerNode = heading?.parentElement?.parentElement;
        return headerNode ? Math.round(headerNode.getBoundingClientRect().height) : 0;
      });
      expect(panelHeaderHeight, `${viewport.label}: panel header height`).toBeGreaterThanOrEqual(36);

      const railLayout = await page.evaluate(() => {
        const layout = document.querySelector('[class*="operationalPageLayoutTwoPanel"]');
        const rail = document.querySelector('aside[aria-label="Search and filters"]');
        const main = document.querySelector('[class*="operationalPageLayoutMain"]');
        if (!(layout instanceof HTMLElement) || !(rail instanceof HTMLElement) || !(main instanceof HTMLElement)) return null;
        const railRect = rail.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        return {
          gridTemplateColumns: window.getComputedStyle(layout).gridTemplateColumns,
          width: Math.round(railRect.width),
          aboveMain: railRect.top < mainRect.top && railRect.bottom <= mainRect.top + 4,
        };
      });
      expect(railLayout, `${viewport.label}: search rail geometry resolved`).not.toBeNull();
      if (viewport.width <= 768) {
        expect((railLayout?.gridTemplateColumns ?? '').trim().split(/\s+/).length, `${viewport.label}: single-column layout`).toBe(1);
        expect(railLayout?.aboveMain, `${viewport.label}: search rail precedes main`).toBe(true);
      } else {
        expect(railLayout?.width, `${viewport.label}: search rail width`).toBeGreaterThanOrEqual(218);
        expect(railLayout?.width, `${viewport.label}: search rail width`).toBeLessThanOrEqual(222);
      }

      const firstTwoColumn = await page.evaluate(() => {
        const grid = document.querySelector('.xdrive-two-column');
        if (!(grid instanceof HTMLElement) || grid.children.length < 2) return null;
        const first = grid.children[0].getBoundingClientRect();
        const second = grid.children[1].getBoundingClientRect();
        return {
          sameColumn: Math.abs(first.left - second.left) <= 1,
          secondBelow: second.top > first.top,
          secondToRight: second.left > first.left + 20,
        };
      });
      expect(firstTwoColumn, `${viewport.label}: two-column geometry resolved`).not.toBeNull();
      if (viewport.width <= 768) {
        expect(firstTwoColumn?.sameColumn, `${viewport.label}: stacked two-column layout`).toBe(true);
        expect(firstTwoColumn?.secondBelow, `${viewport.label}: stacked order`).toBe(true);
      } else {
        expect(firstTwoColumn?.secondToRight, `${viewport.label}: desktop two-column layout`).toBe(true);
      }

      await page.screenshot({
        path: testInfo.outputPath(`driver-dashboard-${viewport.width}x${viewport.height}.jpeg`),
        fullPage: true,
        type: 'jpeg',
        quality: 80,
      });
    }
  });
});
