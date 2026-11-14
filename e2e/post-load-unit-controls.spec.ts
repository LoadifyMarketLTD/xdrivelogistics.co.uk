import { test, expect } from '@playwright/test';
import { mockWorkspace } from './helpers/workspaceRecoveryFixtures';

test.use({ serviceWorkers: 'block' });
test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Use only local mocked visual fixture.');

test('unit selectors convert values without resetting the Post Load fields', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockWorkspace(page, 'customer');
  await page.goto('/visual-fixture/workspace-recovery/customer?screen=post-load', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.xdrive-post-load-form')).toBeVisible({ timeout: 30_000 });

  const weight = page.getByRole('spinbutton', { name: 'Gross Load Weight' });
  const weightUnit = page.getByRole('combobox', { name: 'Weight unit' });
  const dimensionUnit = page.getByRole('combobox', { name: 'Dimension unit' });
  await expect(weightUnit).toHaveValue('kg');
  await expect(dimensionUnit).toHaveValue('cm');
  await weight.fill('100');
  await weightUnit.selectOption('lb');
  expect(Number(await weight.inputValue())).toBeCloseTo(220.4623, 3);
  await weightUnit.selectOption('t');
  expect(Number(await weight.inputValue())).toBeCloseTo(0.1, 4);
  await weightUnit.selectOption('kg');
  expect(Number(await weight.inputValue())).toBe(100);

  const length = page.getByRole('spinbutton', { name: 'Length (cm)' });
  await length.fill('120');
  await dimensionUnit.selectOption('m');
  expect(Number(await page.getByRole('spinbutton', { name: 'Length (m)' }).inputValue())).toBeCloseTo(1.2, 4);
  await dimensionUnit.selectOption('ft');
  expect(Number(await page.getByRole('spinbutton', { name: 'Length (ft)' }).inputValue())).toBeCloseTo(3.937, 2);
  await dimensionUnit.selectOption('cm');
  expect(Number(await page.getByRole('spinbutton', { name: 'Length (cm)' }).inputValue())).toBe(120);
  expect(errors).toEqual([]);
});

test('mobile field selectors remain usable without horizontal page overflow', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page, 'customer');
  await page.goto('/visual-fixture/workspace-recovery/customer?screen=post-load', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('combobox', { name: 'Weight unit' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('combobox', { name: 'Weight unit' }).selectOption('t');
  await page.getByRole('combobox', { name: 'Dimension unit' }).selectOption('in');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
