import { expect, test } from '@playwright/test';
import { COMPANY, mockWorkspace } from './helpers/workspaceRecoveryFixtures';

test.use({ serviceWorkers: 'block' });
test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Local-only mocked visual fixture.');

const roles = ['carrier', 'customer', 'broker', 'owner', 'dispatcher'] as const;
const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'tablet', width: 1024, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

for (const role of roles) {
  test(`${role}: Post Load fills the authorised workspace shell`, async ({ page }, testInfo) => {
    // A cold local Next.js compile can outlast the generic 30-second test timeout.
    // Keep every visual, role and error assertion; only allow fixture startup time.
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await mockWorkspace(page, role);

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/visual-fixture/workspace-recovery/${role}?screen=post-load`, { waitUntil: 'domcontentloaded' });

      const form = page.locator('.xdrive-post-load-form');
      await expect(form).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('fixture-user')).toHaveText(COMPANY, { timeout: 15_000 });

      const geometry = await form.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement?.getBoundingClientRect();
        const panels = Array.from(element.querySelectorAll(':scope > section')).map((panel) =>
          panel.getBoundingClientRect().width,
        );
        const style = window.getComputedStyle(element);
        return {
          formWidth: rect.width,
          parentWidth: parent?.width ?? 0,
          panels,
          cssWidth: style.width,
          minWidth: style.minWidth,
          justifySelf: style.justifySelf,
          alignSelf: style.alignSelf,
        };
      });

      expect(geometry.parentWidth, `${role}/${viewport.label}: parent width`).toBeGreaterThan(0);
      expect(
        geometry.formWidth / geometry.parentWidth,
        `${role}/${viewport.label}: form must not collapse into a narrow left rail`,
      ).toBeGreaterThan(0.88);
      expect(geometry.formWidth, `${role}/${viewport.label}: usable form width`).toBeGreaterThan(
        viewport.width <= 430 ? 320 : viewport.width <= 1024 ? 700 : 1000,
      );
      expect(
        geometry.panels.every((width) => width >= geometry.formWidth - 2),
        `${role}/${viewport.label}: every Post Load panel spans the shared form`,
      ).toBe(true);
      expect(geometry.minWidth).toBe('0px');
      expect(['stretch', 'auto']).toContain(geometry.justifySelf);
      expect(['stretch', 'auto']).toContain(geometry.alignSelf);

      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(pageOverflow, `${role}/${viewport.label}: no page-level horizontal overflow`).toBe(false);

      await page.screenshot({
        path: testInfo.outputPath(`post-load-${role}-${viewport.label}.png`),
        fullPage: true,
      });
    }

    expect(pageErrors, `${role}: no hydration or uncaught runtime errors at any viewport`).toEqual([]);
    if (role === 'dispatcher') {
      await expect(page.getByRole('button', { name: 'POST LOAD', exact: true })).toBeVisible();
    }
  });
}
