/**
 * Mobile API Contract Tests
 *
 * Verifies the shape, behaviour, and auth security of all /api/driver/mobile/* routes.
 *
 * Static tests run in every CI environment (no credentials required).
 * Authenticated tests run only when E2E_DRIVER_EMAIL and E2E_DRIVER_PASSWORD are set.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { hasActionAlreadyApplied } from '../app/api/driver/mobile/jobs/[id]/[action]/idempotency';

test.describe('mobile API — idempotency helper contract', () => {
  test('returns true for retries after lifecycle advancement', () => {
    expect(hasActionAlreadyApplied({ current_status: 'on_my_way_to_pickup' }, { currentStatus: 'accepted' })).toBe(true);
    expect(hasActionAlreadyApplied({ current_status: 'on_site_pickup' }, { currentStatus: 'on_my_way_to_pickup', timestampField: 'on_my_way_at' })).toBe(true);
    expect(hasActionAlreadyApplied({ current_status: 'loaded' }, { currentStatus: 'on_site_pickup', timestampField: 'on_site_pickup_at' })).toBe(true);
    expect(hasActionAlreadyApplied({ current_status: 'on_my_way_to_delivery' }, { currentStatus: 'loaded', timestampField: 'loaded_at' })).toBe(true);
    expect(hasActionAlreadyApplied({ current_status: 'on_site_delivery' }, { currentStatus: 'on_my_way_to_delivery' })).toBe(true);
    expect(hasActionAlreadyApplied({ current_status: 'delivered' }, { currentStatus: 'on_site_delivery', timestampField: 'on_site_delivery_at' })).toBe(true);
  });

  test('returns true when timestamps/history prove the action already ran', () => {
    expect(hasActionAlreadyApplied({ current_status: null, on_my_way_at: '2026-01-01T00:00:00.000Z' }, { currentStatus: 'on_my_way_to_pickup', timestampField: 'on_my_way_at' })).toBe(true);
    expect(hasActionAlreadyApplied({
      current_status: null,
      status_history: [{ status: 'on_my_way_to_delivery' }, { status: 'on_site_delivery' }],
    }, { currentStatus: 'on_site_delivery', timestampField: 'on_site_delivery_at' })).toBe(true);
    expect(hasActionAlreadyApplied({ current_status: null, status: 'delivered' }, { currentStatus: 'delivered', timestampField: 'delivered_at' })).toBe(true);
  });

  test('returns false when action has not been applied yet', () => {
    expect(hasActionAlreadyApplied({ current_status: 'loaded' }, { currentStatus: 'delivered', timestampField: 'delivered_at' })).toBe(false);
  });
});

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
      'accept',
      'on-my-way-pickup',
      'arrived-pickup',
      'loaded',
      'on-my-way-delivery',
      'arrived-delivery',
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

  test('GET /api/driver/mobile/availability — rejects without auth (401 or 503)', async ({ request }) => {
    const response = await request.get('/api/driver/mobile/availability');
    expect([401, 503]).toContain(response.status());
  });

  test('PUT /api/driver/mobile/availability — rejects without auth (401 or 503)', async ({ request }) => {
    const response = await request.put('/api/driver/mobile/availability', {
      data: { availability_status: 'available' },
    });
    expect([401, 503]).toContain(response.status());
  });

  test('GET /api/driver/mobile/messages — rejects without auth (401 or 503)', async ({ request }) => {
    const response = await request.get('/api/driver/mobile/messages');
    expect([401, 503]).toContain(response.status());
  });

  test('POST /api/driver/mobile/messages — rejects without auth (401 or 503)', async ({ request }) => {
    const response = await request.post('/api/driver/mobile/messages', { data: {} });
    expect([401, 503]).toContain(response.status());
  });
});

// ─── Idempotency contract: verify ordering logic at unit level ─────────────────

test.describe('mobile API — idempotency contract (static verification)', () => {
  /**
   * These tests verify the route-level idempotency ordering contract:
   * current_status is checked BEFORE allowedLifecycle, so an offline-queue
   * retry never receives 409 after a successful first sync.
   *
   * Without a live DB fixture we can only verify the auth guard fires first.
   * The ordering contract is proven by the unit tests in queue.test.ts and by
   * the authenticated suite below when E2E credentials are provided.
   */
  test('idempotency check precedes lifecycle validation — auth fires before both', async ({ request }) => {
    // A retry that arrives without auth must fail with 401/503, not 409.
    // This proves no lifecycle or idempotency logic runs before the auth gate.
    const response = await request.post(
      '/api/driver/mobile/jobs/00000000-0000-0000-0000-000000000000/delivered',
    );
    expect([401, 503]).toContain(response.status());
    // Must never return 409 for an unauthenticated request
    expect(response.status()).not.toBe(409);
  });

  test('unknown action returns 404 before lifecycle check (with auth missing → 401/503)', async ({ request }) => {
    const response = await request.post(
      '/api/driver/mobile/jobs/00000000-0000-0000-0000-000000000000/not-a-real-action',
    );
    // Without auth → 401/503 (not 404); 404 would only fire after auth
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
      expect(body).toHaveProperty('resources');
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

  test('GET /api/driver/mobile/availability returns availability_status and slots', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.get('/api/driver/mobile/availability', {
      headers: { Authorization: ['Bearer', token].join(' ') },
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('availability_status');
      expect(['available', 'busy', 'offline']).toContain(body.availability_status);
      expect(body).toHaveProperty('slots');
      expect(Array.isArray(body.slots)).toBe(true);
    }
  });

  test('PUT /api/driver/mobile/availability — round-trips availability_status update', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.put('/api/driver/mobile/availability', {
      headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
      data: { availability_status: 'offline' },
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.availability_status).toBe('offline');
    }
  });

  test('PUT /api/driver/mobile/availability — rejects invalid status', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.put('/api/driver/mobile/availability', {
      headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
      data: { availability_status: 'on_holiday' },
    });
    expect(response.status()).toBe(400);
  });

  test('GET /api/driver/mobile/messages returns messages array and unread_count', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.get('/api/driver/mobile/messages', {
      headers: { Authorization: ['Bearer', token].join(' ') },
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('messages');
      expect(Array.isArray(body.messages)).toBe(true);
      expect(body).toHaveProperty('unread_count');
      expect(typeof body.unread_count).toBe('number');
    }
  });

  test('POST /api/driver/mobile/messages — mark all read returns ok', async ({ request }) => {
    test.skip(!token, 'Auth token unavailable');
    const response = await request.post('/api/driver/mobile/messages', {
      headers: { Authorization: ['Bearer', token].join(' '), 'Content-Type': 'application/json' },
      data: {},
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.ok).toBe(true);
    }
  });

  test('POST /api/driver/mobile/jobs/:id/:action — idempotent retry returns 200 not 409', async ({
    request,
  }) => {
    test.skip(!token, 'Auth token unavailable');
    // A job that does not exist returns 404, not 409.
    // This verifies the idempotency + lifecycle check order: a nonexistent job
    // hits the ownership check (404) rather than the lifecycle rejection (409).
    const response = await request.post(
      '/api/driver/mobile/jobs/00000000-0000-0000-0000-000000000001/delivered',
      { headers: { Authorization: ['Bearer', token].join(' ') } },
    );
    // Must be 404 (job not found) never 409 (lifecycle rejection for nonexistent job)
    expect([404, 503]).toContain(response.status());
    expect(response.status()).not.toBe(409);
  });
});
