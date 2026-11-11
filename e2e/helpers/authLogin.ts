import { expect, type Page } from '@playwright/test';

export async function loginWithCredentials(page: Page, email: string, password: string) {
  if (!email || !password) throw new Error('Missing E2E login credentials.');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // The login form can redirect to an existing valid session before the test fills it.
    if (!new URL(page.url()).pathname.startsWith('/login')) return;
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(passwordInput).toBeVisible({ timeout: 15_000 });

    // Production can paint the login form before the client handler is ready.
    // Do not wait on private React keys: they are not a stable hydration signal
    // and can consume the entire Playwright test timeout. Give the client a
    // short settle window, then rely on navigation as the real success signal.
    await page.waitForTimeout(1_250);
    if (!new URL(page.url()).pathname.startsWith('/login')) return;

    // If an asynchronous redirect removes the form, treat arrival at the
    // authenticated route as success instead of hanging in locator.fill().
    try {
      await emailInput.fill(email, { timeout: 5_000 });
      await passwordInput.fill(password, { timeout: 5_000 });
    } catch (error) {
      if (!new URL(page.url()).pathname.startsWith('/login')) return;
      throw error;
    }
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
