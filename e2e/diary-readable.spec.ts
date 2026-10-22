import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Run against a local dev server with E2E_VISUAL_FIXTURE=true.
// This tests shared rendering, not authenticated role data or permissions.
for (const width of [1680, 1024, 390]) {
  test(`shared Diary remains readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/visual-fixture/diary');
    const card = page.locator('.xdrive-cx-diary-card').first();
    await expect(card).toBeVisible();
    for (const selector of ['.xdrive-cx-diary-card__route strong', '.cx-diary-datetime > strong', '.xdrive-cx-diary-card__band']) {
      await expect(card.locator(selector).first()).toHaveCSS('font-size', '16px');
    }
    await expect(card.locator('.xdrive-cx-diary-card__footer > button').nth(1)).toHaveCSS('font-size', '14px');
    await expect(page.locator('.cx-diary-filter-rail input:not([type=checkbox]):not([type=radio])').first()).toHaveCSS('font-size', '14px');
    const bounds = await card.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const image = await card.locator('img').boundingBox();
    expect(image!.width).toBe(46);
    expect(image!.height).toBe(20);
    await card.getByRole('button', { name: 'Expand booking', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Collapse booking', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await card.getByRole('button', { name: 'Collapse booking', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Expand booking', exact: true })).toHaveAttribute('aria-expanded', 'false');
  });
}

// Compare the same shared card under each role's actual CSS. This does not
// impersonate users or certify authenticated page data.
test('shared card typography and geometry match under seven workspace style contexts', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1000 });
  const contexts = [
    ['carrier', 'admin', ''], ['fleet manager', 'admin', ''], ['dispatcher', 'admin', ''],
    ['customer', 'customer', 'xdrive-customer-workspace'], ['broker', 'broker', 'xdrive-broker-workspace'],
    ['owner driver', 'driver', 'xdrive-driver-workspace'], ['employed driver', 'driver', 'xdrive-driver-workspace'],
  ];
  let baseline: unknown;
  for (const [role, directory, extraClass] of contexts) {
    await page.goto('/visual-fixture/diary');
    const layoutPath = path.join(process.cwd(), 'app', directory, 'layout.tsx');
    const layout = readFileSync(layoutPath, 'utf8');
    for (const match of layout.matchAll(/import ['"]([^'"]+\.css)['"]/g)) {
      await page.addStyleTag({ content: readFileSync(path.resolve(path.dirname(layoutPath), match[1]), 'utf8') });
    }
    if (directory === 'driver') {
      await page.addStyleTag({ content: readFileSync(path.join(process.cwd(), 'app/driver/history/diary-exchange.css'), 'utf8') });
    }
    await page.locator('.xdrive-workspace-measured').first().evaluate((element, className) => { if (className) element.classList.add(className); }, extraClass);
    const card = page.locator('.xdrive-cx-diary-card').first();
    await expect(card).toBeVisible();
    const presentation = await card.evaluate(element => {
      const selectors = ['.xdrive-cx-diary-card__main', '.xdrive-cx-diary-card__route strong', '.cx-diary-datetime strong', '.xdrive-cx-diary-card__band', '.xdrive-cx-diary-card__footer > button'];
      return selectors.map(selector => {
        const node = element.querySelector(selector)!;
        const style = getComputedStyle(node);
        const bounds = node.getBoundingClientRect();
        return { font: style.fontSize, line: style.lineHeight, width: bounds.width, height: bounds.height };
      });
    });
    if (!baseline) baseline = presentation;
    expect(presentation, role).toEqual(baseline);
  }
});
