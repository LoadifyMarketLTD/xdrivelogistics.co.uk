/**
 * Regression tests for GET /api/super-admin/settings?section=feature-flags
 * and PATCH /api/super-admin/settings (section=feature-flags).
 *
 * Key contract assertions:
 *  - GET reads `is_enabled` from platform_feature_flags (not `enabled`)
 *  - PATCH upserts `is_enabled` to platform_feature_flags (not `enabled`)
 *  - Response model exposes `enabled` to the UI (translation layer is correct)
 *  - FLAG_DEFINITIONS keys match the DB-seeded canonical set
 *  - Unknown keys are rejected by PATCH
 *  - Stale keys (driver_tracking, public_quote_requests, compliance_gating) are
 *    not present in the definition set and are rejected by PATCH
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  profileRole: 'owner' as string,
  flagRows: [] as Array<Record<string, unknown>>,
  upsertError: null as { message: string } | null,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: mocks.getBearerToken,
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
  supabaseAdmin: {
    from: mocks.from,
  },
}));

import { GET, PATCH } from '../app/api/super-admin/settings/route';

const getRequest = (url: string) =>
  new NextRequest(url, { method: 'GET', headers: { Authorization: '******' } });

const patchRequest = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: '******' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.flagRows = [];
  mocks.upsertError = null;
  mocks.profileRole = 'owner';

  mocks.getBearerToken.mockReturnValue('test-token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'owner-user-1' } },
    error: null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { role: mocks.profileRole }, error: null }),
          }),
        }),
      };
    }
    if (table === 'platform_feature_flags') {
      return {
        select: () =>
          Promise.resolve({ data: mocks.flagRows, error: null }),
        upsert: () =>
          Promise.resolve({ data: null, error: mocks.upsertError }),
      };
    }
    return {};
  });
});

describe('GET ?section=feature-flags', () => {
  it('reads is_enabled from DB and exposes enabled in response', async () => {
    mocks.flagRows = [
      { key: 'exchange_marketplace', is_enabled: false },
      { key: 'notifications', is_enabled: true },
    ];

    const res = await GET(
      getRequest('http://localhost/api/super-admin/settings?section=feature-flags')
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { flags: Array<{ key: string; enabled: boolean }> };

    const exchange = body.flags.find((f) => f.key === 'exchange_marketplace');
    expect(exchange?.enabled).toBe(false);

    const notif = body.flags.find((f) => f.key === 'notifications');
    expect(notif?.enabled).toBe(true);
  });

  it('falls back to definition default when key is not yet persisted in DB', async () => {
    mocks.flagRows = [];

    const res = await GET(
      getRequest('http://localhost/api/super-admin/settings?section=feature-flags')
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { flags: Array<{ key: string; enabled: boolean }> };

    const stripe = body.flags.find((f) => f.key === 'stripe_billing_future_phase');
    expect(stripe?.enabled).toBe(false);

    const exchange = body.flags.find((f) => f.key === 'exchange_marketplace');
    expect(exchange?.enabled).toBe(true);
  });

  it('includes all 12 DB-canonical flag keys', async () => {
    mocks.flagRows = [];

    const res = await GET(
      getRequest('http://localhost/api/super-admin/settings?section=feature-flags')
    );
    const body = await res.json() as { flags: Array<{ key: string }> };
    const keys = body.flags.map((f) => f.key).sort();

    const expected = [
      'audit_logging',
      'bid_acceptance_workflow',
      'broker_carrier_network',
      'company_suspension',
      'dispute_filing',
      'document_review',
      'driver_mobile_app',
      'exchange_marketplace',
      'invoice_generation',
      'notifications',
      'pod_capture',
      'stripe_billing_future_phase',
    ].sort();

    expect(keys).toEqual(expected);
  });

  it('does not include stale flags removed from the canonical set', async () => {
    mocks.flagRows = [];

    const res = await GET(
      getRequest('http://localhost/api/super-admin/settings?section=feature-flags')
    );
    const body = await res.json() as { flags: Array<{ key: string }> };
    const keys = body.flags.map((f) => f.key);

    expect(keys).not.toContain('driver_tracking');
    expect(keys).not.toContain('public_quote_requests');
    expect(keys).not.toContain('compliance_gating');
  });

  it('returns 403 when caller is not owner role', async () => {
    mocks.profileRole = 'company_admin';

    const res = await GET(
      getRequest('http://localhost/api/super-admin/settings?section=feature-flags')
    );
    expect(res.status).toBe(403);
  });
});

describe('PATCH section=feature-flags', () => {
  it('upserts is_enabled (not enabled) to platform_feature_flags', async () => {
    let capturedUpsertRows: Array<Record<string, unknown>> = [];
    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { role: 'owner' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'platform_feature_flags') {
        return {
          upsert: (rows: Array<Record<string, unknown>>) => {
            capturedUpsertRows = rows;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {};
    });

    const res = await PATCH(
      patchRequest('http://localhost/api/super-admin/settings', {
        section: 'feature-flags',
        flags: [{ key: 'exchange_marketplace', enabled: false }],
      })
    );
    expect(res.status).toBe(200);

    expect(capturedUpsertRows).toHaveLength(1);
    const row = capturedUpsertRows[0];
    // Must write is_enabled, not enabled
    expect(row).toHaveProperty('is_enabled', false);
    expect(row).not.toHaveProperty('enabled');
  });

  it('rejects unknown / stale flag keys', async () => {
    const res = await PATCH(
      patchRequest('http://localhost/api/super-admin/settings', {
        section: 'feature-flags',
        flags: [{ key: 'driver_tracking', enabled: true }],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/driver_tracking/);
  });

  it('accepts all 12 canonical DB flags', async () => {
    const canonicalKeys = [
      'exchange_marketplace',
      'bid_acceptance_workflow',
      'pod_capture',
      'invoice_generation',
      'dispute_filing',
      'stripe_billing_future_phase',
      'notifications',
      'document_review',
      'broker_carrier_network',
      'driver_mobile_app',
      'company_suspension',
      'audit_logging',
    ];

    let upsertCallCount = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { role: 'owner' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'platform_feature_flags') {
        return {
          upsert: () => {
            upsertCallCount++;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {};
    });

    const res = await PATCH(
      patchRequest('http://localhost/api/super-admin/settings', {
        section: 'feature-flags',
        flags: canonicalKeys.map((key) => ({ key, enabled: true })),
      })
    );
    expect(res.status).toBe(200);
    expect(upsertCallCount).toBe(1);
  });

  it('returns 403 when caller is not owner role', async () => {
    mocks.profileRole = 'driver';

    const res = await PATCH(
      patchRequest('http://localhost/api/super-admin/settings', {
        section: 'feature-flags',
        flags: [{ key: 'notifications', enabled: false }],
      })
    );
    expect(res.status).toBe(403);
  });
});
