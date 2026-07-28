import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryExpectation = {
  table: string;
  select: string;
  result: { data: unknown; error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null };
};

const mockState: {
  expectations: QueryExpectation[];
  calls: Array<{ table: string; select: string }>;
} = {
  expectations: [],
  calls: [],
};

class MockQueryBuilder {
  private readonly table: string;
  private selectedColumns = '';
  private executed = false;
  private execution: Promise<{ data: unknown; error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null }> | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  upsert() {
    return this;
  }

  maybeSingle() {
    return this.execute();
  }

  then(onFulfilled?: (value: { data: unknown; error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null }) => unknown, onRejected?: (reason: unknown) => unknown) {
    return this.execute().then(onFulfilled, onRejected);
  }

  private execute() {
    if (this.executed && this.execution) return this.execution;
    this.executed = true;

    const expectationIndex = mockState.expectations.findIndex(
      (candidate) => candidate.table === this.table && candidate.select === this.selectedColumns
    );
    if (expectationIndex === -1) {
      throw new Error(`Unexpected query: ${this.table}.select(${this.selectedColumns})`);
    }
    const [next] = mockState.expectations.splice(expectationIndex, 1);

    mockState.calls.push({ table: this.table, select: this.selectedColumns });
    this.execution = Promise.resolve(next.result);
    return this.execution;
  }
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => new MockQueryBuilder(table),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

vi.mock('../lib/authContextResolver', () => ({
  resolveAuthContext: ({
    profileRole,
    fallbackRole,
    membershipCompanyId,
    profileCompanyId,
    driverCompanyId,
    creatorCompanyId,
    mustChangePassword = false,
  }: {
    profileRole?: string | null;
    fallbackRole?: string | null;
    membershipCompanyId?: string | null;
    profileCompanyId?: string | null;
    driverCompanyId?: string | null;
    creatorCompanyId?: string | null;
    mustChangePassword?: boolean;
  }) => ({
    role: (typeof profileRole === 'string' && profileRole.length > 0
      ? profileRole
      : (typeof fallbackRole === 'string' && fallbackRole.length > 0 ? fallbackRole : null)),
    companyId: membershipCompanyId ?? profileCompanyId ?? driverCompanyId ?? creatorCompanyId ?? null,
    mustChangePassword,
    profileRole: typeof profileRole === 'string' ? profileRole : null,
  }),
}));

import { resolveAuthenticatedUser } from '../lib/authSession';

const ok = (data: unknown) => ({ data, error: null });
const err = (code: string, message: string, details?: string) => ({
  data: null,
  error: { code, message, details: details ?? null, hint: null },
});

const PROFILE_SELECT = 'role, status, is_driver, company_id';
const MEMBERSHIP_SELECT = 'id, company_id, role_in_company, status';
const DRIVER_FULL_SELECT = 'id, company_id, user_id, must_change_password, status, app_access, driver_type, can_commercial_bid';
const DRIVER_LEGACY_SELECT = 'id, company_id, user_id, must_change_password, status, app_access';
const CREATOR_COMPANY_SELECT = 'id, company_type';

const baseSessionUser = {
  id: 'user-1',
  email: 'driver@example.com',
  app_metadata: { role: 'customer' } as Record<string, unknown>,
  user_metadata: {} as Record<string, unknown>,
};

const baseProfile = {
  role: 'customer',
  status: 'active',
  is_driver: false,
  company_id: null,
};

const baseDriverLegacyRow = {
  id: 'driver-1',
  company_id: null,
  user_id: 'user-1',
  must_change_password: false,
  status: 'active',
  app_access: true,
};

describe('resolveAuthenticatedUser driver schema compatibility', () => {
  beforeEach(() => {
    mockState.expectations = [];
    mockState.calls = [];
  });

  it('preserves commercial facts when full driver schema columns are available', async () => {
    mockState.expectations = [
      { table: 'profiles', select: PROFILE_SELECT, result: ok(baseProfile) },
      { table: 'company_memberships', select: MEMBERSHIP_SELECT, result: ok([]) },
      {
        table: 'drivers',
        select: DRIVER_FULL_SELECT,
        result: ok({
          ...baseDriverLegacyRow,
          driver_type: 'owner_operator',
          can_commercial_bid: true,
        }),
      },
      { table: 'companies', select: CREATOR_COMPANY_SELECT, result: ok(null) },
    ];

    const result = await resolveAuthenticatedUser(baseSessionUser);

    expect(result.reason).toBeNull();
    expect(result.user?.driverType).toBe('owner_operator');
    expect(result.user?.canCommercialBid).toBe(true);
    expect(mockState.calls.filter((call) => call.table === 'drivers').map((call) => call.select)).toEqual([DRIVER_FULL_SELECT]);
    expect(mockState.expectations).toHaveLength(0);
  });

  it('retries with legacy driver columns when driver_type is missing (42703)', async () => {
    mockState.expectations = [
      { table: 'profiles', select: PROFILE_SELECT, result: ok(baseProfile) },
      { table: 'company_memberships', select: MEMBERSHIP_SELECT, result: ok([]) },
      {
        table: 'drivers',
        select: DRIVER_FULL_SELECT,
        result: err('42703', 'column drivers.driver_type does not exist'),
      },
      { table: 'companies', select: CREATOR_COMPANY_SELECT, result: ok(null) },
      { table: 'drivers', select: DRIVER_LEGACY_SELECT, result: ok(baseDriverLegacyRow) },
    ];

    const result = await resolveAuthenticatedUser(baseSessionUser);

    expect(result.reason).toBeNull();
    expect(result.user?.driverType).toBeNull();
    expect(result.user?.canCommercialBid).toBe(false);
    expect(mockState.calls.filter((call) => call.table === 'drivers').map((call) => call.select)).toEqual([
      DRIVER_FULL_SELECT,
      DRIVER_LEGACY_SELECT,
    ]);
    expect(mockState.expectations).toHaveLength(0);
  });

  it('retries with legacy driver columns when can_commercial_bid is missing (42703)', async () => {
    mockState.expectations = [
      { table: 'profiles', select: PROFILE_SELECT, result: ok(baseProfile) },
      { table: 'company_memberships', select: MEMBERSHIP_SELECT, result: ok([]) },
      {
        table: 'drivers',
        select: DRIVER_FULL_SELECT,
        result: err('42703', 'column drivers.can_commercial_bid does not exist'),
      },
      { table: 'companies', select: CREATOR_COMPANY_SELECT, result: ok(null) },
      { table: 'drivers', select: DRIVER_LEGACY_SELECT, result: ok(baseDriverLegacyRow) },
    ];

    const result = await resolveAuthenticatedUser(baseSessionUser);

    expect(result.reason).toBeNull();
    expect(result.user?.driverType).toBeNull();
    expect(result.user?.canCommercialBid).toBe(false);
    expect(mockState.calls.filter((call) => call.table === 'drivers').map((call) => call.select)).toEqual([
      DRIVER_FULL_SELECT,
      DRIVER_LEGACY_SELECT,
    ]);
    expect(mockState.expectations).toHaveLength(0);
  });

  it('returns db_error for unrelated driver query errors', async () => {
    mockState.expectations = [
      { table: 'profiles', select: PROFILE_SELECT, result: ok(baseProfile) },
      { table: 'company_memberships', select: MEMBERSHIP_SELECT, result: ok([]) },
      { table: 'drivers', select: DRIVER_FULL_SELECT, result: err('42501', 'permission denied for table drivers') },
      { table: 'companies', select: CREATOR_COMPANY_SELECT, result: ok(null) },
    ];

    const result = await resolveAuthenticatedUser(baseSessionUser);

    expect(result.reason).toBe('db_error');
    expect(result.user).toBeNull();
    expect(result.reason === 'db_error' ? result.dbError.code : null).toBe('42501');
    expect(mockState.calls.filter((call) => call.table === 'drivers').map((call) => call.select)).toEqual([DRIVER_FULL_SELECT]);
    expect(mockState.expectations).toHaveLength(0);
  });

  it('never grants commercial bidding permissions during legacy fallback', async () => {
    mockState.expectations = [
      { table: 'profiles', select: PROFILE_SELECT, result: ok(baseProfile) },
      { table: 'company_memberships', select: MEMBERSHIP_SELECT, result: ok([]) },
      {
        table: 'drivers',
        select: DRIVER_FULL_SELECT,
        result: err('42703', 'column drivers.driver_type does not exist'),
      },
      { table: 'companies', select: CREATOR_COMPANY_SELECT, result: ok(null) },
      {
        table: 'drivers',
        select: DRIVER_LEGACY_SELECT,
        result: ok({
          ...baseDriverLegacyRow,
          can_commercial_bid: true,
        }),
      },
    ];

    const result = await resolveAuthenticatedUser(baseSessionUser);

    expect(result.reason).toBeNull();
    expect(result.user?.canCommercialBid).toBe(false);
    expect(result.user?.driverType).toBeNull();
    expect(mockState.expectations).toHaveLength(0);
  });
});
