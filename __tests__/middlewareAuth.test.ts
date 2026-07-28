import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

type SupabaseFixtures = {
  profile: QueryResult<{
    role: string;
    status: string;
    is_driver: boolean;
    company_id: string | null;
  } | null>;
  memberships: QueryResult<Array<{
    id: string;
    company_id: string;
    user_id: string;
    role_in_company: string | null;
    status: string | null;
    companies: {
      id: string;
      name: string;
      company_type: string | null;
      status: string | null;
    } | null;
  }>>;
  driver: QueryResult<{
    id: string;
    company_id: string | null;
    app_access: boolean;
    must_change_password: boolean;
    status: string;
    can_commercial_bid: boolean;
  } | null>;
  creatorCompany: QueryResult<{ company_type: string | null } | null>;
};

const defaultFixtures = (): SupabaseFixtures => ({
  profile: Promise.resolve({
    data: {
      role: 'driver',
      status: 'active',
      is_driver: true,
      company_id: 'co-1',
    },
    error: null,
  }),
  memberships: Promise.resolve({
    data: [
      {
        id: 'mem-1',
        company_id: 'co-1',
        user_id: 'user-1',
        role_in_company: 'owner',
        status: 'active',
        companies: {
          id: 'co-1',
          name: 'Company One',
          company_type: 'standard',
          status: 'active',
        },
      },
    ],
    error: null,
  }),
  driver: Promise.resolve({
    data: {
      id: 'drv-1',
      company_id: 'co-1',
      app_access: true,
      must_change_password: false,
      status: 'active',
      can_commercial_bid: true,
    },
    error: null,
  }),
  creatorCompany: Promise.resolve({
    data: null,
    error: null,
  }),
});

let authGetUserResult: Promise<{
  data: {
    user: {
      id: string;
      app_metadata: Record<string, unknown>;
      user_metadata: Record<string, unknown>;
    };
  };
  error: { message: string } | null;
}>;

let isAdminConfigured = true;
let fixtures: SupabaseFixtures;

const buildSupabaseAdmin = () => ({
  from: (table: string) => {
    if (table === 'profiles') {
      const query = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() => fixtures.profile),
      };
      return {
        select: vi.fn(() => query),
      };
    }

    if (table === 'company_memberships') {
      const query = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(() => fixtures.memberships),
      };
      return {
        select: vi.fn(() => query),
      };
    }

    if (table === 'drivers') {
      const query = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() => fixtures.driver),
      };
      return {
        select: vi.fn(() => query),
      };
    }

    const query = {
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => fixtures.creatorCompany),
    };
    return {
      select: vi.fn(() => query),
    };
  },
});

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  get isSupabaseAdminConfigured() {
    return isAdminConfigured;
  },
  get supabaseAdmin() {
    return isAdminConfigured ? buildSupabaseAdmin() : null;
  },
  supabaseValidator: {
    auth: {
      getUser: vi.fn(() => authGetUserResult),
    },
  },
}));

vi.mock('../lib/authSession', () => ({
  getPostLoginRoute: vi.fn(() => '/driver'),
}));

beforeEach(() => {
  vi.resetModules();
  isAdminConfigured = true;
  fixtures = defaultFixtures();
  authGetUserResult = Promise.resolve({
    data: {
      user: {
        id: 'user-1',
        app_metadata: { role: 'driver' },
        user_metadata: {},
      },
    },
    error: null,
  });
});

const buildRequest = (pathname: string): import('next/server').NextRequest =>
  ({
    cookies: {
      get: () => ({ value: 'token-1' }),
    },
    nextUrl: {
      pathname,
    },
  }) as unknown as import('next/server').NextRequest;

