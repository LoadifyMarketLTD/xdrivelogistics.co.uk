import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  profileRole: 'owner' as string,
  profileStatus: 'active' as string,
  flagRows: [] as Array<Record<string, unknown>>,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: mocks.getBearerToken,
  supabaseValidator: { auth: { getUser: mocks.getUser } },
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));

import { GET, PATCH } from '../app/api/super-admin/settings/route';

const getRequest = (url: string) => new NextRequest(url, { method: 'GET', headers: { Authorization: '******' } });
const patchRequest = (body: unknown) => new NextRequest('http://localhost/api/super-admin/settings', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: '******' }, body: JSON.stringify(body),
});

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  mocks.profileRole = 'owner';
  mocks.profileStatus = 'active';
  mocks.flagRows = [];
  mocks.getBearerToken.mockReturnValue('test-token');
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-user-1', email: 'owner@example.test' } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ section: 'feature-flags', updated_count: 1 }], error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: mocks.profileRole, status: mocks.profileStatus }, error: null }) }) }) };
    if (table === 'platform_feature_flags') return { select: () => Promise.resolve({ data: mocks.flagRows, error: null }) };
    if (table === 'platform_settings') return { select: () => Promise.resolve({ data: [], error: null }) };
    return {};
  });
});

describe('Super Admin settings governance', () => {
  it('reads canonical feature flags without changing the response contract', async () => {
    mocks.flagRows = [{ key: 'exchange_marketplace', is_enabled: false }, { key: 'notifications', is_enabled: true }];
    const res = await GET(getRequest('http://localhost/api/super-admin/settings?section=feature-flags'));
    expect(res.status).toBe(200);
    const body = await res.json() as { flags: Array<{ key: string; enabled: boolean }> };
    expect(body.flags.find((flag) => flag.key === 'exchange_marketplace')?.enabled).toBe(false);
    expect(body.flags).toHaveLength(12);
  });

  it('requires an explicit reason before a feature flag mutation', async () => {
    const res = await PATCH(patchRequest({ section: 'feature-flags', flags: [{ key: 'notifications', enabled: false }] }));
    expect(res.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('routes feature flag writes through the audited RPC instead of direct upsert', async () => {
    const res = await PATCH(patchRequest({
      section: 'feature-flags',
      flags: [{ key: 'exchange_marketplace', enabled: false }],
      reason: 'Temporarily disable exchange during maintenance.',
    }));
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('owner_update_platform_configuration', expect.objectContaining({
      p_actor_user_id: 'owner-user-1', p_section: 'feature-flags', p_reason: 'Temporarily disable exchange during maintenance.',
    }));
  });

  it('rejects stale feature flag keys before the RPC', async () => {
    const res = await PATCH(patchRequest({ section: 'feature-flags', flags: [{ key: 'driver_tracking', enabled: true }], reason: 'Test stale key rejection.' }));
    expect(res.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires an active Platform Owner', async () => {
    mocks.profileStatus = 'suspended';
    const res = await PATCH(patchRequest({ section: 'feature-flags', flags: [{ key: 'notifications', enabled: false }], reason: 'Test authority boundary.' }));
    expect(res.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('keeps Roles & Permissions read-only at the API boundary', async () => {
    const res = await PATCH(patchRequest({ section: 'roles', roles: [{ role: 'driver' }] }));
    expect(res.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
