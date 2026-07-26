import { expect, test, type Page } from '@playwright/test';

type Session = { token: string; page: Page };
type NearbyJob = { id: string; canQuote?: boolean; quoteWarning?: string | null; hasProposedPrice?: boolean; proposedPriceGbp?: number | null };

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

async function readAccessToken(page: Page) {
  const token = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.includes('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed.access_token === 'string' && parsed.access_token) return parsed.access_token;
        const currentSession = parsed.currentSession as Record<string, unknown> | undefined;
        if (currentSession && typeof currentSession.access_token === 'string' && currentSession.access_token) {
          return currentSession.access_token;
        }
      } catch {
        // continue
      }
    }
    return null;
  });

  if (!token) throw new Error('Missing driver access token in browser storage.');
  return token;
}

async function driverSession(page: Page, email: string, password: string): Promise<Session> {
  await login(page, email, password);
  const token = await readAccessToken(page);
  return { page, token };
}

async function apiJson<T>(session: Session, path: string, options: { method?: 'GET' | 'POST'; data?: unknown } = {}) {
  const response = await session.page.request.fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + session.token,
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    data: options.data,
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload: payload as T };
}

async function firstQuoteableJob(session: Session, predicate: (job: NearbyJob) => boolean = () => true) {
  const { response, payload } = await apiJson<{ jobs?: NearbyJob[]; error?: string }>(session, '/api/driver/mobile/nearby-jobs?limit=50');
  expect(response.status()).toBe(200);
  const jobs = payload.jobs ?? [];
  return jobs.find((job) => job.canQuote !== false && predicate(job)) ?? null;
}

