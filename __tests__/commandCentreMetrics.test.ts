import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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
    auth: { getUser: mocks.getUser },
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

  maybeSingle() {
    const evaluated = this.evaluate();
    return Promise.resolve({ data: evaluated.rows[0] ?? null, error: this.error });
  }

  then<TResult1 = { data: T[] | null; error: { code?: string; message: string } | null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: { code?: string; message: string } | null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const evaluated = this.evaluate();
    return Promise.resolve({
      data: this.head ? null : evaluated.rows,
      error: this.error,
      count: this.countRequested ? evaluated.count : null,
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

    if (this.limitValue !== null) filtered = filtered.slice(0, this.limitValue);
    return { rows: filtered, count };
  }
}

const request = () => new NextRequest('http://localhost/api/super-admin/command-centre', {
  headers: { Authorization: 'Bearer owner-token' },
});

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

    mocks.getBearerToken.mockReturnValue('owner-token');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1', email: 'owner@example.test' } }, error: null });

    mocks.datasets.profiles = [{ user_id: 'owner-1', role: 'owner', status: 'active' }];
    mocks.datasets.companies = [
      { id: 'company-pending', name: 'Pending Co', status: 'pending_approval', created_at: '2026-08-05T00:00:00.000Z' },
      { id: 'company-suspended', name: 'Suspended Co', status: 'suspended', created_at: '2026-08-01T00:00:00.000Z' },
    ];
    mocks.datasets.jobs = [
      {
        id: 'job-risk', status: 'allocated', pickup_location: 'Blackburn', delivery_location: 'Manchester',
        updated_at: '2026-08-06T09:00:00.000Z', created_at: '2026-08-06T08:00:00.000Z', assigned_driver_id: 'driver-1',
      },
      {
        id: 'job-no-driver', status: 'awarded', pickup_location: 'Leeds', delivery_location: 'York',
        updated_at: '2026-08-06T08:00:00.000Z', created_at: '2026-08-06T07:00:00.000Z', assigned_driver_id: null,
      },
    ];
    mocks.datasets.driver_documents = [
      { id: 'doc-future', driver_id: 'driver-1', doc_type: 'insurance', expiry_date: '2026-08-07T00:00:00.000Z', status: 'approved' },
      { id: 'doc-expired', driver_id: 'driver-2', doc_type: 'mot', expiry_date: '2026-08-01T00:00:00.000Z', status: 'approved' },
    ];
    mocks.datasets.fraud_review_cases = [
      { id: 'fraud-1', subject_company_id: 'company-fraud', status: 'open', created_at: '2026-08-05T00:00:00.000Z' },
    ];
    mocks.datasets.invoices = [
      {
        id: 'invoice-overdue', invoice_number: 'INV-1', amount: 125, currency: 'GBP', due_date: '2026-07-01',
        created_at: '2026-07-01T00:00:00.000Z', payment_status: 'unpaid', status: 'sent',
      },
      {
        id: 'invoice-void', invoice_number: 'INV-VOID', amount: 999, currency: 'GBP', due_date: '2026-07-01',
        created_at: '2026-07-01T00:00:00.000Z', payment_status: 'unpaid', status: 'void',
      },
    ];
    mocks.datasets.support_tickets = [
      { id: 'critical-1', subject: 'Critical ticket', status: 'open', priority: 'critical', category: 'support', created_at: '2026-08-05T00:00:00.000Z' },
      { id: 'gdpr-1', subject: 'SAR request', status: 'open', priority: 'high', category: 'compliance', created_at: '2026-07-10T00:00:00.000Z' },
    ];

    mocks.from.mockImplementation((table: keyof typeof mocks.datasets) => new QueryBuilder(
      table,
      mocks.datasets[table] ?? [],
      mocks.tableErrors[table] ?? null,
    ));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps preview queries bounded while returning exact counts and collectible invoice truth', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    expect(response.status).toBe(200);

    const body = await response.json() as {
      attentionIndicators: {
        p0p1Incidents: { count: number | null; label: string };
        jobsAtRisk: { count: number | null; label: string };
        blockedAccounts: { count: number | null; label: string };
        financialExposure: { count: number | null; label: string; severity: string; note?: string };
        degradedServices: { count: number | null; label: string };
      };
      actionQueue: {
        derived: boolean;
        queueNote: string;
        total: number | null;
        items: Array<{ entityId: string; entityName: string; type: string; ageMinutes: number }>;
      };
    };

    expect(body.attentionIndicators.jobsAtRisk.count).toBe(2);
    expect(body.attentionIndicators.blockedAccounts.count).toBe(1);
    expect(body.attentionIndicators.financialExposure).toMatchObject({
      count: 1,
      label: 'Overdue invoices',
      severity: 'unknown',
    });
    expect(body.actionQueue.total).not.toBeNull();
    expect(body.actionQueue.items.some((item) => item.entityId === 'invoice-void')).toBe(false);
    expect(body.actionQueue.items.some((item) => item.entityId === 'invoice-overdue')).toBe(true);

    expect(mocks.limitCalls.length).toBeGreaterThan(0);
    expect(mocks.limitCalls.every((call) => call.limit <= 50)).toBe(true);
  });

  it('does not classify missing-column invoice errors as missing tables', async () => {
    mocks.tableErrors.invoices = { code: '42703', message: 'column invoices.amount does not exist' };
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    expect(response.status).toBe(503);
    const body = await response.json() as { error?: string; queryErrors?: string[] };
    expect(body.error).toContain('could not be determined safely');
    expect(body.queryErrors?.join(' ')).toContain('invoices_overdue');
  });

  it('marks the action queue as derived and includes a non-empty queue note', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    const body = await response.json() as { actionQueue: { derived: boolean; queueNote: string } };
    expect(response.status).toBe(200);
    expect(body.actionQueue.derived).toBe(true);
    expect(body.actionQueue.queueNote.length).toBeGreaterThan(0);
  });

  it('returns all attention-indicator labels from the API payload', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    const body = await response.json() as {
      attentionIndicators: Record<string, { label: string }>;
    };
    expect(response.status).toBe(200);
    for (const indicator of Object.values(body.attentionIndicators)) {
      expect(typeof indicator.label).toBe('string');
      expect(indicator.label.length).toBeGreaterThan(0);
    }
  });

  it('preserves negative ageMinutes for future expiry events', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    const body = await response.json() as {
      actionQueue: { items: Array<{ entityId: string; ageMinutes: number }> };
    };
    const future = body.actionQueue.items.find((item) => item.entityId === 'driver-1');
    expect(future).toBeDefined();
    expect(future!.ageMinutes).toBeLessThan(0);
  });

  it('gives every queue item an entityName for deterministic drill-down context', async () => {
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    const body = await response.json() as {
      actionQueue: { items: Array<{ entityName: string }> };
    };
    expect(response.status).toBe(200);
    expect(body.actionQueue.items.length).toBeGreaterThan(0);
    expect(body.actionQueue.items.every((item) => typeof item.entityName === 'string' && item.entityName.length > 0)).toBe(true);
  });

  it('fails closed when the owner profile is not active', async () => {
    mocks.datasets.profiles = [{ user_id: 'owner-1', role: 'owner', status: 'suspended' }];
    const { GET } = await import('../app/api/super-admin/command-centre/route');
    const response = await GET(request());
    expect(response.status).toBe(403);
  });
});
