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

const request = (headers: Record<string, string>, extra: Record<string, unknown> = {}) => new NextRequest(
  'https://www.xdrivelogistics.co.uk/api/driver/location',
  { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ job_id: 'job', lat: 53.8, lng: -1.5, ...extra }) },
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
      : { id: 'job', assigned_driver_id: 'driver', awarded_carrier_company_id: 'carrier', current_status: 'loaded', is_test: false };
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

  it('stores native points for an eligible commercial booking', async () => {
    expect((await POST(request(installed))).status).toBe(200);
    expect(checkDevice).toHaveBeenCalledWith(expect.anything(), 'user', 'driver');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: 'driver_app', source_provider: null }));
  });

  it('keeps existing PWA browser geolocation writes working', async () => {
    expect((await POST(request({}))).status).toBe(200);
    expect(checkDevice).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: 'driver_web', source_provider: 'browser_geolocation' }));
  });
  it('preserves sample identity and capture time', async () => {
    const id = 'e32e10d8-2459-4a17-9b35-d2cd496d0121';
    const captured = Date.now() - 180000;
    expect((await POST(request(installed, { location_id: id, captured_at_ms: captured }))).status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id, recorded_at: new Date(captured).toISOString() }));
  });
  it('rejects invalid replay identity or future timestamp', async () => {
    expect((await POST(request(installed, { location_id: 'bad', captured_at_ms: Date.now() }))).status).toBe(400);
    expect((await POST(request(installed, { location_id: 'e32e10d8-2459-4a17-9b35-d2cd496d0121', captured_at_ms: Date.now()+60000 }))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
  it('acknowledges only an identical existing sample', async () => {
    const id = 'e32e10d8-2459-4a17-9b35-d2cd496d0121';
    const captured = Date.now() - 180000;
    insert.mockResolvedValue({ error: { code: '23505' } });
    const original = from.getMockImplementation()!;
    const prior = { id, driver_id: 'driver', job_id: 'job', recorded_at: new Date(captured).toISOString(), lat: 53.8, lng: -1.5 };
    const lookup = { insert, select: () => lookup, eq: () => lookup, maybeSingle: async () => ({ data: prior, error: null }) };
    from.mockImplementation((table: string) => table === 'driver_locations' ? lookup : original(table));
    expect((await POST(request(installed, { location_id: id, captured_at_ms: captured }))).status).toBe(200);
    prior.driver_id = 'other';
    expect((await POST(request(installed, { location_id: id, captured_at_ms: captured }))).status).toBe(409);
  });
});
