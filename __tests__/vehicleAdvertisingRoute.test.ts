import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: mocks.getBearerToken,
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mocks.rpc,
  })),
}));

let PATCH: (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const makePatchRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/vehicles/veh-1/advertising', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: '******' },
    body: JSON.stringify(body),
  });

describe('PATCH /api/admin/vehicles/[id]/advertising', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.getBearerToken.mockReturnValue('session-token');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('returns persisted state from RPC success response', async () => {
    ({ PATCH } = await import('../app/api/admin/vehicles/[id]/advertising/route'));
    mocks.rpc.mockResolvedValue({
      data: [{ vehicle_id: 'veh-1', company_id: 'co-1', previous_state: 'none', new_state: 'exchange' }],
      error: null,
    });

    const res = await PATCH(makePatchRequest({ state: 'exchange', reason: 'publish', metadata: { source: 'test' } }), {
      params: Promise.resolve({ id: 'veh-1' }),
    });

    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('set_vehicle_advertising_state', expect.objectContaining({
      p_vehicle_id: 'veh-1',
      p_actor_user_id: 'user-1',
      p_state: 'exchange',
    }));
  });

  it('rejects invalid state values before RPC call', async () => {
    ({ PATCH } = await import('../app/api/admin/vehicles/[id]/advertising/route'));
    const res = await PATCH(makePatchRequest({ state: 'invalid' }), {
      params: Promise.resolve({ id: 'veh-1' }),
    });
    expect(res.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('maps forbidden RPC errors to 403', async () => {
    ({ PATCH } = await import('../app/api/admin/vehicles/[id]/advertising/route'));
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Forbidden' },
    });
    const res = await PATCH(makePatchRequest({ state: 'partner' }), {
      params: Promise.resolve({ id: 'veh-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 401 when token is missing', async () => {
    ({ PATCH } = await import('../app/api/admin/vehicles/[id]/advertising/route'));
    mocks.getBearerToken.mockReturnValue(null);
    const res = await PATCH(makePatchRequest({ state: 'none' }), {
      params: Promise.resolve({ id: 'veh-1' }),
    });
    expect(res.status).toBe(401);
  });
});
