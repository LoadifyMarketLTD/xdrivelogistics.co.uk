# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public.spec.ts >> Public pages >> request-quote page loads
- Location: e2e/public.spec.ts:19:3

# Error details

```
Error: page.goto: Error resolving “www.xdrivelogistics.co.uk”: Temporary failure in name resolution
Call log:
  - navigating to "http://127.0.0.1:3000/request-quote", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // ── Public pages ─────────────────────────────────────────────────────────────
  4  | 
  5  | test.describe('Public pages', () => {
  6  |   test('homepage loads and shows CTA', async ({ page }) => {
  7  |     await page.goto('/');
  8  |     await expect(page).toHaveTitle(/XDrive/i);
  9  |     // At least one visible CTA button
  10 |     const cta = page.locator('a[href="/register"], button').filter({ hasText: /get started|register|book/i }).first();
  11 |     await expect(cta).toBeVisible();
  12 |   });
  13 | 
  14 |   test('homepage has navigation links', async ({ page }) => {
  15 |     await page.goto('/');
  16 |     await expect(page.locator('nav, header')).toBeVisible();
  17 |   });
  18 | 
  19 |   test('request-quote page loads', async ({ page }) => {
> 20 |     await page.goto('/request-quote');
     |                ^ Error: page.goto: Error resolving “www.xdrivelogistics.co.uk”: Temporary failure in name resolution
  21 |     await expect(page.locator('form, [data-testid="quote-form"]')).toBeVisible();
  22 |   });
  23 | 
  24 |   test('login page loads', async ({ page }) => {
  25 |     await page.goto('/login');
  26 |     await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  27 |   });
  28 | });
  29 | 
  30 | // ── Auth redirect ─────────────────────────────────────────────────────────────
  31 | 
  32 | test.describe('Auth redirects', () => {
  33 |   test('unauthenticated /admin redirects to login', async ({ page }) => {
  34 |     await page.goto('/admin');
  35 |     // Should end up at a login/auth page
  36 |     await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
  37 |     await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  38 |   });
  39 | 
  40 |   test('unauthenticated /driver/jobs redirects to login', async ({ page }) => {
  41 |     await page.goto('/driver/jobs');
  42 |     await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
  43 |     await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  44 |   });
  45 | 
  46 |   test('unauthenticated /super-admin redirects to login', async ({ page }) => {
  47 |     await page.goto('/super-admin');
  48 |     await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
  49 |     await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  50 |   });
  51 | 
  52 |   test('unauthenticated /customer redirects to login', async ({ page }) => {
  53 |     await page.goto('/customer');
  54 |     await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
  55 |     await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  56 |   });
  57 | });
  58 | 
```