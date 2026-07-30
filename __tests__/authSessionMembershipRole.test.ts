import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  type DbError = {
    message: string;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  };
  type Result<T> = Promise<{ data: T; error: DbError | null }>;

  const ok = <T,>(data: T): Result<T> => Promise.resolve({ data, error: null });

  let profileRole = 'company_staff';
  let membershipRole = 'finance';
  let isDriver = false;

  const membership = () => ({
    id: 'membership-1',
    company_id: 'company-1',
    user_id: 'user-1',
    role_in_company: membershipRole,
    status: 'active',
    companies: {
      id: 'company-1',
      name: 'Company One',
      company_type: 'standard',
      status: 'active',
    },
  });

  class QueryBuilder<T> {
    constructor(private readonly result: Result<T>) {}
    select() { return this; }
    eq() { return this; }
    order() { return this.result; }
    limit() { return this; }
    maybeSingle() { return this.result; }
    returns() { return this.result; }
    upsert() { return this; }
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: { data: T; error: DbError | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.result.then(onfulfilled, onrejected);
    }
  }

  const supabase = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => new QueryBuilder(ok({
            role: profileRole,
            status: 'active',
            is_driver: isDriver,
            company_id: 'company-1',
          })),
          upsert: () => new QueryBuilder(ok(null)),
        };
      }

      if (table === 'company_memberships') {
        return {
          select: () => new QueryBuilder(ok([membership()])),
        };
      }

      if (table === 'drivers') {
        const rows = isDriver
          ? [{
              id: 'driver-1',
              company_id: 'company-1',
              user_id: 'user-1',
              must_change_password: false,
              status: 'active',
              app_access: true,
              driver_type: 'company_driver',
              can_commercial_bid: true,
            }]
          : [];
        return {
          select: () => new QueryBuilder(ok(rows)),
        };
      }

      if (table === 'companies') {
        return {
          select: (columns?: string) => {
            const result: Result<unknown> = columns?.trim() === 'status'
              ? ok<unknown>({ status: 'active' })
              : ok<unknown>(null);
            return new QueryBuilder<unknown>(result);
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: vi.fn(() => ok(null)),
  };

  return {
    supabase,
    setRole(role: string) {
      membershipRole = role;
      profileRole = role === 'driver' ? 'driver' : 'company_staff';
      isDriver = role === 'driver';
    },
    reset() {
      profileRole = 'company_staff';
      membershipRole = 'finance';
      isDriver = false;
    },
  };
});

vi.mock('../lib/supabaseClient', () => ({
  supabase: harness.supabase,
  isSupabaseConfigured: true,
  getSupabase: () => harness.supabase,
}));

import { resolveAuthenticatedUser } from '../lib/authSession';

describe('auth session application membership roles', () => {
  beforeEach(() => {
    harness.reset();
  });

  for (const role of ['finance', 'compliance', 'driver'] as const) {
    it(`preserves ${role} as an application-domain membership identity`, async () => {
      harness.setRole(role);

      const result = await resolveAuthenticatedUser({
        id: 'user-1',
        email: 'user@example.com',
        app_metadata: {},
      });

      expect(result.reason).toBeNull();
      expect(result.user).not.toBeNull();
      expect(result.user?.membershipRole).toBe(role);
    });
  }

  it('fails closed for an unknown membership identity', async () => {
    harness.setRole('invented_privileged_role');

    const result = await resolveAuthenticatedUser({
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
    });

    expect(result.user).toBeNull();
    expect(['company_context_missing', 'role_unsupported']).toContain(result.reason);
  });
});
