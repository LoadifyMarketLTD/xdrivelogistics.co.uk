import { Buffer } from 'node:buffer';
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
  deviceBindingResult: { data: null, error: null as { message: string } | null } as {
    data: { installation_id: string; auth_session_id: string } | null;
    error: { message: string } | null;
  },
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: mocks.getBearerToken,
  supabaseAdmin: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

import { isDriverContext, requireDriver } from '../app/api/driver/mobile/_lib';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const INSTALLATION_ID = '22222222-2222-4222-8222-222222222222';

function jwtWithSessionId(sessionId: string) {
  return `header.${Buffer.from(JSON.stringify({ session_id: sessionId })).toString('base64url')}.signature`;
}

function activeDriver() {
  return {
    id: 'driver-1',
    company_id: null,
    user_id: 'user-1',
    app_access: true,
    status: 'active',
    driver_type: 'independent',
    can_commercial_bid: true,
  };
}

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.driverResults = [];
  mocks.driverSelects = [];
  mocks.profileResult = { data: { status: 'active' }, error: null };
  mocks.companyResult = { data: null, error: null };
  mocks.deviceBindingResult = { data: null, error: null };

  mocks.getBearerToken.mockReturnValue('token');
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

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
      return { select: () => ({ eq: () => ({ maybeSingle: async () => mocks.profileResult }) }) };
    }
    if (table === 'companies') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => mocks.companyResult }) }) };
    }
    if (table === 'driver_mobile_device_sessions') {
      const selectChain: any = {};
      selectChain.eq = () => selectChain;
      selectChain.is = () => selectChain;
      selectChain.limit = () => selectChain;
      selectChain.maybeSingle = async () => mocks.deviceBindingResult;
      const updateChain: any = {};
      updateChain.eq = () => updateChain;
      return { select: () => selectChain, update: () => updateChain };
    }
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
  });
});

describe('driver mobile requireDriver schema compatibility', () => {
  it('retries once with legacy driver columns on 42703 and fails closed for commercial fields', async () => {
    mocks.driverResults = [
      { data: null, error: { code: '42703', message: 'column drivers.driver_type does not exist' } },
      {
        data: {
          id: 'driver-1', company_id: null, user_id: 'user-1', app_access: true, status: 'active',
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

  it('keeps legacy mobile access compatible before a native binding exists', async () => {
    mocks.driverResults = [{ data: activeDriver(), error: null }];
    mocks.deviceBindingResult = { data: null, error: null };

    const result = await requireDriver(new NextRequest('https://example.test/api/driver/mobile/jobs'));
    expect(isDriverContext(result)).toBe(true);
  });

  it('requires the active native installation once a native binding exists', async () => {
    mocks.driverResults = [{ data: activeDriver(), error: null }];
    mocks.getBearerToken.mockReturnValue(jwtWithSessionId(SESSION_ID));
    mocks.deviceBindingResult = {
      data: { installation_id: INSTALLATION_ID, auth_session_id: SESSION_ID },
      error: null,
    };

    const result = await requireDriver(new NextRequest('https://example.test/api/driver/mobile/jobs'));
    expect(isDriverContext(result)).toBe(false);
    if (isDriverContext(result)) return;
    expect(result.status).toBe(401);
  });

  it('accepts only the bound installation and auth session', async () => {
    mocks.driverResults = [{ data: activeDriver(), error: null }];
    mocks.getBearerToken.mockReturnValue(jwtWithSessionId(SESSION_ID));
    mocks.deviceBindingResult = {
      data: { installation_id: INSTALLATION_ID, auth_session_id: SESSION_ID },
      error: null,
    };

    const request = new NextRequest('https://example.test/api/driver/mobile/jobs', {
      headers: { 'x-xdrive-installation-id': INSTALLATION_ID },
    });
    const result = await requireDriver(request);
    expect(isDriverContext(result)).toBe(true);
  });

  it('rejects a replaced native device even with a valid user token', async () => {
    mocks.driverResults = [{ data: activeDriver(), error: null }];
    mocks.getBearerToken.mockReturnValue(jwtWithSessionId(SESSION_ID));
    mocks.deviceBindingResult = {
      data: { installation_id: INSTALLATION_ID, auth_session_id: SESSION_ID },
      error: null,
    };

    const request = new NextRequest('https://example.test/api/driver/mobile/jobs', {
      headers: { 'x-xdrive-installation-id': '33333333-3333-4333-8333-333333333333' },
    });
    const result = await requireDriver(request);
    expect(isDriverContext(result)).toBe(false);
    if (isDriverContext(result)) return;
    expect(result.status).toBe(401);
  });
});
