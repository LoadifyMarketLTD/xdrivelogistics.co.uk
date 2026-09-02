import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  requireDriver: vi.fn(),
  insertTrackingEvent: vi.fn(),
  appendStatusHistory: vi.fn(() => []),
  hasPod: vi.fn(() => true),
  mapJob: vi.fn((job: unknown) => job),
  autoGenerateMarketplaceInvoice: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  storageList: vi.fn(),
  existingJob: null as Record<string, unknown> | null,
  updatedJob: null as Record<string, unknown> | null,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: () => 'driver-access-token',
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: () => ({
        list: mocks.storageList,
      }),
    },
  },
}));

vi.mock('../app/api/_lib/platformFlags', () => ({
  getFeatureFlag: mocks.getFeatureFlag,
}));

vi.mock('../app/api/_lib/autoGenerateMarketplaceInvoice', () => ({
  autoGenerateMarketplaceInvoice: mocks.autoGenerateMarketplaceInvoice,
}));

vi.mock('../app/api/driver/mobile/_lib', () => ({
  appendStatusHistory: mocks.appendStatusHistory,
  hasPod: mocks.hasPod,
  insertTrackingEvent: mocks.insertTrackingEvent,
  isDriverContext: (value: unknown) => Boolean(value && typeof value === 'object' && 'userId' in value),
  jobSelect: 'id,status,current_status,status_history,pod_required,awarded_carrier_company_id,assigned_driver_id',
  mapJob: mocks.mapJob,
  requireDriver: mocks.requireDriver,
  respond: (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status }),
  safeArray: (value: unknown) => Array.isArray(value) ? value : [],
}));

const makeJobTable = () => ({
  select: () => ({
    eq: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: mocks.existingJob, error: null }),
        single: async () => ({ data: mocks.updatedJob, error: null }),
      }),
    }),
  }),
  update: () => ({
    eq: () => ({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: mocks.updatedJob, error: null }),
        }),
      }),
    }),
  }),
});

const makeJobStopsTable = () => ({
  select: () => ({
    eq: async () => ({ data: [], error: null }),
  }),
});

describe('POST /api/driver/mobile/jobs/[id]/[action]', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
    mocks.getFeatureFlag.mockReset();
    mocks.requireDriver.mockReset();
    mocks.insertTrackingEvent.mockReset();
    mocks.appendStatusHistory.mockReset();
    mocks.hasPod.mockReset();
    mocks.mapJob.mockReset();
    mocks.autoGenerateMarketplaceInvoice.mockReset();
    mocks.from.mockReset();
    mocks.rpc.mockReset();
    mocks.storageList.mockReset();

    mocks.appendStatusHistory.mockReturnValue([]);
    mocks.hasPod.mockReturnValue(true);
    mocks.mapJob.mockImplementation((job: unknown) => job);
    mocks.requireDriver.mockResolvedValue({ userId: 'user-1', driverId: 'driver-1' });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.autoGenerateMarketplaceInvoice.mockResolvedValue({
      created: false,
      invoiceId: null,
      reason: 'Invoice generation is currently disabled.',
    });
    mocks.existingJob = {
      id: 'job-1',
      status: 'in_transit',
      current_status: 'in_transit',
      status_history: [],
      pod_required: false,
      awarded_carrier_company_id: 'carrier-1',
      assigned_driver_id: 'driver-1',
      delivery_signature_data: null,
      client_signature_name: null,
    };
    mocks.updatedJob = {
      ...mocks.existingJob,
      status: 'delivered',
      current_status: 'delivered',
    };

    mocks.from.mockImplementation((table: string) => {
      if (table === 'jobs') return makeJobTable();
      if (table === 'job_stops') return makeJobStopsTable();
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('fails closed for non-POD actions when driver_mobile_app is disabled', async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);
    const { POST } = await import('../app/api/driver/mobile/jobs/[id]/[action]/route');

    const res = await POST(
      new NextRequest('http://localhost/api/driver/mobile/jobs/job-1/on-my-way-pickup', { method: 'POST' }),
      { params: Promise.resolve({ id: 'job-1', action: 'on-my-way-pickup' }) }
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'The driver mobile app is currently disabled.' });
    expect(mocks.requireDriver).not.toHaveBeenCalled();
  });

  it('blocks POD before checking pod_capture when driver_mobile_app is disabled', async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);
    const { POST } = await import('../app/api/driver/mobile/jobs/[id]/[action]/route');

    const res = await POST(
      new NextRequest('http://localhost/api/driver/mobile/jobs/job-1/pod', { method: 'POST' }),
      { params: Promise.resolve({ id: 'job-1', action: 'pod' }) }
    );

    expect(res.status).toBe(503);
    expect(mocks.getFeatureFlag).toHaveBeenCalledTimes(1);
    expect(mocks.getFeatureFlag).toHaveBeenCalledWith(expect.anything(), 'driver_mobile_app');
  });

  it('preserves the additional pod_capture gate for POD uploads', async () => {
    mocks.getFeatureFlag.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { POST } = await import('../app/api/driver/mobile/jobs/[id]/[action]/route');

    const res = await POST(
      new NextRequest('http://localhost/api/driver/mobile/jobs/job-1/pod', { method: 'POST' }),
      { params: Promise.resolve({ id: 'job-1', action: 'pod' }) }
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'POD capture is currently disabled.' });
    expect(mocks.getFeatureFlag.mock.calls.map(([, key]) => key)).toEqual(['driver_mobile_app', 'pod_capture']);
  });

  it('keeps delivered transitions successful when the shared invoice boundary reports disabled', async () => {
    mocks.getFeatureFlag.mockResolvedValue(true);
    const { POST } = await import('../app/api/driver/mobile/jobs/[id]/[action]/route');

    const res = await POST(
      new NextRequest('http://localhost/api/driver/mobile/jobs/job-1/delivered', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'job-1', action: 'delivered' }) }
    );

    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('driver_update_job_status_atomic', expect.objectContaining({
      p_driver_id: 'driver-1',
      p_job_id: 'job-1',
      p_next_status: 'delivered',
    }));
    expect(mocks.autoGenerateMarketplaceInvoice).toHaveBeenCalledWith({
      supabase: expect.anything(),
      jobId: 'job-1',
      supplierCompanyId: 'carrier-1',
      actorUserId: 'user-1',
      idempotencyKey: 'auto-pod-job-1',
    });
  });
});
