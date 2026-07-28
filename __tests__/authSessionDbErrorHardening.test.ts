/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authHarness = vi.hoisted(() => {
  type QueryResult<T> = Promise<{
    data: T;
    error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null;
  }>;

  type Fixtures = {
    profile: QueryResult<any>;
    membershipsInitial: QueryResult<any>;
    membershipsRetry?: QueryResult<any>;
    drivers: QueryResult<any>;
    creatorCompany: QueryResult<any>;
    companyStatus: QueryResult<any>;
    profileUpsertResult: QueryResult<any>;
  };

  const ok = <T,>(data: T): QueryResult<T> => Promise.resolve({ data, error: null });
  const err = (message: string): QueryResult<any> => Promise.resolve({
    data: null,
    error: { message, code: '500', details: null, hint: null },
  });

  const membership = (id: string, companyId: string) => ({
    id,
    company_id: companyId,
    user_id: 'user-1',
    role_in_company: 'owner',
    status: 'active',
    companies: {
      id: companyId,
      name: `Company ${companyId}`,
      company_type: 'standard',
      status: 'active',
    },
  });

  const baseFixtures = (): Fixtures => ({
    profile: ok({ role: 'customer', status: 'active', is_driver: false, company_id: null }),
    membershipsInitial: ok([membership('mem-1', 'co-1')]),
    drivers: ok([]),
    creatorCompany: ok(null),
    companyStatus: ok({ status: 'active' }),
    profileUpsertResult: ok({ role: 'customer', status: 'active', is_driver: false, company_id: null }),
  });

  let fixtures: Fixtures = baseFixtures();
  let membershipSelectCount = 0;
  let profileUpsertCount = 0;
  const rpcCalls: string[] = [];

  class QueryBuilder<T> {
    private result: QueryResult<T>;

    constructor(result: QueryResult<T>) {
      this.result = result;
    }

    select() { return this; }
    eq() { return this; }
    order() { return this.result; }
    limit() { return this; }
    maybeSingle() { return this.result; }
    returns() { return this.result; }
    upsert() { return this; }

    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return this.result.then(onfulfilled, onrejected);
    }
  }

  const supabase = {
    from: (table: string) => {
      if (table === 'profiles') {
        const query = new QueryBuilder(fixtures.profile);
        return {
          select: () => query,
          upsert: () => {
            profileUpsertCount += 1;
            return {
              select: () => ({
                maybeSingle: () => fixtures.profileUpsertResult,
              }),
            };
          },
        };
      }

      if (table === 'company_memberships') {
        membershipSelectCount += 1;
        const result = membershipSelectCount === 1
          ? fixtures.membershipsInitial
          : (fixtures.membershipsRetry ?? fixtures.membershipsInitial);
        return {
          select: () => new QueryBuilder(result),
        };
      }

      if (table === 'drivers') {
        return {
          select: () => new QueryBuilder(fixtures.drivers),
        };
      }

      if (table === 'companies') {
        return {
          select: (columns?: string) =>
            new QueryBuilder(
              typeof columns === 'string' && columns.includes('status')
                ? fixtures.companyStatus
                : fixtures.creatorCompany,
            ),
        };
      }

      return {
        select: () => new QueryBuilder(ok(null)),
      };
    },
    rpc: vi.fn((name: string) => {
      rpcCalls.push(name);
      return ok(null);
    }),
  };

  return {
    setFixtures(next: Partial<Fixtures>) {
      fixtures = { ...baseFixtures(), ...next };
      membershipSelectCount = 0;
      profileUpsertCount = 0;
      rpcCalls.length = 0;
    },
    getProfileUpsertCount: () => profileUpsertCount,
    getRpcCalls: () => [...rpcCalls],
    ok,
    err,
    membership,
    supabase,
  };
});

vi.mock('../lib/supabaseClient', () => ({
  supabase: authHarness.supabase,
  isSupabaseConfigured: true,
  getSupabase: () => authHarness.supabase,
}));

import { resolveAuthenticatedUser } from '../lib/authSession';

describe('authSession db-error hardening', () => {
  beforeEach(() => {
    authHarness.setFixtures({});
  });

  it('returns db_error when profile query fails and does not bootstrap profile', async () => {
    authHarness.setFixtures({
      profile: authHarness.err('profile read failed'),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'customer' } });

    expect(result.user).toBeNull();
    expect(result.reason).toBe('db_error');
    if (result.reason === 'db_error') {
      expect(result.dbError.query).toContain('profiles.select');
    }
    expect(authHarness.getProfileUpsertCount()).toBe(0);
  });

  it('returns db_error when membership query still fails after retry', async () => {
    authHarness.setFixtures({
      membershipsInitial: authHarness.err('memberships order failed'),
      membershipsRetry: authHarness.err('memberships retry failed'),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'customer' } });

    expect(result.user).toBeNull();
    expect(result.reason).toBe('db_error');
    if (result.reason === 'db_error') {
      expect(result.dbError.query).toContain('company_memberships.select');
    }
  });

  it('membership query error does not use profile.company_id and does not call bootstrap_company_membership', async () => {
    authHarness.setFixtures({
      profile: authHarness.ok({ role: 'customer', status: 'active', is_driver: false, company_id: 'co-profile' }),
      membershipsInitial: authHarness.err('memberships failed'),
      membershipsRetry: authHarness.err('memberships retry failed'),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'customer' } });

    expect(result.user).toBeNull();
    expect(result.reason).toBe('db_error');
    expect(authHarness.getRpcCalls()).not.toContain('bootstrap_company_membership');
  });

  it('driver query error returns db_error and cannot produce driver access', async () => {
    authHarness.setFixtures({
      profile: authHarness.ok({ role: 'driver', status: 'active', is_driver: true, company_id: 'co-1' }),
      membershipsInitial: authHarness.ok([authHarness.membership('mem-1', 'co-1')]),
      drivers: authHarness.err('drivers failed'),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'driver' } });

    expect(result.user).toBeNull();
    expect(result.reason).toBe('db_error');
    if (result.reason === 'db_error') {
      expect(result.dbError.query).toContain('drivers.select');
    }
  });

  it('creator-company query error returns db_error and cannot alter role/company resolution', async () => {
    authHarness.setFixtures({
      creatorCompany: authHarness.err('creator company failed'),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'customer' } });

    expect(result.user).toBeNull();
    expect(result.reason).toBe('db_error');
    if (result.reason === 'db_error') {
      expect(result.dbError.query).toContain('companies.select');
    }
  });

  it('successful empty profile remains distinct from profile query error', async () => {
    authHarness.setFixtures({
      profile: authHarness.ok(null),
      profileUpsertResult: authHarness.ok({ role: 'customer', status: 'active', is_driver: false, company_id: null }),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'customer' } });

    expect(result.reason).toBeNull();
    expect(result.user).not.toBeNull();
    expect(authHarness.getProfileUpsertCount()).toBe(1);
  });

  it('successful empty memberships remains distinct from membership query error', async () => {
    authHarness.setFixtures({
      profile: authHarness.ok({ role: 'customer', status: 'active', is_driver: false, company_id: null }),
      membershipsInitial: authHarness.ok([]),
    });

    const result = await resolveAuthenticatedUser({ id: 'user-1', app_metadata: { role: 'customer' } });

    expect(result.reason).toBeNull();
    expect(result.user).not.toBeNull();
    if (result.user) {
      expect(result.user.companyId).toBeNull();
      expect(result.user.membershipId).toBeNull();
      expect(result.user.role).toBe('customer');
    }
  });
});