describe('middleware resolveRouteAuth hardening', () => {
  it('fails closed when server-side admin client is unavailable', async () => {
    isAdminConfigured = false;
    authGetUserResult = Promise.resolve({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { role: 'driver' },
          user_metadata: { role: 'owner_driver', owner_driver_workspace: true },
        },
      },
      error: null,
    });

    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/admin/jobs'));

    expect(result.kind).toBe('service_unavailable');
  });

  it('fails closed when multiple active memberships exist without trusted selected company', async () => {
    fixtures = {
      ...defaultFixtures(),
      profile: Promise.resolve({
        data: {
          role: 'driver',
          status: 'active',
          is_driver: true,
          company_id: null,
        },
        error: null,
      }),
      memberships: Promise.resolve({
        data: [
          {
            id: 'mem-1',
            company_id: 'co-1',
            user_id: 'user-1',
            role_in_company: 'owner',
            status: 'active',
            companies: { id: 'co-1', name: 'Company One', company_type: 'standard', status: 'active' },
          },
          {
            id: 'mem-2',
            company_id: 'co-2',
            user_id: 'user-1',
            role_in_company: 'owner',
            status: 'active',
            companies: { id: 'co-2', name: 'Company Two', company_type: 'standard', status: 'active' },
          },
        ],
        error: null,
      }),
    };

    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/admin/jobs'));

    expect(result.kind).toBe('forbidden');
  });

  it('does not grant owner-driver flags from user_metadata alone', async () => {
    authGetUserResult = Promise.resolve({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { role: 'driver' },
          user_metadata: {
            owner_driver_workspace: true,
            owner_driver_execution_mode: true,
            role: 'owner_driver',
            workspace_mode: 'execution',
          },
        },
      },
      error: null,
    });

    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/admin/jobs'));

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.ownerDriverWorkspace).toBe(false);
      expect(result.ownerDriverExecutionMode).toBe(false);
    }
  });

  it('denies when driver row belongs to another company than selected active company', async () => {
    fixtures = {
      ...defaultFixtures(),
      driver: Promise.resolve({
        data: {
          id: 'drv-cross',
          company_id: 'co-2',
          app_access: true,
          must_change_password: false,
          status: 'active',
          can_commercial_bid: true,
        },
        error: null,
      }),
    };

    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/driver/loads'));

    expect(result.kind).toBe('forbidden');
  });

  it('denies stale profile company_id when it is outside active memberships', async () => {
    fixtures = {
      ...defaultFixtures(),
      profile: Promise.resolve({
        data: {
          role: 'driver',
          status: 'active',
          is_driver: true,
          company_id: 'co-stale',
        },
        error: null,
      }),
    };

    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/driver/loads'));

    expect(result.kind).toBe('forbidden');
  });

  it('recalculates driver context on company switch and clears commercial rights without matching driver row', async () => {
    fixtures = {
      ...defaultFixtures(),
      memberships: Promise.resolve({
        data: [
          {
            id: 'mem-1',
            company_id: 'co-1',
            user_id: 'user-1',
            role_in_company: 'owner',
            status: 'active',
            companies: { id: 'co-1', name: 'Company One', company_type: 'standard', status: 'active' },
          },
          {
            id: 'mem-2',
            company_id: 'co-2',
            user_id: 'user-1',
            role_in_company: 'owner',
            status: 'active',
            companies: { id: 'co-2', name: 'Company Two', company_type: 'standard', status: 'active' },
          },
        ],
        error: null,
      }),
    };

    authGetUserResult = Promise.resolve({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { role: 'driver' },
          user_metadata: {},
        },
      },
      error: null,
    });

    fixtures = {
      ...fixtures,
      profile: Promise.resolve({
        data: {
          role: 'driver',
          status: 'active',
          is_driver: true,
          company_id: 'co-2',
        },
        error: null,
      }),
      driver: Promise.resolve({ data: null, error: null }),
    };

    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/admin/jobs'));

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.driverId).toBeNull();
      expect(result.canCommercialBid).toBeNull();
      expect(result.canAccessDriverMode).toBe(false);
      expect(result.ownerDriverWorkspace).toBe(false);
      expect(result.ownerDriverExecutionMode).toBe(false);
    }
  });
});
