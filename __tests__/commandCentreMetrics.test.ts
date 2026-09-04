import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const makeRows = <T extends Record<string, unknown>>(count: number, factory: (index: number) => T) =>
  Array.from({ length: count }, (_, index) => factory(index));

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  limitCalls: [] as Array<{ table: string; limit: number }>,
  tableErrors: {} as Record<string, { code?: string; message: string } | null>,
  datasets: {
    profiles: [] as Array<Record<string, unknown>>,
    companies: [] as Array<Record<string, unknown>>,
    jobs: [] as Array<Record<string, unknown>>,
    driver_documents: [] as Array<Record<string, unknown>>,
    fraud_review_cases: [] as Array<Record<string, unknown>>,
    invoices: [] as Array<Record<string, unknown>>,
    support_tickets: [] as Array<Record<string, unknown>>,
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
  private readonly filters: Array<(row: T) => boolean> = [];
  private orderField: string | null = null;
  private ascending = true;
  private limitValue: number | null = null;
  private rangeValue: [number, number] | null = null;
  private head = false;
  private countRequested = false;

  constructor(
    private readonly table: string,
    private readonly rows: T[],
    private readonly error: { code?: string; message: string } | null,
  ) {}

  select(_columns?: string, options?: { count?: 'exact'; head?: boolean }) {
    this.head = Boolean(options?.head);
    this.countRequested = options?.count === 'exact';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column as keyof T] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column as keyof T]));
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column as keyof T] === value);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' || operator === 'eq') {
      this.filters.push((row) => row[column as keyof T] !== value);
    }
    return this;
  }

  lt(column: string, value: string) {
    this.filters.push((row) => String(row[column as keyof T] ?? '') < value);
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push((row) => String(row[column as keyof T] ?? '') <= value);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column as keyof T] ?? '') >= value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    mocks.limitCalls.push({ table: this.table, limit: value });
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }

  maybeSingle() {
    const result = this.evaluate();
    return Promise.resolve({ data: result.rows[0] ?? null, error: this.error });
  }

  then<TResult1 = { data: T[] | null; error: { code?: string; message: string } | null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: { code?: string; message: string } | null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const result = this.evaluate();
    return Promise.resolve({
      data: this.head ? null : result.rows,
      error: this.error,
      count: this.countRequested ? result.count : null,
    }).then(onfulfilled, onrejected);
  }

  private evaluate() {
    if (this.error) return { rows: [] as T[], count: 0 };

    let filtered = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    const count = filtered.length;

    if (this.orderField) {
      const field = this.orderField as keyof T;
      filtered = [...filtered].sort((left, right) => {
        const a = String(left[field] ?? '');
        const b = String(right[field] ?? '');
        return this.ascending ? a.localeCompare(b) : b.localeCompare(a);
      });
    }

    if (this.rangeValue) {
      filtered = filtered.slice(this.rangeValue[0], this.rangeValue[1] + 1);
    }

    if (this.limitValue !== null) {
      filtered = filtered.slice(0, this.limitValue);
    }

    return { rows: filtered, count };
  }
}

