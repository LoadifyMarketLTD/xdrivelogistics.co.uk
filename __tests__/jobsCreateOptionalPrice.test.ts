import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: () => 'test-token',
  supabaseValidator: { auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) } },
  supabaseAdmin: { from: () => query },
}));
import { POST } from '../app/api/jobs/create/route';

const base = {
  idempotencyKey: '10000000-0000-4000-8000-000000000001',
  companyId: '10000000-0000-4000-8000-000000000002',
  mode: 'customer', publish: true,
  pickupDateTime: '2026-10-26T10:00:00Z', pickupTimeSlot: '10:00',
  pickupAddress: 'Test collection', pickupPostcode: 'BB1 9QL',
  deliveryTimeSlot: '10:00', deliveryAddress: 'Test delivery', deliveryPostcode: 'DA8 1NY',
  vehicleLabel: 'LWB Van', cargoLabel: 'Pallets',
  tailLift: false, forklift: false, handball: false,
  adr: false, temperatureControlled: false, fragile: false,
};
const send = (extra: Record<string, unknown>) => POST(new NextRequest('https://example.test/api/jobs/create', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, ...extra }),
}));
beforeEach(() => vi.clearAllMocks());

describe('publish without target price', () => {
  it.each([undefined, null, 0])('allows quote-based posts with price %s through price validation while retaining company access checks', async (customerPrice) => {
    const result = await send({ customerPrice });
    expect(result.status).toBe(403);
    expect((await result.json()).code).toBe('COMPANY_MEMBERSHIP_REQUIRED');
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });
  it.each([undefined, null, 0, 12.345])('rejects a fixed-price post with invalid price %s', async (customerPrice) => {
    const result = await send({ isFixedPrice: true, customerPrice });
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain('Fixed-price posts require');
    expect(query.maybeSingle).not.toHaveBeenCalled();
  });
  it('retains fixed-price posting with a valid amount', async () => {
    const result = await send({ isFixedPrice: true, customerPrice: 125.5 });
    expect(result.status).toBe(403);
    expect((await result.json()).code).toBe('COMPANY_MEMBERSHIP_REQUIRED');
  });
});
