import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBearerToken: vi.fn(),
  from: vi.fn(),
  profileResult: {
    data: {
      user_id: 'user-1',
      company_id: '11111111-1111-4111-8111-111111111111',
      role: 'company_admin',
      status: 'active',
      is_driver: false,
    },
    error: null as null | { message: string },
  },
  membershipsResult: {
    data: [] as unknown[],
    error: null as null | { message: string },
  },
  driversResult: {
    data: [] as unknown[],
    error: null as null | { message: string },
  },
  updatedProfileResult: {
    data: { company_id: '11111111-1111-4111-8111-111111111111' } as { company_id: string } | null,
    error: null as null | { message: string },
  },
  updatePayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
  supabaseAdmin: {
    from: mocks.from,
  },
  getBearerToken: mocks.getBearerToken,
}));

import { GET, POST } from '../app/api/auth/context/route';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';

const activeMembership = (companyId = COMPANY_A) => ({
  id: `membership-${companyId}`,
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

const request = (input?: {
  method?: 'GET' | 'POST';
  token?: string | null;
  body?: unknown;
}) => {
  const headers = new Headers();
  if (input?.token) {
    headers.set('cookie', `xdrive-route-access-token=${encodeURIComponent(input.token)}`);
  }
  if (input?.body !== undefined) headers.set('content-type', 'application/json');

  return new NextRequest('http://localhost/api/auth/context', {
    method: input?.method ?? 'GET',
    headers,
    body: input?.body === undefined ? undefined : JSON.stringify(input.body),
  });
};

const readJson = async (response: Response) =>
  (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.getBearerToken.mockReset();
  mocks.from.mockReset();
  mocks.updatePayloads.length = 0;

  mocks.profileResult = {
    data: {
      user_id: 'user-1',
      company_id: COMPANY_A,
      role: 'company_admin',
      status: 'active',
      is_driver: false,
    },
    error: null,
  };
  mocks.membershipsResult = {
    data: [activeMembership(COMPANY_A)],
    error: null,
  };
  mocks.driversResult = { data: [], error: null };
  mocks.updatedProfileResult = {
    data: { company_id: COMPANY_A },
    error: null,
  };

  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  });
  mocks.getBearerToken.mockReturnValue(null);

  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => mocks.profileResult,
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          mocks.updatePayloads.push(payload);
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => mocks.updatedProfileResult,
              }),
            }),
          };
        },
      };
    }

    if (table === 'company_memberships') {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => mocks.membershipsResult,
          }),
        }),
      };
    }

    if (table === 'drivers') {
      return {
        select: () => ({
          eq: async () => mocks.driversResult,
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
});

describe('GET /api/auth/context', () => {
  it('rejects a request without the existing route token', async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: 'Unauthorized.' });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('returns only the authenticated active membership context', async () => {
    const response = await GET(request({ token: 'valid-token' }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.staleSelectionCleared).toBe(false);
    expect(body.current).toEqual(
      expect.objectContaining({
        companyId: COMPANY_A,
        activeWorkspace: 'carrier_fleet',
        landingRoute: '/admin',
      }),
    );
    expect(body.memberships).toEqual([
      expect.objectContaining({ companyId: COMPANY_A }),
    ]);
  });

  it('fails closed when an authoritative membership query errors', async () => {
    mocks.membershipsResult = {
      data: [],
      error: { message: 'database unavailable' },
    };

    const response = await GET(request({ token: 'valid-token' }));

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: 'Unable to validate workspace context.',
    });
  });

  it('returns 403 when the authenticated user has no active company memberships', async () => {
    mocks.membershipsResult = { data: [], error: null };

    const response = await GET(request({ token: 'valid-token' }));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      error: 'No active company membership is available.',
    });
  });

  it('auto-recovers, persists the recovered company and reports staleSelectionCleared when profile company is not in active memberships', async () => {
    // Profile references COMPANY_B, but user only has an active membership in COMPANY_A.
    mocks.profileResult = {
      data: {
        user_id: 'user-1',
        company_id: COMPANY_B,
        role: 'company_admin',
        status: 'active',
        is_driver: false,
      },
      error: null,
    };
    // Only COMPANY_A membership is active.
    mocks.membershipsResult = { data: [activeMembership(COMPANY_A)], error: null };

    const response = await GET(request({ token: 'valid-token' }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.staleSelectionCleared).toBe(true);
    expect(body.current).toEqual(
      expect.objectContaining({
        companyId: COMPANY_A,
        activeWorkspace: 'carrier_fleet',
        landingRoute: '/admin',
      }),
    );
    // Exactly one validated profile update must have been persisted.
    expect(mocks.updatePayloads).toEqual([{ company_id: COMPANY_A }]);
  });

  it('fails closed when stale recovery persistence fails with a DB error', async () => {
    mocks.profileResult = {
      data: {
        user_id: 'user-1',
        company_id: COMPANY_B,
        role: 'company_admin',
        status: 'active',
        is_driver: false,
      },
      error: null,
    };
    mocks.membershipsResult = { data: [activeMembership(COMPANY_A)], error: null };
    mocks.updatedProfileResult = {
      data: null,
      error: { message: 'database write error' },
    };

    const response = await GET(request({ token: 'valid-token' }));

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: 'Unable to recover workspace context.' });
  });

  it('does not persist when stale recovery requires explicit company selection (multiple memberships)', async () => {
    mocks.profileResult = {
      data: {
        user_id: 'user-1',
        company_id: 'stale-company-000',
        role: 'company_admin',
        status: 'active',
        is_driver: false,
      },
      error: null,
    };
    // Two active memberships: recovery cannot auto-select, so companySelectionRequired is true.
    mocks.membershipsResult = {
      data: [activeMembership(COMPANY_A), activeMembership(COMPANY_B)],
      error: null,
    };

    const response = await GET(request({ token: 'valid-token' }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.staleSelectionCleared).toBe(true);
    expect(body.companySelectionRequired).toBe(true);
    expect(body.current).toBeNull();
    expect(mocks.updatePayloads).toEqual([]);
  });
});