describe('GET /api/super-admin/command-centre metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'));

    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.limitCalls = [];
    mocks.tableErrors = {};

    mocks.getBearerToken.mockReturnValue('token');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    mocks.datasets.profiles = [{ user_id: 'owner-1', role: 'owner' }];
    mocks.datasets.companies = [
      ...makeRows(70, (index) => ({
        id: `company-${index}`,
        name: `Company ${index}`,
        status: 'pending_approval',
        created_at: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
      ...makeRows(12, (index) => ({
        id: `suspended-${index}`,
        name: `Suspended ${index}`,
        status: 'suspended',
        created_at: `2026-08-${String((index % 6) + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
    ];
    mocks.datasets.jobs = [
      ...makeRows(3, (index) => ({
        id: `risk-p0-${index}`,
        status: 'allocated',
        pickup_location: 'A',
        delivery_location: 'B',
        updated_at: '2026-08-06T06:00:00.000Z',
        created_at: '2026-08-06T06:00:00.000Z',
        assigned_driver_id: `driver-${index}`,
      })),
      ...makeRows(4, (index) => ({
        id: `risk-p1-${index}`,
        status: 'in_transit',
        pickup_location: 'C',
        delivery_location: 'D',
        updated_at: '2026-08-06T09:00:00.000Z',
        created_at: '2026-08-06T09:00:00.000Z',
        assigned_driver_id: `driver-x-${index}`,
      })),
      ...makeRows(6, (index) => ({
        id: `no-driver-${index}`,
        status: index % 2 === 0 ? 'awarded' : 'allocated',
        pickup_location: 'E',
        delivery_location: 'F',
        updated_at: '2026-08-06T08:00:00.000Z',
        created_at: '2026-08-06T00:00:00.000Z',
        assigned_driver_id: null,
      })),
    ];
    mocks.datasets.driver_documents = [
      ...makeRows(4, (index) => ({
        id: `doc-p1-${index}`,
        driver_id: `driver-${index}`,
        doc_type: 'cpc_card',
        expiry_date: '2026-08-07T00:00:00.000Z',
        status: 'approved',
      })),
      ...makeRows(5, (index) => ({
        id: `doc-p2-${index}`,
        driver_id: `driver-x-${index}`,
        doc_type: 'insurance',
        expiry_date: '2026-08-11T00:00:00.000Z',
        status: 'approved',
      })),
      ...makeRows(2, (index) => ({
        id: `expired-${index}`,
        driver_id: `driver-e-${index}`,
        doc_type: 'mot',
        expiry_date: '2026-08-01T00:00:00.000Z',
        status: 'approved',
      })),
    ];
    mocks.datasets.fraud_review_cases = [
      ...makeRows(2, (index) => ({
        id: `fraud-p1-${index}`,
        subject_company_id: `co-${index}`,
        status: 'open',
        created_at: '2026-08-05T00:00:00.000Z',
      })),
      { id: 'fraud-p0', subject_company_id: 'co-p0', status: 'investigating', created_at: '2026-08-05T00:00:00.000Z' },
    ];
    mocks.datasets.invoices = [
      ...makeRows(21, (index) => ({
        id: `invoice-${index}`,
        invoice_number: `INV-${index}`,
        amount: 100,
        due_date: '2026-07-01',
        created_at: '2026-07-01T00:00:00.000Z',
        payment_status: 'unpaid',
        status: 'sent',
      })),
      {
        id: 'invoice-void',
        invoice_number: 'XDR-01001',
        amount: 100,
        due_date: '2026-07-01',
        created_at: '2026-07-01T00:00:00.000Z',
        payment_status: 'unpaid',
        status: 'void',
      },
    ];
    mocks.datasets.support_tickets = [
      ...makeRows(10, (index) => ({
        id: `ticket-p1-${index}`,
        subject: `Critical ${index}`,
        status: 'open',
        priority: 'critical',
        category: 'support',
        created_at: '2026-08-05T00:00:00.000Z',
      })),
      { id: 'ticket-p0', subject: 'Critical investigate', status: 'investigating', priority: 'critical', category: 'support', created_at: '2026-08-05T00:00:00.000Z' },
      ...makeRows(4, (index) => ({
        id: `gdpr-p0-${index}`,
        subject: `GDPR ${index}`,
        status: 'open',
        priority: 'high',
        category: 'compliance',
        created_at: '2026-07-10T00:00:00.000Z',
      })),
      ...makeRows(3, (index) => ({
        id: `gdpr-p1-${index}`,
        subject: `GDPR late ${index}`,
        status: 'investigating',
        priority: 'medium',
        category: 'compliance',
        created_at: '2026-07-15T00:00:00.000Z',
      })),
    ];

    mocks.from.mockImplementation((table: keyof typeof mocks.datasets) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mocks.datasets.profiles[0] ?? null, error: null }),
            }),
          }),
        };
      }

      return new QueryBuilder(
        table,
        mocks.datasets[table] ?? [],
        mocks.tableErrors[table] ?? null,
      );
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps preview queries bounded while returning exact queue counts and an honest unknown financial amount', async () => {
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
        financialExposure: { count: number; severity: string; note: string };
      };
      actionQueue: { total: number; p0: number; p1: number; p2: number; items: Array<{ entityId: string; type: string }> };
    };

    expect(body.attentionIndicators.p0p1Incidents.count).toBe(134);
    expect(body.attentionIndicators.jobsAtRisk.count).toBe(16);
    expect(body.attentionIndicators.blockedAccounts.count).toBe(12);
    expect(body.attentionIndicators.financialExposure).toMatchObject({
      count: 21,
      severity: 'unknown',
      note: 'Exact overdue amount unavailable without a safe database aggregate.',
    });
    expect(body.actionQueue.total).toBe(139);
    expect(body.actionQueue.p0).toBe(9);
    expect(body.actionQueue.p1).toBe(125);
    expect(body.actionQueue.p2).toBe(5);
    expect(body.actionQueue.items).toHaveLength(50);
    expect(body.actionQueue.items.some((item) => item.type === 'fraud_case' && item.entityId === 'co-p0')).toBe(true);
    expect(body.actionQueue.items.some((item) => item.entityId === 'invoice-void')).toBe(false);

    expect(mocks.limitCalls.length).toBeGreaterThan(0);
    expect(mocks.limitCalls.every((call) => call.limit <= 50)).toBe(true);
    expect(mocks.limitCalls.filter((call) => call.table === 'companies')).toHaveLength(1);
    expect(mocks.limitCalls.filter((call) => call.table === 'jobs')).toHaveLength(2);
    expect(mocks.limitCalls.filter((call) => call.table === 'driver_documents')).toHaveLength(2);
    expect(mocks.limitCalls.filter((call) => call.table === 'fraud_review_cases')).toHaveLength(1);
    expect(mocks.limitCalls.filter((call) => call.table === 'invoices')).toHaveLength(1);
    expect(mocks.limitCalls.filter((call) => call.table === 'support_tickets')).toHaveLength(2);
  });

  it('does not classify missing-column invoice errors as missing tables', async () => {
    mocks.tableErrors.invoices = { code: '42703', message: 'column invoices.amount does not exist' };

    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/command-centre', {
      headers: { Authorization: '******' },
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as {
      partialData?: boolean;
      unavailableSources?: string[];
      queryErrors?: string[];
      attentionIndicators: {
        financialExposure: { count: number | null; severity: string; note: string };
      };
    };

    expect(body.partialData).toBe(true);
    expect(body.unavailableSources ?? []).not.toContain('invoices');
    expect(body.queryErrors?.some((entry) => entry.includes('invoices_overdue: column invoices.amount does not exist'))).toBe(true);
    expect(body.attentionIndicators.financialExposure).toMatchObject({
      count: null,
      severity: 'unknown',
      note: 'Overdue invoice totals unavailable.',
    });
  });

  it('marks actionQueue as derived and includes a queueNote', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/command-centre', {
      headers: { Authorization: '******' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      actionQueue: { derived: boolean; queueNote: string };
    };
    expect(body.actionQueue.derived).toBe(true);
    expect(typeof body.actionQueue.queueNote).toBe('string');
    expect(body.actionQueue.queueNote.length).toBeGreaterThan(0);
  });

  it('returns indicator labels from the API payload, not hard-coded UI strings', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/command-centre', {
      headers: { Authorization: '******' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      attentionIndicators: {
        p0p1Incidents: { label: string };
        jobsAtRisk: { label: string };
        blockedAccounts: { label: string };
        financialExposure: { label: string };
        degradedServices: { label: string };
      };
    };
    expect(typeof body.attentionIndicators.p0p1Incidents.label).toBe('string');
    expect(body.attentionIndicators.p0p1Incidents.label.length).toBeGreaterThan(0);
    expect(typeof body.attentionIndicators.jobsAtRisk.label).toBe('string');
    expect(typeof body.attentionIndicators.blockedAccounts.label).toBe('string');
    expect(typeof body.attentionIndicators.financialExposure.label).toBe('string');
    expect(typeof body.attentionIndicators.degradedServices.label).toBe('string');
  });

  it('future-expiry document rows have negative ageMinutes, not zero', async () => {
    // Isolated fixture: clear competing datasets so the single future-expiry doc is in the top-50 preview.
    mocks.datasets.companies = [];
    mocks.datasets.jobs = [];
    mocks.datasets.fraud_review_cases = [];
    mocks.datasets.invoices = [];
    mocks.datasets.support_tickets = [];
    // One approved future-expiry document; system time is 2026-08-06T12:00:00Z.
    mocks.datasets.driver_documents = [
      {
        id: 'future-doc-1',
        driver_id: 'driver-future-1',
        doc_type: 'cpc_card',
        expiry_date: '2026-08-07T00:00:00.000Z',
        status: 'approved',
      },
    ];

    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/command-centre', {
      headers: { Authorization: '******' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      actionQueue: { items: Array<{ type: string; ageMinutes: number; entityName: string }> };
    };
    const expiringItems = body.actionQueue.items.filter((i) => i.type === 'document_expiring');
    expect(expiringItems.length).toBe(1);
    expect(expiringItems[0].ageMinutes).toBeLessThan(0);
    expect(typeof expiringItems[0].entityName).toBe('string');
    expect(expiringItems[0].entityName.length).toBeGreaterThan(0);
  });

  it('every queue item exposes entityName', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/command-centre', {
      headers: { Authorization: '******' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      actionQueue: { items: Array<{ entityName: string; entityType: string }> };
    };
    for (const item of body.actionQueue.items) {
      expect(typeof item.entityName).toBe('string');
      expect(item.entityName.length).toBeGreaterThan(0);
      expect(typeof item.entityType).toBe('string');
    }
  });
});
