import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  membershipInCalls: [] as Array<{ column: string; values: unknown[] }>,
  memberships: [] as Array<Record<string, unknown>>,
  authProfile: { role: 'owner' as string },
  profileRows: [] as Array<Record<string, unknown>>,
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
  private rangeValue: [number, number] | null = null;
  private orderDescending = false;

  constructor(private readonly rows: T[]) {}

  select() { return this; }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column as keyof T] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    mocks.membershipInCalls.push({ column, values });
    this.filters.push((row) => values.includes(row[column as keyof T]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderDescending = options?.ascending === false && column === 'created_at';
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }

  maybeSingle() {
    const rows = this.evaluate();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<TResult1 = { data: T[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const rows = this.evaluate();
    return Promise.resolve({ data: rows, error: null, count: rows.length }).then(onfulfilled, onrejected);
  }

  private evaluate() {
    let rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderDescending) {
      rows = [...rows].sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));
    }
    if (this.rangeValue) {
      rows = rows.slice(this.rangeValue[0], this.rangeValue[1] + 1);
    }
    return rows;
  }
}

describe('GET /api/super-admin/users role filters', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.membershipInCalls = [];

    mocks.getBearerToken.mockReturnValue('token');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    mocks.memberships = [
      {
        user_id: 'company-owner-1',
        role_in_company: 'owner',
        created_at: '2026-08-02T00:00:00.000Z',
        company_id: 'company-1',
        companies: { name: 'Acme', status: 'active' },
      },
      {
        user_id: 'company-admin-1',
        role_in_company: 'admin',
        created_at: '2026-08-03T00:00:00.000Z',
        company_id: 'company-2',
        companies: { name: 'Beacon', status: 'active' },
      },
    ];
    mocks.profileRows = [
      { user_id: 'company-owner-1', display_name: 'Owner User', email: 'owner@example.com' },
      { user_id: 'company-admin-1', display_name: 'Admin User', email: 'admin@example.com' },
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: (columns: string) => {
            if (columns === 'role') {
              return {
                eq: () => ({
                  maybeSingle: async () => ({ data: mocks.authProfile, error: null }),
                }),
              };
            }
            return new QueryBuilder(mocks.profileRows);
          },
        };
      }

      if (table === 'company_memberships') {
        return new QueryBuilder(mocks.memberships);
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('serves company_admin through canonical owner/admin membership roles instead of falling through to the all-users payload', async () => {
    const { GET } = await import('../app/api/super-admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/users?role=company_admin&limit=50&page=1'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      role: string;
      rows: Array<{ role: string; email: string }>;
      total: number;
      totalDrivers?: number;
    };

    expect(body.role).toBe('company_admin');
    expect(body.total).toBe(2);
    expect(body.rows).toHaveLength(2);
    expect(body.rows.every((row) => row.role === 'company_admin')).toBe(true);
    expect(body.totalDrivers).toBeUndefined();
    expect(mocks.membershipInCalls).toContainEqual({
      column: 'role_in_company',
      values: ['owner', 'admin'],
    });
  });

  it('rejects broker with a clear 400 instead of falling through to the all-users payload', async () => {
    const { GET } = await import('../app/api/super-admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/users?role=broker'));
    expect(res.status).toBe(400);

    const body = await res.json() as { error: string; role?: string };
    expect(body.error).toContain('Unsupported role filter: broker');
    expect(body.role).toBeUndefined();
  });
});
