import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  featureFlag: vi.fn(),
  requireDriver: vi.fn(),
  affectedRows: [] as Array<{ id: string }>,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: { from: mocks.from },
}));
vi.mock('../app/api/_lib/platformFlags', () => ({
  getFeatureFlag: mocks.featureFlag,
}));
vi.mock('../app/api/driver/_lib/webDriver', () => ({
  requireWebDriver: mocks.requireDriver,
}));
vi.mock('../app/api/driver/mobile/_lib', () => ({
  requireDriver: mocks.requireDriver,
  isDriverContext: (value: unknown) => Boolean(value && typeof value === 'object' && 'driverId' in value),
  respond: (status: number, value: Record<string, unknown>) => NextResponse.json(value, { status }),
}));

import { POST } from '../app/api/driver/mobile/bids/[id]/route';
import { POST as webPOST } from '../app/api/driver/web/bids/[id]/route';

const bid = {
  id: 'bid-1',
  job_id: 'job-1',
  bidder_driver_id: 'driver-1',
  bidder_user_id: 'user-1',
  status: 'submitted',
  amount: 100,
  bid_price_gbp: 100,
  base_amount: 100,
  additional_extras_gbp: 0,
  collect_within_minutes: null,
  message: '',
};

function table(name: string) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: name === 'job_bids'
            ? bid
            : { id: 'job-1', status: 'posted', current_status: 'posted', assigned_driver_id: null, awarded_carrier_company_id: null },
          error: null,
        }),
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: () => ({
          select: async () => ({ data: mocks.affectedRows, error: null }),
        }),
      }),
    }),
  };
}

const requestFor = (action: string, surface: 'mobile' | 'web' = 'mobile') => new NextRequest(`http://localhost/api/driver/${surface}/bids/bid-1`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action, amount: 150, baseAmount: 150, additionalExtrasGbp: 0 }),
});

describe('Driver PWA quote update concurrency', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.from.mockImplementation(table);
    mocks.featureFlag.mockResolvedValue(true);
    mocks.requireDriver.mockResolvedValue({ userId: 'user-1', driverId: 'driver-1' });
    mocks.affectedRows = [];
  });

  it.each(['withdraw', 'edit'])('returns a conflict when %s updates zero rows', async (action) => {
    const response = await POST(requestFor(action), { params: Promise.resolve({ id: 'bid-1' }) });
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toMatch(/changed/i);
  });

  it.each(['withdraw', 'edit'])('confirms %s only when a row is updated', async (action) => {
    mocks.affectedRows = [{ id: 'bid-1' }];
    const response = await POST(requestFor(action), { params: Promise.resolve({ id: 'bid-1' }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.idempotent).toBe(false);
  });

  it.each(['withdraw', 'edit'])('browser PWA rejects stale %s updates', async (action) => {
    const response = await webPOST(requestFor(action, 'web'), { params: Promise.resolve({ id: 'bid-1' }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/changed/i);
  });

  it.each(['withdraw', 'edit'])('browser PWA confirms %s only after a persisted update', async (action) => {
    mocks.affectedRows = [{ id: 'bid-1' }];
    const response = await webPOST(requestFor(action, 'web'), { params: Promise.resolve({ id: 'bid-1' }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.idempotent).toBe(false);
  });

  it('browser PWA refuses to mutate another driver quote', async () => {
    mocks.requireDriver.mockResolvedValue({ userId: 'other-user', driverId: 'other-driver' });
    const response = await webPOST(requestFor('withdraw', 'web'), { params: Promise.resolve({ id: 'bid-1' }) });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/does not belong/i);
  });
});
