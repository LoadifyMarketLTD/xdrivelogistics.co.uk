import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  token: 'owner-token' as string | null,
  authUser: { id: 'owner-1' } as { id: string } | null,
  authError: null as { message: string } | null,
  datasets: {
    profiles: [] as Array<Record<string, unknown>>,
    companies: [] as Array<Record<string, unknown>>,
    drivers: [] as Array<Record<string, unknown>>,
    jobs: [] as Array<Record<string, unknown>>,
    invoices: [] as Array<Record<string, unknown>>,
    driver_documents: [] as Array<Record<string, unknown>>,
    vehicle_documents: [] as Array<Record<string, unknown>>,
  },
}));

class QueryBuilder<T extends Record<string, unknown>> {
  private readonly filters: Array<(row: T) => boolean> = [];
  private head = false;
  private countRequested = false;

  constructor(private readonly rows: T[]) {}

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

  maybeSingle() {
    const rows = this.filtered();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<TResult1 = { data: T[] | null; error: null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const rows = this.filtered();
    return Promise.resolve({
      data: this.head ? null : rows,
      error: null,
      count: this.countRequested ? rows.length : null,
    }).then(onfulfilled, onrejected);
  }

  private filtered() {
    return this.rows.filter((row) => this.filters.every((filter) => filter(row)));
  }
}

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: () => mocks.token,
  isSupabaseAdminConfigured: true,
  supabaseValidator: {
    auth: {
      getUser: async () => ({ data: { user: mocks.authUser }, error: mocks.authError }),
    },
  },
  supabaseAdmin: {
    from: (table: keyof typeof mocks.datasets) => new QueryBuilder(mocks.datasets[table] ?? []),
  },
}));

describe('GET /api/super-admin/stats contract', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.token = 'owner-token';
    mocks.authUser = { id: 'owner-1' };
    mocks.authError = null;
    mocks.datasets.profiles = [
      { user_id: 'owner-1', role: 'owner', status: 'active', is_internal_account: false },
      { user_id: 'internal-1', role: 'admin', status: 'active', is_internal_account: true },
    ];
    mocks.datasets.companies = [
      { id: 'c1', status: 'active' },
      { id: 'c2', status: 'active' },
      { id: 'c3', status: 'pending_approval' },
      { id: 'c4', status: 'pending_approval' },
      { id: 'c5', status: 'suspended' },
    ];
    mocks.datasets.drivers = [
      { id: 'd1', user_id: 'external-1' },
      { id: 'd2', user_id: 'internal-1' },
    ];
    mocks.datasets.jobs = [
      { id: 'j1', status: 'posted' },
      { id: 'j2', status: 'allocated' },
      { id: 'j3', status: 'delivered' },
      { id: 'j4', status: 'cancelled' },
    ];
    mocks.datasets.invoices = [
      { id: 'i1', status: 'sent', payment_status: 'unpaid' },
      { id: 'i2', status: 'sent', payment_status: 'partially_paid' },
      { id: 'i3', status: 'overdue', payment_status: 'overdue' },
      { id: 'i4', status: 'Disputed', payment_status: 'disputed' },
      { id: 'i5', status: 'draft', payment_status: 'unpaid' },
      { id: 'i6', status: 'void', payment_status: 'unpaid' },
      { id: 'i7', status: 'paid', payment_status: 'unpaid' },
      { id: 'i8', status: 'paid', payment_status: 'paid' },
      { id: 'i9', status: 'sent', payment_status: 'refunded' },
    ];
    mocks.datasets.driver_documents = [
      { id: 'dd1', status: 'pending' },
      { id: 'dd2', status: 'approved' },
    ];
    mocks.datasets.vehicle_documents = [
      { id: 'vd1', status: 'rejected' },
      { id: 'vd2', status: 'approved' },
    ];
  });

  it('returns 401 when the bearer token is missing', async () => {
    mocks.token = null;
    const { GET } = await import('../app/api/super-admin/stats/route');
    const response = await GET(new NextRequest('http://localhost/api/super-admin/stats'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when an authenticated user is not the platform owner', async () => {
    mocks.datasets.profiles[0] = { user_id: 'owner-1', role: 'admin', status: 'active', is_internal_account: false };
    const { GET } = await import('../app/api/super-admin/stats/route');
    const response = await GET(new NextRequest('http://localhost/api/super-admin/stats', {
      headers: { Authorization: 'Bearer owner-token' },
    }));
    expect(response.status).toBe(403);
  });

  it('returns 403 when the platform owner profile is not active', async () => {
    mocks.datasets.profiles[0] = { user_id: 'owner-1', role: 'owner', status: 'suspended', is_internal_account: false };
    const { GET } = await import('../app/api/super-admin/stats/route');
    const response = await GET(new NextRequest('http://localhost/api/super-admin/stats', {
      headers: { Authorization: 'Bearer owner-token' },
    }));
    expect(response.status).toBe(403);
  });

  it('returns exact operational counts and canonical outstanding invoice semantics', async () => {
    const { GET } = await import('../app/api/super-admin/stats/route');
    const response = await GET(new NextRequest('http://localhost/api/super-admin/stats', {
      headers: { Authorization: 'Bearer owner-token' },
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;

    expect(body).toMatchObject({
      companiesTotal: 5,
      companiesActive: 2,
      companiesSuspended: 1,
      companiesPending: 2,
      driversTotal: 1,
      jobsTotal: 4,
      jobsOpen: 2,
      jobsDelivered: 1,
      invoicesTotal: 9,
      invoicesUnpaid: 5,
      compliancePending: 2,
    });
    expect(typeof body.refreshedAt).toBe('string');
  });
});
