import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  driverResults: [] as Array<{ data: unknown; error: { code?: string; message: string } | null }>,
  driverSelects: [] as string[],
  profileResult: { data: { status: 'active' }, error: null as { message: string } | null },
  companyResult: { data: null, error: null as { message: string } | null },
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: mocks.getBearerToken,
  supabaseAdmin: {
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  },
}));

import { isDriverContext, requireDriver } from '../app/api/driver/mobile/_lib';

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.driverResults = [];
  mocks.driverSelects = [];
  mocks.profileResult = { data: { status: 'active' }, error: null };
  mocks.companyResult = { data: null, error: null };

  mocks.getBearerToken.mockReturnValue('token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'drivers') {
      return {
        select: (columns: string) => {
          mocks.driverSelects.push(columns);
          return {
            eq: () => ({
              maybeSingle: async () => mocks.driverResults.shift() ?? { data: null, error: null },
            }),
          };
        },
      };
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => mocks.profileResult,
          }),
        }),
      };
    }
    if (table === 'companies') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => mocks.companyResult,
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  });
});

describe('driver mobile requireDriver schema compatibility', () => {
  it('retries once with legacy driver columns on 42703 and fails closed for commercial fields', async () => {
    mocks.driverResults = [
      { data: null, error: { code: '42703', message: 'column drivers.driver_type does not exist' } },
      {
        data: {
          id: 'driver-1',
          company_id: null,
          user_id: 'user-1',
          app_access: true,
          status: 'active',
        },
        error: null,
      },
    ];

    const result = await requireDriver(new NextRequest('https://example.test/api/driver/mobile/jobs'));

    expect(isDriverContext(result)).toBe(true);
    if (!isDriverContext(result)) return;
    expect(result.driverType).toBeNull();
    expect(result.canCommercialBid).toBe(false);
    expect(mocks.driverSelects).toEqual([
      'id, company_id, user_id, app_access, status, driver_type, can_commercial_bid',
      'id, company_id, user_id, app_access, status',
    ]);
  });
});
