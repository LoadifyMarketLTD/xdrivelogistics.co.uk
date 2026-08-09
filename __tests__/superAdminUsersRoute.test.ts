import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  getUserById: vi.fn(),
  from: vi.fn(),
  membershipInCalls: [] as Array<{ column: string; values: unknown[] }>,
  selectCalls: [] as Array<{ table: string; columns: string }>,
  memberships: [] as Array<Record<string, unknown>>,
  profileRows: [] as Array<Record<string, unknown>>,
  driverRows: [] as Array<Record<string, unknown>>,
  companyRows: [] as Array<Record<string, unknown>>,
  authEmails: {} as Record<string, string>,
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
    auth: {
      admin: {
        getUserById: mocks.getUserById,
      },
    },
    from: mocks.from,
  },
}));

class QueryBuilder<T extends Record<string, unknown>> {
  private readonly filters: Array<(row: T) => boolean> = [];
  private rangeValue: [number, number] | null = null;
  private orderDescending = false;

  constructor(
    private readonly table: string,
    private readonly rows: T[],
  ) {}

  select(columns: string) {
    mocks.selectCalls.push({ table: this.table, columns });
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column as keyof T] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    if (this.table === 'company_memberships') {
      mocks.membershipInCalls.push({ column, values });
    }
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
    const rows = this.evaluate(true);
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<TResult1 = { data: T[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const allRows = this.evaluate(false);
    const rows = this.evaluate(true);
    return Promise.resolve({ data: rows, error: null, count: allRows.length }).then(onfulfilled, onrejected);
  }

  private evaluate(applyRange: boolean) {
    let rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderDescending) {
      rows = [...rows].sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));
    }
    if (applyRange && this.rangeValue) {
      rows = rows.slice(this.rangeValue[0], this.rangeValue[1] + 1);
    }
    return rows;
  }
}