test.describe('driver commercial bidding e2e', () => {
  test('individual driver approved -> can submit bid -> bid id is persisted', async ({ page }) => {
    const email = process.env.E2E_INDIVIDUAL_DRIVER_EMAIL ?? process.env.E2E_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_INDIVIDUAL_DRIVER_PASSWORD ?? process.env.E2E_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_INDIVIDUAL_DRIVER_EMAIL/PASSWORD (or E2E_DRIVER_EMAIL/PASSWORD).');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session);
    test.skip(!job, 'No quoteable jobs are currently available for this driver.');

    const amount = Number(job!.proposedPriceGbp ?? 250);
    const { response, payload } = await apiJson<{ success?: boolean; bidId?: string; error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount, message: 'Playwright e2e commercial bid' },
    });

    expect(response.status()).toBe(201);
    expect(payload.success).toBe(true);
    expect(typeof payload.bidId).toBe('string');

    const resources = await apiJson<{ resources?: { quotes?: Array<{ id?: string; job_id?: string }> } }>(session, '/api/driver/mobile/resources');
    expect(resources.response.status()).toBe(200);
    const matched = (resources.payload.resources?.quotes ?? []).find((quote) => quote.id === payload.bidId && quote.job_id === job!.id);
    expect(Boolean(matched)).toBe(true);
  });

  test('driver suspended -> API returns 403', async ({ page }) => {
    const email = process.env.E2E_SUSPENDED_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_SUSPENDED_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_SUSPENDED_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const result = await apiJson<{ error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: '00000000-0000-0000-0000-000000000000', amount: 100 },
    });

    expect(result.response.status()).toBe(403);
  });

  test('company driver with can_commercial_bid -> UI is not blocked and API accepts bid', async ({ page }) => {
    // Architecture: company_driver is a valid bidding entity.  can_commercial_bid
    // is an independent flag defaulting to TRUE for both owner_driver and
    // company_driver.  This test verifies that a company driver can reach the
    // bidding UI without a blocking message and that the API accepts their bid.
    // See supabase/migrations/20260726060000_canonical_driver_type_architecture.sql
    const email = process.env.E2E_COMPANY_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_COMPANY_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_COMPANY_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session);
    test.skip(!job, 'No quoteable jobs are currently available for company driver bidding assertion.');

    // Web UI: the blocking message must NOT appear for a company driver that has
    // can_commercial_bid = true (the canonical default).
    await page.goto(`/driver/loads/${job!.id}`);
    await expect(page.getByText('Your account type does not permit commercial bidding')).not.toBeVisible({ timeout: 10_000 });

    // API: bidding must succeed (201) or return 409 if a duplicate bid exists.
    const result = await apiJson<{ success?: boolean; bidId?: string; error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount: Number(job!.proposedPriceGbp ?? 250), message: 'Company driver marketplace bid' },
    });
    expect([201, 409]).toContain(result.response.status());
  });

  test('duplicate bid -> second submit returns 409', async ({ page }) => {
    const email = process.env.E2E_DUPLICATE_DRIVER_EMAIL ?? process.env.E2E_INDIVIDUAL_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_DUPLICATE_DRIVER_PASSWORD ?? process.env.E2E_INDIVIDUAL_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_DUPLICATE_DRIVER_EMAIL/PASSWORD or E2E_INDIVIDUAL_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session);
    test.skip(!job, 'No quoteable jobs are currently available for duplicate-bid test.');

    const amount = Number(job!.proposedPriceGbp ?? 275);
    const first = await apiJson<{ error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount, message: 'Duplicate bid test (first)' },
    });
    expect([201, 409]).toContain(first.response.status());

    const second = await apiJson<{ error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount, message: 'Duplicate bid test (second)' },
    });
    expect(second.response.status()).toBe(409);
  });

  test('proposed-price load -> driver sees proposed price, can accept or counter-offer, bid persists driver amount', async ({ page }) => {
    const email = process.env.E2E_FIXED_PRICE_DRIVER_EMAIL ?? process.env.E2E_INDIVIDUAL_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_FIXED_PRICE_DRIVER_PASSWORD ?? process.env.E2E_INDIVIDUAL_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_FIXED_PRICE_DRIVER_EMAIL/PASSWORD or E2E_INDIVIDUAL_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session, (candidate) => candidate.hasProposedPrice === true && Number(candidate.proposedPriceGbp ?? 0) > 0);
    test.skip(!job, 'No proposed-price quoteable load is currently available.');

    // Web UI: proposed price badge, pre-filled input, and counter-offer input are all present
    await page.goto(`/driver/loads/${job!.id}`);
    await expect(page.getByText(/proposed price/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="number"]')).toBeVisible({ timeout: 5_000 });

    // Accept proposed price via API — persists the driver's chosen amount (proposed price)
    const proposedAmount = Number(job!.proposedPriceGbp);
    const acceptResult = await apiJson<{ success?: boolean; bidId?: string; error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount: proposedAmount, message: 'Driver accepts proposed price' },
    });

    expect([201, 409]).toContain(acceptResult.response.status());
    if (acceptResult.response.status() === 201) {
      const resources = await apiJson<{ resources?: { quotes?: Array<{ id?: string; bid_price_gbp?: number | null; amount?: number | null }> } }>(session, '/api/driver/mobile/resources');
      expect(resources.response.status()).toBe(200);
      const saved = (resources.payload.resources?.quotes ?? []).find((quote) => quote.id === acceptResult.payload.bidId);
      // The persisted bid amount must equal what the driver submitted, not be forced to anything else
      expect(saved?.bid_price_gbp ?? saved?.amount).toBe(proposedAmount);
    }
  });

  test('proposed-price load -> driver submits higher counter-offer, actual amount is persisted', async ({ page }) => {
    const email = process.env.E2E_COUNTER_OFFER_DRIVER_EMAIL ?? process.env.E2E_INDIVIDUAL_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_COUNTER_OFFER_DRIVER_PASSWORD ?? process.env.E2E_INDIVIDUAL_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_COUNTER_OFFER_DRIVER_EMAIL/PASSWORD or E2E_INDIVIDUAL_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session, (candidate) => candidate.hasProposedPrice === true && Number(candidate.proposedPriceGbp ?? 0) > 0);
    test.skip(!job, 'No proposed-price quoteable load is currently available.');

    const counterAmount = Number(job!.proposedPriceGbp!) + 50;
    const result = await apiJson<{ success?: boolean; bidId?: string; error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount: counterAmount, message: 'Counter-offer higher than proposed' },
    });

    expect([201, 409]).toContain(result.response.status());
    if (result.response.status() === 201) {
      const resources = await apiJson<{ resources?: { quotes?: Array<{ id?: string; bid_price_gbp?: number | null; amount?: number | null }> } }>(session, '/api/driver/mobile/resources');
      expect(resources.response.status()).toBe(200);
      const saved = (resources.payload.resources?.quotes ?? []).find((quote) => quote.id === result.payload.bidId);
      // Must persist the driver's actual counter-offer, not the proposed price
      expect(saved?.bid_price_gbp ?? saved?.amount).toBe(counterAmount);
    }
  });

  test('proposed-price load -> driver submits lower counter-offer, actual amount is persisted', async ({ page }) => {
    const email = process.env.E2E_LOWER_COUNTER_DRIVER_EMAIL ?? process.env.E2E_INDIVIDUAL_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_LOWER_COUNTER_DRIVER_PASSWORD ?? process.env.E2E_INDIVIDUAL_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_LOWER_COUNTER_DRIVER_EMAIL/PASSWORD or E2E_INDIVIDUAL_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session, (candidate) => candidate.hasProposedPrice === true && Number(candidate.proposedPriceGbp ?? 0) > 10);
    test.skip(!job, 'No proposed-price quoteable load is currently available with price > £10.');

    const lowerAmount = Math.max(1, Number(job!.proposedPriceGbp!) - 30);
    const result = await apiJson<{ success?: boolean; bidId?: string; error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount: lowerAmount, message: 'Counter-offer lower than proposed' },
    });

    expect([201, 409]).toContain(result.response.status());
    if (result.response.status() === 201) {
      const resources = await apiJson<{ resources?: { quotes?: Array<{ id?: string; bid_price_gbp?: number | null; amount?: number | null }> } }>(session, '/api/driver/mobile/resources');
      expect(resources.response.status()).toBe(200);
      const saved = (resources.payload.resources?.quotes ?? []).find((quote) => quote.id === result.payload.bidId);
      // Must persist the driver's actual lower counter-offer, not the proposed price
      expect(saved?.bid_price_gbp ?? saved?.amount).toBe(lowerAmount);
    }
  });

  test('driver without company_id -> bid persists with company_id null', async ({ page }) => {
    const email = process.env.E2E_NO_COMPANY_DRIVER_EMAIL ?? '';
    const password = process.env.E2E_NO_COMPANY_DRIVER_PASSWORD ?? '';
    test.skip(!email || !password, 'Set E2E_NO_COMPANY_DRIVER_EMAIL/PASSWORD.');

    const session = await driverSession(page, email, password);
    const job = await firstQuoteableJob(session);
    test.skip(!job, 'No quoteable jobs are currently available for no-company driver.');

    const submit = await apiJson<{ success?: boolean; bidId?: string; error?: string }>(session, '/api/driver/mobile/bids', {
      method: 'POST',
      data: { jobId: job!.id, amount: Number(job!.proposedPriceGbp ?? 240), message: 'No-company driver quote' },
    });

    expect([201, 409]).toContain(submit.response.status());

    const resources = await apiJson<{ resources?: { quotes?: Array<{ id?: string; company_id?: string | null }> } }>(session, '/api/driver/mobile/resources');
    expect(resources.response.status()).toBe(200);
    const matched = (resources.payload.resources?.quotes ?? []).find((quote) => quote.id === submit.payload.bidId);
    if (submit.response.status() === 201) {
      expect(matched?.company_id ?? null).toBeNull();
    }
  });
});
