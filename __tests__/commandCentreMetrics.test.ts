import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const makeRows = <T extends Record<string, unknown>>(count: number, factory: (index: number) => T) =>
  Array.from({ length: count }, (_, index) => factory(index));

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  datasets: {
    profiles: [] as Array<Record<string, unknown>>,
    companiesPending: [] as Array<Record<string, unknown>>,
    companiesSuspended: [] as Array<Record<string, unknown>>,
    jobsAtRisk: [] as Array<Record<string, unknown>>,
    jobsWithoutDriver: [] as Array<Record<string, unknown>>,
    docsExpiringSoon: [] as Array<Record<string, unknown>>,
    docsExpired: [] as Array<Record<string, unknown>>,
    fraudCases: [] as Array<Record<string, unknown>>,
    invoicesOverdue: [] as Array<Record<string, unknown>>,
    supportCritical: [] as Array<Record<string, unknown>>,
    gdprRequests: [] as Array<Record<string, unknown>>,
  },
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

class QueryBuilder<T extends Record<string, unknown>> {
  private rows: T[];
  private readonly count: number;

  constructor(rows: T[]) {
    this.rows = rows;
    this.count = rows.length;
  }

  select() { return this; }
  eq() { return this; }
  in() { return this; }
  is() { return this; }
  lt() { return this; }
  lte() { return this; }
  gte() { return this; }
  not() { return this; }
  order() { return this; }
  limit(value: number) {
    this.rows = this.rows.slice(0, value);
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  then<TResult1 = { data: T[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.rows, error: null, count: this.count }).then(onfulfilled, onrejected);
  }
}