describe('POST /api/auth/context', () => {
  it('rejects a cross-company switch and performs no profile update', async () => {
    const response = await POST(
      request({
        method: 'POST',
        token: 'valid-token',
        body: {
          companyId: COMPANY_B,
          workspace: 'carrier_fleet',
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      error: 'The requested company is not available to this account.',
    });
    expect(mocks.updatePayloads).toEqual([]);
  });

  it('rejects an unsupported workspace and performs no profile update', async () => {
    const response = await POST(
      request({
        method: 'POST',
        token: 'valid-token',
        body: {
          companyId: COMPANY_A,
          workspace: 'broker',
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      error: 'The requested workspace is not enabled for this company.',
    });
    expect(mocks.updatePayloads).toEqual([]);
  });

  it('persists only the validated canonical company and returns the approved route', async () => {
    const response = await POST(
      request({
        method: 'POST',
        token: 'valid-token',
        body: {
          companyId: COMPANY_A,
          workspace: 'carrier_fleet',
        },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(mocks.updatePayloads).toEqual([{ company_id: COMPANY_A }]);
    expect(body.landingRoute).toBe('/admin');
    expect(body.current).toEqual(
      expect.objectContaining({
        companyId: COMPANY_A,
        activeWorkspace: 'carrier_fleet',
      }),
    );
  });

  it('resolves a company driver with same-company evidence to /driver not /admin', async () => {
    // Set up a driver membership (role_in_company: driver) with active same-company evidence.
    mocks.membershipsResult = {
      data: [
        {
          id: `membership-driver-${COMPANY_A}`,
          company_id: COMPANY_A,
          user_id: 'user-1',
          role_in_company: 'driver',
          status: 'active',
          companies: {
            id: COMPANY_A,
            name: `Company ${COMPANY_A}`,
            company_type: 'standard',
            status: 'active',
          },
        },
      ],
      error: null,
    };
    mocks.driversResult = {
      data: [
        {
          id: 'driver-1',
          user_id: 'user-1',
          company_id: COMPANY_A,
          status: 'active',
          app_access: true,
          must_change_password: false,
          driver_type: 'company_driver',
          can_commercial_bid: false,
        },
      ],
      error: null,
    };
    mocks.updatedProfileResult = { data: { company_id: COMPANY_A }, error: null };

    const response = await POST(
      request({
        method: 'POST',
        token: 'valid-token',
        body: { companyId: COMPANY_A, workspace: 'carrier_fleet' },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.landingRoute).toBe('/driver');
    expect(body.current).toEqual(
      expect.objectContaining({
        companyId: COMPANY_A,
        activeWorkspace: 'carrier_fleet',
        landingRoute: '/driver',
        canAccessDriverMode: true,
      }),
    );
  });
});
