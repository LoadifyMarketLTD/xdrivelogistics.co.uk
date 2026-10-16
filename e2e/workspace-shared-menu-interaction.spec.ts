import { expect, test } from '@playwright/test';

// Exercises the real shared React menu in the existing development-only fixture.
// This is UI behaviour/geometry evidence, not an authenticated business-flow test.
const roles = ['owner-driver', 'driver', 'customer', 'broker', 'carrier', 'fleet', 'operations'] as const;
const viewports = [
  { width: 1649, height: 928 }, { width: 1440, height: 900 },
  { width: 1280, height: 800 }, { width: 1024, height: 768 },
  { width: 768, height: 1024 }, { width: 390, height: 844 },
];

test.describe('shared operational menu: Owner Driver presentation and real keyboard behaviour', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Requires the existing development-only fixture.');

  for (const role of roles) {
    for (const viewport of viewports) {
      test(`${role} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize(viewport);
        const response = await page.goto(`/visual-fixture/workspace/${role}`, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        const shell = page.locator('.top-workspace-shell');
        await expect(shell).toBeVisible();
        // The fixture is server-rendered. Wait for the real React shell to
        // hydrate before the first interactive click; identity text is now
        // deterministic at SSR time and is not a hydration signal.
        await expect(shell).toHaveAttribute('data-hydrated', 'true');
        const trigger = shell.locator('.top-workspace-nav__trigger').last();
        await expect(trigger).toBeVisible();
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const menu = shell.locator('[role="menu"]');
        await expect(menu).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const box = await menu.boundingBox();
        expect(box).not.toBeNull();
        expect(Math.abs(box!.width - (viewport.width <= 768 ? viewport.width - 16 : 248))).toBeLessThanOrEqual(1);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        const items = menu.getByRole('menuitem');
        expect(await items.count()).toBeGreaterThan(0);
        expect(await menu.locator('.top-workspace-nav__menu-icon').evaluateAll(
          (icons) => icons.every((icon) => !(icon.textContent ?? '').trim()),
        )).toBe(true);
        await items.first().focus();
        await page.keyboard.press('End');
        await expect(items.last()).toBeFocused();
        await page.keyboard.press('Home');
        await expect(items.first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await trigger.press('ArrowDown');
        await expect(menu).toBeVisible();
        await expect(menu.getByRole('menuitem').first()).toBeFocused();
        await page.locator('.top-workspace-shell__header').click({ position: { x: 2, y: 2 } });
        await expect(menu).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
});