describe('GET /api/super-admin/users production-schema role filters', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.getUserById.mockReset();
    mocks.from.mockReset();
    mocks.membershipInCalls = [];
    mocks.selectCalls = [];

    mocks.getBearerToken.mockReturnValue('token');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    mocks.authEmails = {
      'owner-1': 'platform-owner@example.com',
      'company-owner-1': 'owner@example.com',
      'company-admin-1': 'admin@example.com',
      'customer-1': 'customer@example.com',
      'driver-1-user': 'driver@example.com',
    };
    mocks.getUserById.mockImplementation(async (userId: string) => ({
      data: {
        user: {
          id: userId,
          email: mocks.authEmails[userId] ?? null,
        },
      },
      error: null,
    }));

    mocks.profileRows = [
      {
        user_id: 'owner-1',
        full_name: 'Platform Owner',
        role: 'owner',
        status: 'active',
        company_id: 'company-1',
        created_at: '2026-08-01T00:00:00.000Z',
      },
      {
        user_id: 'company-owner-1',
        full_name: 'Owner User',
        role: 'company_admin',
        status: 'active',
        company_id: 'company-1',
        created_at: '2026-08-02T00:00:00.000Z',
      },
      {
        user_id: 'company-admin-1',
        full_name: 'Admin User',
        role: 'company_admin',
        status: 'active',
        company_id: 'company-2',
        created_at: '2026-08-03T00:00:00.000Z',
      },
      {
        user_id: 'customer-1',
        full_name: 'Customer User',
        role: 'customer',
        status: 'active',
        company_id: 'company-3',
        created_at: '2026-08-04T00:00:00.000Z',
      },
    ];

    mocks.memberships = [
      {
        user_id: 'company-owner-1',
        invited_email: null,
        role_in_company: 'owner',
        created_at: '2026-08-02T00:00:00.000Z',
        company_id: 'company-1',
        companies: { name: 'Acme', status: 'active' },
      },
      {
        user_id: 'company-admin-1',
        invited_email: null,
        role_in_company: 'admin',
        created_at: '2026-08-03T00:00:00.000Z',
        company_id: 'company-2',
        companies: { name: 'Beacon', status: 'active' },
      },
    ];

    mocks.driverRows = [
      {
        id: 'driver-1',
        user_id: 'driver-1-user',
        name: 'Legacy Driver Name',
        full_name: 'Canonical Driver Name',
        display_name: 'Display Driver Name',
        email: 'driver@example.com',
        phone: '07000000000',
        status: 'active',
        availability_status: 'available',
        app_access: true,
        created_at: '2026-08-05T00:00:00.000Z',
        company_id: 'company-2',
        companies: { name: 'Beacon' },
      },
    ];

    mocks.companyRows = [
      { id: 'company-1', name: 'Acme', status: 'active' },
      { id: 'company-2', name: 'Beacon', status: 'active' },
      { id: 'company-3', name: 'Customer Co', status: 'active' },
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') return new QueryBuilder(table, mocks.profileRows);
      if (table === 'company_memberships') return new QueryBuilder(table, mocks.memberships);
      if (table === 'drivers') return new QueryBuilder(table, mocks.driverRows);
      if (table === 'companies') return new QueryBuilder(table, mocks.companyRows);
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('serves company_admin through owner/admin memberships and resolves canonical profile/Auth identity fields', async () => {
    const { GET } = await import('../app/api/super-admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/users?role=company_admin&limit=50&page=1'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      role: string;
      rows: Array<{ role: string; name: string; email: string }>;
      total: number;
    };

    expect(body.role).toBe('company_admin');
    expect(body.total).toBe(2);
    expect(body.rows).toHaveLength(2);
    expect(body.rows.every((row) => row.role === 'company_admin')).toBe(true);
    expect(body.rows.map((row) => row.name)).toEqual(['Admin User', 'Owner User']);
    expect(body.rows.map((row) => row.email)).toEqual(['admin@example.com', 'owner@example.com']);
    expect(mocks.membershipInCalls).toContainEqual({
      column: 'role_in_company',
      values: ['owner', 'admin'],
    });

    const profileSelect = mocks.selectCalls.find(
      (call) => call.table === 'profiles' && call.columns.includes('full_name'),
    );
    expect(profileSelect?.columns).toBe('user_id, full_name');
    expect(profileSelect?.columns).not.toContain('display_name');
    expect(profileSelect?.columns).not.toContain('email');
  });

  it('loads customers from profiles.role=customer rather than an invalid customer membership role', async () => {
    const { GET } = await import('../app/api/super-admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/users?role=customer'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      role: string;
      rows: Array<{ name: string; email: string; company: string; role: string }>;
      total: number;
    };

    expect(body.role).toBe('customer');
    expect(body.total).toBe(1);
    expect(body.rows).toEqual([
      expect.objectContaining({
        name: 'Customer User',
        email: 'customer@example.com',
        company: 'Customer Co',
        role: 'customer',
      }),
    ]);
    expect(mocks.membershipInCalls.some((call) => call.values.includes('customer'))).toBe(false);
  });

  it('uses the real Production driver name columns and never requests first_name/last_name', async () => {
    const { GET } = await import('../app/api/super-admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/users?role=driver'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      rows: Array<{ name: string; email: string; role: string }>;
      total: number;
    };

    expect(body.total).toBe(1);
    expect(body.rows[0]).toEqual(expect.objectContaining({
      name: 'Display Driver Name',
      email: 'driver@example.com',
      role: 'driver',
    }));

    const driverSelect = mocks.selectCalls.find(
      (call) => call.table === 'drivers' && call.columns.includes('display_name'),
    );
    expect(driverSelect?.columns).toContain('name');
    expect(driverSelect?.columns).toContain('full_name');
    expect(driverSelect?.columns).toContain('display_name');
    expect(driverSelect?.columns).not.toContain('first_name');
    expect(driverSelect?.columns).not.toContain('last_name');
  });

  it('loads platform admins from owner profiles with full_name and Auth email', async () => {
    const { GET } = await import('../app/api/super-admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/super-admin/users?role=platform_admin'));
    expect(res.status).toBe(200);

    const body = await res.json() as {
      rows: Array<{ name: string; email: string; role: string }>;
      total: number;
    };

    expect(body.total).toBe(1);
    expect(body.rows[0]).toEqual(expect.objectContaining({
      name: 'Platform Owner',
      email: 'platform-owner@example.com',
      role: 'owner',
    }));

    const platformProfileSelect = mocks.selectCalls.find(
      (call) => call.table === 'profiles' && call.columns.includes('status') && call.columns.includes('created_at'),
    );
    expect(platformProfileSelect?.columns).not.toContain('display_name');
    expect(platformProfileSelect?.columns).not.toContain('email');
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
