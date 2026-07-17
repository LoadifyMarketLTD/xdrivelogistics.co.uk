import { test, expect, type Page } from '@playwright/test';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? '';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? '';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

async function getAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as {
          access_token?: string;
          currentSession?: { access_token?: string };
          session?: { access_token?: string };
        };

        if (typeof parsed.access_token === 'string' && parsed.access_token.length > 0) {
          return parsed.access_token;
        }
        if (typeof parsed.currentSession?.access_token === 'string' && parsed.currentSession.access_token.length > 0) {
          return parsed.currentSession.access_token;
        }
        if (typeof parsed.session?.access_token === 'string' && parsed.session.access_token.length > 0) {
          return parsed.session.access_token;
        }
      } catch {
        continue;
      }
    }

    return null;
  });
}

test.describe('Super Admin support workflows runtime validation', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Set E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD (or fallback E2E_ADMIN_*)');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('tickets view loads canonical support_tickets data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/support?section=tickets') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/support/tickets');
    await expect(page.locator('h1')).toContainText(/support tickets/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { section?: string; rows?: unknown[]; summary?: Record<string, unknown> };
    expect(body.section).toBe('tickets');
    expect(Array.isArray(body.rows)).toBeTruthy();
    expect(body.summary).toBeTruthy();
  });

  test('complaints view loads complaints workflow data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/support?section=complaints') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/support/complaints');
    await expect(page.locator('h1')).toContainText(/complaints/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { section?: string; rows?: unknown[]; summary?: Record<string, unknown> };
    expect(body.section).toBe('complaints');
    expect(Array.isArray(body.rows)).toBeTruthy();
    expect(body.summary).toBeTruthy();
  });

  test('disputes view loads disputes workflow data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/super-admin/support?section=disputes') && res.request().method() === 'GET',
    );

    await page.goto('/super-admin/support/disputes');
    await expect(page.locator('h1')).toContainText(/disputes/i);

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { section?: string; rows?: unknown[]; summary?: Record<string, unknown> };
    expect(body.section).toBe('disputes');
    expect(Array.isArray(body.rows)).toBeTruthy();
    expect(body.summary).toBeTruthy();
  });

  test('owner can create support ticket via API and retrieve it in tickets feed', async ({ page }) => {
    const token = await getAccessToken(page);
    expect(token, 'Expected authenticated owner session token in localStorage').toBeTruthy();

    const subject = `E2E_FR002_${Date.now()}`;
    const createResponse = await page.request.post('/api/super-admin/support', {
      headers: {
        authorization: ['Bearer', token ?? ''].join(' '),
      },
      data: {
        subject,
        category: 'operations',
        priority: 'medium',
        description: 'E2E support workflow validation ticket',
      },
    });
    expect(createResponse.status()).toBe(201);

    const createdBody = (await createResponse.json()) as { ticket?: { id?: string; subject?: string } };
    expect(createdBody.ticket?.subject).toBe(subject);

    const listResponse = await page.request.get('/api/super-admin/support?section=tickets&limit=250', {
      headers: {
        authorization: ['Bearer', token ?? ''].join(' '),
      },
    });
    expect(listResponse.ok()).toBeTruthy();

    const listBody = (await listResponse.json()) as { section?: string; rows?: Array<{ subject?: string }> };
    expect(listBody.section).toBe('tickets');
    expect(listBody.rows?.some((row) => row.subject === subject)).toBeTruthy();
  });
});
