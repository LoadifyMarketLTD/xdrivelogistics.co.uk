import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, from, insert, checkDevice } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  checkDevice: vi.fn(),
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: () => 'test-access',
  isSupabaseAdminConfigured: true,
  supabaseAdmin: { auth: { getUser }, from },
}));
vi.mock('../app/api/driver/mobile/_deviceSessionGate', () => ({
  rejectRevokedNativeAuthSession: checkDevice,
}));
vi.mock('../lib/tracking/operationalAlerts', () => ({
  maybeCreateOperationalLocationAlerts: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../app/api/driver/location/route';

const request = (headers: Record<string, string>) => new NextRequest(
  'https://www.xdrivelogistics.co.uk/api/driver/location',
  { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ job_id: 'job', lat: 53.8, lng: -1.5 }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
  checkDevice.mockResolvedValue(null);
  insert.mockResolvedValue({ error: null });
  from.mockImplementation((table: string) => {
    if (table === 'driver_locations') return { insert };
    const result = table === 'drivers'
      ? { id: 'driver', company_id: 'carrier', app_access: true }
      : { id: 'job', assigned_driver_id: 'driver', awarded_carrier_company_id: 'carrier', current_status: 'loaded', is_test: true };
    const lookup = { select: () => lookup, eq: () => lookup, maybeSingle: async () => ({ data: result, error: null }) };
    return lookup;
  });
});

describe('Android foreground service location writes', () => {
  const native = { 'x-xdrive-location-source': 'android-service' };
  const installed = { ...native, 'x-xdrive-installation-id': 'device' };

  it('rejects a native write without installation identity', async () => {
    expect((await POST(request(native))).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a revoked native session before creating a point', async () => {
    checkDevice.mockResolvedValue(NextResponse.json({ error: 'revoked' }, { status: 401 }));
    expect((await POST(request(installed))).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('stores native points with the existing driver_app source', async () => {
    expect((await POST(request(installed))).status).toBe(200);
    expect(checkDevice).toHaveBeenCalledWith(expect.anything(), 'user', 'driver');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: 'driver_app', source_provider: null }));
  });

  it('keeps existing PWA browser geolocation writes working', async () => {
    expect((await POST(request({}))).status).toBe(200);
    expect(checkDevice).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: 'driver_web', source_provider: 'browser_geolocation' }));
  });
});
