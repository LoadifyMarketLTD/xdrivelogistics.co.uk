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
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

import { GET, PATCH } from '../app/api/super-admin/settings/route';

const getRequest = (url: string) =>
  new NextRequest(url, { method: 'GET', headers: { Authorization: '******' } });

const patchRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/super-admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: '******' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  mocks.flagRows = [];
  mocks.profileRole = 'owner';
  mocks.profileStatus = 'active';

  mocks.getBearerToken.mockReturnValue('test-token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: '44444444-4444-4444-8444-444444444444' } },
    error: null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: { role: mocks.profileRole, status: mocks.profileStatus },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'platform_feature_flags') {
      return {
        select: () => Promise.resolve({ data: mocks.flagRows, error: null }),
      };
    }
    if (table === 'platform_settings') {
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
});

describe('GET ?section=feature-flags', () => {
  it('reads is_enabled from DB and exposes enabled in response', async () => {
    mocks.flagRows = [
      { key: 'exchange_marketplace', is_enabled: false },
      { key: 'notifications', is_enabled: true },
    ];

    const res = await GET(getRequest('http://localhost/api/super-admin/settings?section=feature-flags'));
    expect(res.status).toBe(200);
    const body = await res.json() as { flags: Array<{ key: string; enabled: boolean }> };

    expect(body.flags.find((flag) => flag.key === 'exchange_marketplace')?.enabled).toBe(false);
    expect(body.flags.find((flag) => flag.key === 'notifications')?.enabled).toBe(true);
  });

  it('keeps the 12 canonical flag definitions and excludes stale aliases', async () => {
    const res = await GET(getRequest('http://localhost/api/super-admin/settings?section=feature-flags'));
    const body = await res.json() as { flags: Array<{ key: string }> };
    const keys = body.flags.map((flag) => flag.key);

    expect(keys).toHaveLength(12);
    expect(keys).toContain('exchange_marketplace');
    expect(keys).toContain('audit_logging');
    expect(keys).not.toContain('driver_tracking');
    expect(keys).not.toContain('public_quote_requests');
    expect(keys).not.toContain('compliance_gating');
  });

  it('requires an active Platform Owner', async () => {
    mocks.profileStatus = 'suspended';
    const res = await GET(getRequest('http://localhost/api/super-admin/settings?section=feature-flags'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH Platform configuration', () => {
  it('routes feature flag changes through the atomic audited governance RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ section: 'feature-flags', updated_count: 1 }], error: null });

    const res = await PATCH(patchRequest({
      section: 'feature-flags',
      flags: [{ key: 'exchange_marketplace', enabled: false }],
      reason: 'Temporarily disable exchange for maintenance',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('owner_update_platform_configuration', {
      p_actor_user_id: '44444444-4444-4444-8444-444444444444',
      p_section: 'feature-flags',
      p_changes: [expect.objectContaining({
        key: 'exchange_marketplace',
        enabled: false,
        label: 'Exchange Marketplace',
      })],
      p_reason: 'Temporarily disable exchange for maintenance',
    });
    expect(body.updated).toBe(1);
  });

  it('rejects unknown or stale flag keys before the governance RPC', async () => {
    const res = await PATCH(patchRequest({
      section: 'feature-flags',
      flags: [{ key: 'driver_tracking', enabled: true }],
      reason: 'Test unknown key rejection',
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/driver_tracking/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires a written reason for feature flag mutation', async () => {
    const res = await PATCH(patchRequest({
      section: 'feature-flags',
      flags: [{ key: 'notifications', enabled: false }],
      reason: 'no',
    }));

    expect(res.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('routes global settings through the same atomic audited governance RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ section: 'global', updated_count: 1 }], error: null });

    const res = await PATCH(patchRequest({
      section: 'global',
      settings: [{ key: 'default_timezone', value: 'Europe/London' }],
      reason: 'Confirm canonical platform timezone',
    }));

    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('owner_update_platform_configuration', {
      p_actor_user_id: '44444444-4444-4444-8444-444444444444',
      p_section: 'global',
      p_changes: [expect.objectContaining({
        key: 'default_timezone',
        value: 'Europe/London',
        value_type: 'text',
      })],
      p_reason: 'Confirm canonical platform timezone',
    });
  });

  it('fails closed when the settings governance migration is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });

    const res = await PATCH(patchRequest({
      section: 'feature-flags',
      flags: [{ key: 'notifications', enabled: false }],
      reason: 'Disable during provider incident',
    }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.migrationRequired).toBe(true);
  });

  it('keeps Roles & Permissions read-only at the API boundary', async () => {
    const res = await PATCH(patchRequest({
      section: 'roles',
      roles: [{ role: 'platform_admin' }],
      reason: 'Attempt direct role mutation',
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/read-only/i);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects inactive owners before any settings mutation RPC', async () => {
    mocks.profileStatus = 'inactive';
    const res = await PATCH(patchRequest({
      section: 'feature-flags',
      flags: [{ key: 'notifications', enabled: false }],
      reason: 'Disable during provider incident',
    }));

    expect(res.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
