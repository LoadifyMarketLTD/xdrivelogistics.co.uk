/**
 * Mobile API Contract Tests
 *
 * Verifies the shape, behaviour, and auth security of all /api/driver/mobile/* routes.
 *
 * Static tests run in every CI environment (no credentials required).
 * Authenticated tests run only when E2E_DRIVER_EMAIL and E2E_DRIVER_PASSWORD are set.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

// ─── Static endpoint shape tests ─────────────────────────────────────────────

test.describe('mobile API — static shape contract', () => {
  test('GET /api/driver/mobile/config returns expected shape or 503', async ({ request }) => {
    const response = await request.get('/api/driver/mobile/config');
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      // Must expose Supabase URL and anon key at minimum
      expect(body).toHaveProperty('supabaseUrl');
      expect(body).toHaveProperty('supabaseAnonKey');
    }
  });

  test('POST /api/driver/mobile/jobs/:id/:action — known actions reject with 401 or 503', async ({ request }) => {
    const ACTIONS = [
      'on-my-way-pickup',
      'arrived-at-pickup',
      'loading',
      'loaded',
      'on-my-way-delivery',
      'arrived-at-delivery',
      'delivered',
    ];
    for (const action of ACTIONS) {
      const path = `/api/driver/mobile/jobs/00000000-0000-0000-0000-000000000000/${action}`;
      const response = await request.post(path);
      expect(
        [401, 503],
        `Expected ${path} to reject unauthenticated, got ${response.status()}`,
      ).toContain(response.status());
    }
  });

  test('POST /api/driver/mobile/jobs/:id/pod — rejects without auth (401 or 503)', async ({ request }) => {
    const response = await request.post(
      '/api/driver/mobile/jobs/00000000-0000-0000-0000-000000000000/pod',
    );
    expect([401, 503]).toContain(response.status());
  });
});

// ─── Authenticated contract tests ─────────────────────────────────────────────

const DRIVER_EMAIL = process.env.E2E_DRIVER_EMAIL ?? '';
const DRIVER_PASSWORD = process.env.E2E_DRIVER_PASSWORD ?? '';
const RUN_AUTHED = Boolean(DRIVER_EMAIL && DRIVER_PASSWORD);

// Helper: sign in via the web login form and return the auth cookies / storage state.
async function signInAndGetToken(
  request: APIRequestContext,
): Promise<string | null> {
  // Retrieve Supabase config from the mobile config endpoint.
  const configRes = await request.get('/api/driver/mobile/config');
  if (configRes.status() !== 200) return null;
  const { supabaseUrl, supabaseAnonKey } = await configRes.json();

  // Sign in via Supabase REST auth API directly.
  const authRes = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    data: { email: DRIVER_EMAIL, password: DRIVER_PASSWORD },
  });

  if (authRes.status() !== 200) return null;
  const { access_token } = await authRes.json();
  return access_token ?? null;
}

test.describe('mobile API — authenticated contract', () => {
  test.skip(!RUN_AUTHED, 'Set E2E_DRIVER_EMAIL and E2E_DRIVER_PASSWORD to run authenticated tests');

  let token: string | null = null;

  test.beforeAll(async ({ request }) => {
    token = await signInAndGetToken(request);
  });

  test('GET /api/driver/mobile/resources returns expected top-level keys', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.get('/api/driver/mobile/resources', {
      headers: { Authorization: ['Bearer', token].join(' ') },
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('profile');
      expect(body).toHaveProperty('bids');
      expect(body).toHaveProperty('documents');
      expect(body).toHaveProperty('invoices');
    }
  });

  test('GET /api/driver/mobile/nearby-jobs returns array of jobs', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.get('/api/driver/mobile/nearby-jobs', {
      headers: { Authorization: ['Bearer', token].join(' ') },
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body.jobs ?? body)).toBe(true);
    }
  });

  test('GET /api/driver/mobile/jobs returns object with jobs array', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.get('/api/driver/mobile/jobs', {
      headers: { Authorization: ['Bearer', token].join(' ') },
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('jobs');
      expect(Array.isArray(body.jobs)).toBe(true);
    }
  });

  test('POST /api/driver/mobile/jobs/:id/:action — idempotent retry returns 200', async ({
    request: _request,
  }) => {
    // This test verifies the server-side idempotency gate added in Phase 0.
    // It can only run if a real job ID is available — skip for now with a note.
    // TODO: replace with a fixture job ID when seeded test data is available.
    test.skip(true, 'Requires a fixture job ID in the correct status — deferred to Phase 4 setup');
  });
});
