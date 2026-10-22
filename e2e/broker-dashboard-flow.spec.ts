import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Broker dashboard columns flow without an empty shared row', async ({ page }) => {
  test.setTimeout(180000);
  const email = process.env.E2E_BROKER_EMAIL;
  const password = process.env.E2E_BROKER_PASSWORD;
  if (!email || !password) throw new Error('Broker E2E credentials required');
  await page.goto('/login');
  await page.locator('#email').waitFor();
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return form && Object.keys(form).some(key => key.startsWith('__reactProps$'));
  });
  await page.waitForTimeout(1000);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 45000 });
  await page.goto('/broker');
  await expect(page.locator('.broker-owner-reports-card')).toBeVisible({ timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('nav[aria-label="Broker Workspace navigation"]')?.children.length);
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const measurements = [];
  for (const width of [1920, 1680, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(200);
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return { x: box.x, top: box.top, bottom: box.bottom, right: box.right };
      };
      return { width: innerWidth, stats: rect('.broker-owner-reports-card'),
        lower: rect('.broker-owner-subgrid'), activity: rect('.broker-owner-activity'),
        attention: rect('.broker-owner-attention') };
    });
    expect(geometry.lower.top - geometry.stats.bottom).toBeCloseTo(12, 0);
    expect(geometry.attention.top - geometry.activity.bottom).toBeCloseTo(12, 0);
    for (const box of [geometry.stats, geometry.lower, geometry.activity, geometry.attention]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width + 1);
    }
    if (width >= 1680) {
      expect(geometry.activity.top).toBeCloseTo(geometry.stats.top, 0);
      // Change only panel height to exercise the original row-coupling bug,
      // including sessions whose real activity list is empty.
      const activity = page.locator('.broker-owner-activity');
      await activity.evaluate(el => { el.style.minHeight = `${el.getBoundingClientRect().height + 180}px`; });
      const lower = await page.locator('.broker-owner-subgrid').boundingBox();
      expect(lower!.y).toBeCloseTo(geometry.lower.top, 0);
      await activity.evaluate(el => { el.style.minHeight = ''; });
    }
    measurements.push(geometry);
    const output = process.env.DIARY_E2E_OUTPUT;
    if (output) {
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: `${output}/broker-dashboard-${width}.png`, fullPage: true });
    }
  }
  if (process.env.DIARY_E2E_OUTPUT) fs.writeFileSync(`${process.env.DIARY_E2E_OUTPUT}/broker-dashboard-flow.json`, JSON.stringify(measurements, null, 2));
});
