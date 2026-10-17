import { expect, type Page } from '@playwright/test';

export async function loginWithCredentials(page: Page, email: string, password: string) {
  if (!email || !password) throw new Error('Missing E2E login credentials.');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(passwordInput).toBeVisible({ timeout: 15_000 });

    // Local Next.js can render the form before React has attached its event
    // handlers. Wait briefly for hydration when possible, then retry the whole
    // login flow if the click does not navigate.
    await page.waitForFunction(() => {
      const form = document.querySelector('form');
      if (!form) return false;
      return Object.keys(form).some((key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'));
    }, undefined, { timeout: 15_000 }).catch(() => null);

    await emailInput.fill(email);
    await passwordInput.fill(password);
    const submit = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in"), button:has-text("Login")').first();
    await expect(submit).toBeVisible({ timeout: 10_000 });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    const navigated = await page.waitForURL(
      (url) => !url.pathname.startsWith('/login'),
      { timeout: 10_000, waitUntil: 'domcontentloaded' },
    ).then(() => true).catch(() => false);

    if (navigated) return;
    if (attempt < 3) await page.waitForTimeout(500);
  }

  throw new Error('Login did not leave /login after 3 attempts.');
}
