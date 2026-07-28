import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const rpcMock = vi.fn();
const requireDriverMock = vi.fn();
const isDriverContextMock = vi.fn();

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    rpc: rpcMock,
  },
}));

vi.mock('../app/api/driver/mobile/_lib', () => ({
  requireDriver: requireDriverMock,
  isDriverContext: isDriverContextMock,
  respond: (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }),
}));

describe('driver mobile device-token route uses atomic RPCs', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireDriverMock.mockReset();
    isDriverContextMock.mockReset();
    isDriverContextMock.mockReturnValue(true);
    requireDriverMock.mockResolvedValue({
      userId: 'user-a',
      driverId: 'driver-a',
      companyId: 'company-a',
      driverStatus: 'active',
      appAccess: true,
      driverType: 'fleet_driver',
      canCommercialBid: false,
      companyStatus: 'active',
    });
  });

  test('POST delegates registration to atomic RPC and returns result', async () => {
    rpcMock.mockResolvedValue({ data: 'accepted', error: null });
    const { POST } = await import('../app/api/driver/mobile/device-token/route');

    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        platform: 'android',
        app_package: 'co.uk.xdrivelogistics.driver',
        installation_id: 'install-1',
        generation: 3,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, result: 'accepted' });
    expect(rpcMock).toHaveBeenCalledWith('driver_register_device_token_atomic', expect.objectContaining({
      p_user_id: 'user-a',
      p_driver_id: 'driver-a',
      p_token: 'x'.repeat(140),
      p_installation_id: 'install-1',
      p_generation: 3,
    }));
  });

  test('POST returns duplicate idempotently without remutating route logic', async () => {
    rpcMock.mockResolvedValue({ data: 'duplicate', error: null });
    const { POST } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 3,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, result: 'duplicate' });
  });

  test('POST returns stale result for delayed lower generation requests', async () => {
    rpcMock.mockResolvedValue({ data: 'stale', error: null });
    const { POST } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 2,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, result: 'stale' });
  });

  test('POST returns 500 when atomic register RPC is missing', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function public.driver_register_device_token_atomic does not exist' },
    });
    const { POST } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 1,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('driver_register_device_token_atomic') });
  });

  test('POST rejects malformed payloads and never reaches RPC', async () => {
    const { POST } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 0,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test('POST returns auth response when driver context is denied', async () => {
    const denial = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    requireDriverMock.mockResolvedValue(denial);
    isDriverContextMock.mockReturnValue(false);
    const { POST } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 1,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test('DELETE delegates unregister to atomic RPC with installation/generation identity', async () => {
    rpcMock.mockResolvedValue({ data: 'duplicate', error: null });
    const { DELETE } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'DELETE',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 4,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, result: 'duplicate' });
    expect(rpcMock).toHaveBeenCalledWith('driver_unregister_device_token_atomic', expect.objectContaining({
      p_user_id: 'user-a',
      p_driver_id: 'driver-a',
      p_token: 'x'.repeat(140),
      p_installation_id: 'install-1',
      p_generation: 4,
    }));
  });

  test('DELETE returns stale for delayed logout unregisters', async () => {
    rpcMock.mockResolvedValue({ data: 'stale', error: null });
    const { DELETE } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'DELETE',
      body: JSON.stringify({
        token: 'x'.repeat(140),
        installation_id: 'install-1',
        generation: 1,
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, result: 'stale' });
  });

  test('DELETE rejects malformed unregister payloads and avoids RPC', async () => {
    const { DELETE } = await import('../app/api/driver/mobile/device-token/route');
    const request = new Request('http://localhost/api/driver/mobile/device-token', {
      method: 'DELETE',
      body: JSON.stringify({
        token: 'x'.repeat(140),
      }),
      headers: { 'content-type': 'application/json' },
    }) as NextRequest;
    const response = await DELETE(request);
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
