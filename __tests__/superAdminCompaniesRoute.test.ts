import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  companies: [] as Array<Record<string, unknown>>,
  ownerAuditFull: { data: null as Array<Record<string, unknown>> | null, error: null as { code?: string; message: string } | null },
  ownerAuditLegacy: { data: null as Array<Record<string, unknown>> | null, error: null as { code?: string; message: string } | null },
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
  private limitValue: number | null = null;
  private rangeValue: [number, number] | null = null;

  constructor(private readonly rows: T[]) {}

  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column as keyof T] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column as keyof T]));
    return this;
  }
  order() { return this; }

  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }

  then<TResult1 = { data: T[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    let rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    const count = rows.length;
    if (this.rangeValue) rows = rows.slice(this.rangeValue[0], this.rangeValue[1] + 1);
    if (this.limitValue !== null) rows = rows.slice(0, this.limitValue);
    return Promise.resolve({ data: rows, error: null, count }).then(onfulfilled, onrejected);
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }
}

describe('GET /api/super-admin/companies governance history fallback', () => {
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

    mocks.companies = [{
      id: 'company-1',
      name: 'Acme Logistics',
      company_number: '123',
      email: 'ops@example.com',
      status: 'pending_approval',
      company_type: 'carrier',
      created_at: '2026-08-01T00:00:00.000Z',
    }];

    mocks.ownerAuditFull = {
      data: null,
      error: { code: '42703', message: 'column owner_audit_log.old_status does not exist' },
    };
    mocks.ownerAuditLegacy = {
      data: [],
      error: null,
    };

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: 'owner' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'companies') {
        return new QueryBuilder(mocks.companies);
      }

      if (table === 'owner_audit_log') {
        return {
          select: (columns: string) => ({
            order: () => ({
              limit: async () => (
                columns.includes('old_status')
                  ? mocks.ownerAuditFull
                  : mocks.ownerAuditLegacy
              ),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('uses the verified legacy old_value/new_value fallback instead of reporting false empty availability', async () => {
    mocks.ownerAuditLegacy = {
      data: [{
        id: 'audit-1',
        target_company_id: 'company-1',
        action_type: 'status_change',
        old_value: 'pending_approval',
        new_value: 'active',
        reason: 'Approved',
        created_at: '2026-08-02T00:00:00.000Z',
      }],
      error: null,
    };

    const { GET } = await import('../app/api/super-admin/companies/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/companies?status=pending'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      governanceHistoryAvailable: boolean;
      governanceHistoryError: string | null;
      governanceHistoryRecent: Array<{ old_status: string; new_status: string }>;
      governanceHistoryByCompany: Record<string, Array<{ old_status: string; new_status: string }>>;
    };

    expect(body.governanceHistoryAvailable).toBe(true);
    expect(body.governanceHistoryError).toBeNull();
    expect(body.governanceHistoryRecent).toHaveLength(1);
    expect(body.governanceHistoryRecent[0]).toMatchObject({
      old_status: 'pending_approval',
      new_status: 'active',
    });
    expect(body.governanceHistoryByCompany['company-1']).toHaveLength(1);
  });

  it('preserves structurally valid company audit rows even when optional status values are absent', async () => {
    mocks.ownerAuditLegacy = {
      data: [{
        id: 'audit-2',
        target_company_id: 'company-1',
        action_type: 'status_change',
        old_value: 'pending_approval',
        created_at: '2026-08-02T00:00:00.000Z',
      }],
      error: null,
    };

    const { GET } = await import('../app/api/super-admin/companies/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/companies?status=pending'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      governanceHistoryAvailable: boolean;
      governanceHistoryError: string | null;
      governanceHistoryRecent: Array<Record<string, unknown>>;
      governanceHistoryByCompany: Record<string, Array<Record<string, unknown>>>;
    };

    expect(body.governanceHistoryAvailable).toBe(true);
    expect(body.governanceHistoryError).toBeNull();
    expect(body.governanceHistoryRecent).toHaveLength(1);
    expect(body.governanceHistoryRecent[0]).toMatchObject({ old_status: 'pending_approval' });
    expect(body.governanceHistoryRecent[0]).not.toHaveProperty('new_status');
    expect(body.governanceHistoryByCompany['company-1']).toHaveLength(1);
  });
});