describe('GET /api/super-admin/command-centre metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();

    mocks.getBearerToken.mockReturnValue('token');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    mocks.datasets.profiles = [{ role: 'owner' }];
    mocks.datasets.companiesPending = makeRows(25, (index) => ({
      id: `company-${index}`,
      name: `Company ${index}`,
      created_at: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));
    mocks.datasets.companiesSuspended = makeRows(12, (index) => ({ id: `suspended-${index}`, name: `Suspended ${index}` }));
    mocks.datasets.jobsAtRisk = [
      ...makeRows(3, (index) => ({
        id: `risk-p0-${index}`,
        status: 'allocated',
        pickup_location: 'A',
        delivery_location: 'B',
        updated_at: '2026-08-05T00:00:00.000Z',
        created_at: '2026-08-05T00:00:00.000Z',
      })),
      ...makeRows(4, (index) => ({
        id: `risk-p1-${index}`,
        status: 'in_transit',
        pickup_location: 'C',
        delivery_location: 'D',
        updated_at: '2026-08-06T03:30:00.000Z',
        created_at: '2026-08-06T03:30:00.000Z',
      })),
    ];
    mocks.datasets.jobsWithoutDriver = makeRows(6, (index) => ({
      id: `no-driver-${index}`,
      status: 'awarded',
      pickup_location: 'E',
      delivery_location: 'F',
      created_at: '2026-08-06T00:00:00.000Z',
    }));
    mocks.datasets.docsExpiringSoon = [
      ...makeRows(4, (index) => ({ id: `doc-p1-${index}`, driver_id: `driver-${index}`, doc_type: 'cpc_card', expiry_date: '2026-08-07T00:00:00.000Z' })),
      ...makeRows(5, (index) => ({ id: `doc-p2-${index}`, driver_id: `driver-x-${index}`, doc_type: 'insurance', expiry_date: '2026-08-11T00:00:00.000Z' })),
    ];
    mocks.datasets.docsExpired = makeRows(2, (index) => ({
      id: `expired-${index}`,
      driver_id: `driver-e-${index}`,
      doc_type: 'mot',
      expiry_date: '2026-08-01T00:00:00.000Z',
    }));
    mocks.datasets.fraudCases = [
      ...makeRows(2, (index) => ({ id: `fraud-p1-${index}`, subject_company_id: `co-${index}`, status: 'open', created_at: '2026-08-05T00:00:00.000Z' })),
      { id: 'fraud-p0', subject_company_id: 'co-p0', status: 'investigating', created_at: '2026-08-05T00:00:00.000Z' },
    ];
    mocks.datasets.invoicesOverdue = makeRows(21, (index) => ({
      id: `invoice-${index}`,
      invoice_number: `INV-${index}`,
      amount: 100,
      due_date: '2026-07-01',
      created_at: '2026-07-01T00:00:00.000Z',
    }));
    mocks.datasets.supportCritical = [
      ...makeRows(10, (index) => ({ id: `ticket-p1-${index}`, subject: `Critical ${index}`, status: 'open', priority: 'critical', created_at: '2026-08-05T00:00:00.000Z' })),
      { id: 'ticket-p0', subject: 'Critical investigate', status: 'investigating', priority: 'critical', created_at: '2026-08-05T00:00:00.000Z' },
    ];
    mocks.datasets.gdprRequests = [
      ...makeRows(4, (index) => ({ id: `gdpr-p0-${index}`, subject: `GDPR ${index}`, created_at: '2026-07-10T00:00:00.000Z' })),
      ...makeRows(3, (index) => ({ id: `gdpr-p1-${index}`, subject: `GDPR late ${index}`, created_at: '2026-07-15T00:00:00.000Z' })),
    ];

    let companiesCallCount = 0;
    let jobsCallCount = 0;
    let documentsCallCount = 0;
    let supportTicketsCallCount = 0;

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.datasets.profiles[0] ?? null, error: null }) }) }) };
      if (table === 'companies') {
        companiesCallCount += 1;
        return new QueryBuilder(companiesCallCount === 1 ? mocks.datasets.companiesPending : mocks.datasets.companiesSuspended);
      }
      if (table === 'jobs') {
        jobsCallCount += 1;
        return new QueryBuilder(jobsCallCount === 1 ? mocks.datasets.jobsAtRisk : mocks.datasets.jobsWithoutDriver);
      }
      if (table === 'driver_documents') {
        documentsCallCount += 1;
        return new QueryBuilder(documentsCallCount === 1 ? mocks.datasets.docsExpiringSoon : mocks.datasets.docsExpired);
      }
      if (table === 'fraud_review_cases') return new QueryBuilder(mocks.datasets.fraudCases);
      if (table === 'invoices') return new QueryBuilder(mocks.datasets.invoicesOverdue);
      if (table === 'support_tickets') {
        supportTicketsCallCount += 1;
        return new QueryBuilder(supportTicketsCallCount === 1 ? mocks.datasets.supportCritical : mocks.datasets.gdprRequests);
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('keeps totals and overdue amount uncapped while still trimming returned queue items to 50', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');

    const res = await GET(new NextRequest('http://localhost/api/super-admin/command-centre', {
      headers: { Authorization: '******' },
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as {
      attentionIndicators: {
        p0p1Incidents: { count: number };
        jobsAtRisk: { count: number };
        blockedAccounts: { count: number };
        financialExposure: { amountGbp: number; invoiceCount: number; amountPartial: boolean };
      };
      actionQueue: { total: number; p0: number; p1: number; p2: number; items: Array<unknown> };
    };

    expect(body.attentionIndicators.jobsAtRisk.count).toBe(13);
    expect(body.attentionIndicators.blockedAccounts.count).toBe(12);
    expect(body.attentionIndicators.financialExposure).toMatchObject({
      amountGbp: 2100,
      invoiceCount: 21,
      amountPartial: false,
    });
    expect(body.attentionIndicators.p0p1Incidents.count).toBe(86);
    expect(body.actionQueue.total).toBe(91);
    expect(body.actionQueue.p0).toBe(9);
    expect(body.actionQueue.p1).toBe(77);
    expect(body.actionQueue.p2).toBe(5);
    expect(body.actionQueue.items).toHaveLength(50);
  });
});
