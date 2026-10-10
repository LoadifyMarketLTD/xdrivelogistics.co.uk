import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  autoGenerateMarketplaceInvoice: vi.fn(),
  jobResult: null as Record<string, unknown> | null,
  membershipResult: null as Record<string, unknown> | null,
  updatedJobResult: null as Record<string, unknown> | null,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: mocks.getBearerToken,
  isSupabaseAdminConfigured: true,
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
  supabaseAdmin: {
    from: mocks.from,
  },
}));

vi.mock('../app/api/_lib/autoGenerateMarketplaceInvoice', () => ({
  autoGenerateMarketplaceInvoice: mocks.autoGenerateMarketplaceInvoice,
}));

const makeJobsTable = () => ({
  select: () => ({
    eq: () => ({
      maybeSingle: async () => ({ data: mocks.jobResult, error: null }),
    }),
  }),
  update: () => {
    const query = {
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      select: () => ({
        maybeSingle: async () => ({ data: mocks.updatedJobResult, error: null }),
      }),
    };
    return query;
  },
});

describe('POST /api/admin/jobs/[id]/transition', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.autoGenerateMarketplaceInvoice.mockReset();

    mocks.getBearerToken.mockReturnValue('token');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.autoGenerateMarketplaceInvoice.mockResolvedValue({
      created: false,
      invoiceId: null,
      reason: 'Invoice generation is currently disabled.',
    });
    mocks.jobResult = {
      id: 'job-1',
      company_id: 'company-1',
      awarded_carrier_company_id: 'carrier-1',
      assigned_driver_id: 'driver-1',
      status: 'on_site_delivery',
      current_status: 'on_site_delivery',
      status_history: [],
      pod_required: false,
      pod_generated: true,
      delivery_photos: [],
      pod_photos: [],
      delivery_signature_data: { ok: true },
      client_signature_name: 'Recipient',
    };
    mocks.membershipResult = { id: 'membership-1', company_id: 'carrier-1', role_in_company: 'owner', companies: { status: 'active' } };
    mocks.updatedJobResult = {
      id: 'job-1',
      status: 'delivered',
      current_status: 'delivered',
      assigned_driver_id: 'driver-1',
      updated_at: '2026-08-06T00:00:00.000Z',
    };

    mocks.from.mockImplementation((table: string) => {
      if (table === 'jobs') return makeJobsTable();
      if (table === 'company_memberships') {
        const query = {
          eq: vi.fn(() => query),
          limit: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: mocks.membershipResult, error: null })),
        };
        return { select: () => query };
      }
      if (table === 'job_tracking_events') {
        return {
          insert: async () => ({ error: null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('preserves explicit allocated -> accepted operator progression', async () => {
    mocks.jobResult = {
      ...mocks.jobResult,
      status: 'allocated',
      current_status: 'allocated',
    };
    mocks.updatedJobResult = {
      id: 'job-1',
      status: 'accepted',
      current_status: 'accepted',
      assigned_driver_id: 'driver-1',
      updated_at: '2026-10-09T18:00:00.000Z',
    };

    const { POST } = await import('../app/api/admin/jobs/[id]/transition/route');
    const res = await POST(
      new NextRequest('http://localhost/api/admin/jobs/job-1/transition', {
        method: 'POST',
        headers: {
          Authorization: '******',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nextStatus: 'accepted', expectedStatus: 'allocated', note: 'Fleet operator confirmed driver acceptance.' }),
      }),
      { params: Promise.resolve({ id: 'job-1' }) }
    );

    expect(res.status).toBe(200);
  });

  it('keeps the delivered transition successful without creating an invoice before POD completion', async () => {
    const { POST } = await import('../app/api/admin/jobs/[id]/transition/route');

    const res = await POST(
      new NextRequest('http://localhost/api/admin/jobs/job-1/transition', {
        method: 'POST',
        headers: {
          Authorization: '******',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nextStatus: 'delivered', expectedStatus: 'on_site_delivery' }),
      }),
      { params: Promise.resolve({ id: 'job-1' }) }
    );

    expect(res.status).toBe(200);
    expect(mocks.autoGenerateMarketplaceInvoice).not.toHaveBeenCalled();
  });
});
