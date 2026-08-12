import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { ROUTE_AUTH_COOKIE_NAME } from '../lib/routeAuthCookie';

const harness = vi.hoisted(() => {
  type DriverRow = {
    id: string;
    company_id: string | null;
    app_access: boolean;
    must_change_password: boolean;
    status: string;
    can_commercial_bid: boolean;
  };

  const scenario: {
    profileRole: string;
    appRole: string;
    isDriver: boolean;
    drivers: DriverRow[];
  } = {
    profileRole: 'customer',
    appRole: 'customer',
    isDriver: false,
    drivers: [],
  };

  const ok = <T,>(data: T) => Promise.resolve({ data, error: null });

  const admin = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => ok({
                role: scenario.profileRole,
                status: 'active',
                is_driver: scenario.isDriver,
                company_id: null,
              }),
            }),
          }),
        };
      }

      if (table === 'company_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ok([]),
              }),
            }),
          }),
        };
      }

      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: () => ok(null),
              }),
            }),
          }),
        };
      }

      if (table === 'drivers') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ok(scenario.drivers),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const validator = {
    auth: {
      getUser: vi.fn(() => ok({
        user: {
          id: 'user-standalone',
          app_metadata: { role: scenario.appRole },
          user_metadata: {},
        },
      })),
    },
  };

  return { admin, validator, scenario };
});

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: harness.admin,
  supabaseValidator: harness.validator,
}));

import { middleware, resolveRouteAuth } from '../middleware';

const requestFor = (pathname: string) =>
  new NextRequest(`http://localhost:3000${pathname}`, {
    headers: {
      cookie: `${ROUTE_AUTH_COOKIE_NAME}=valid-token`,
    },
  });

describe('standalone portal route authentication', () => {
  beforeEach(() => {
    harness.scenario.profileRole = 'customer';
    harness.scenario.appRole = 'customer';
    harness.scenario.isDriver = false;
    harness.scenario.drivers = [];
  });

  it('allows an active standalone Customer without company_memberships', async () => {
    const auth = await resolveRouteAuth(requestFor('/customer'));

    expect(auth.kind).toBe('authenticated');
    if (auth.kind === 'authenticated') {
      expect(auth.role).toBe('customer');
      expect(auth.membershipId).toBeNull();
      expect(auth.companyStatus).toBeNull();
    }

    const response = await middleware(requestFor('/customer'));
    expect(response.status).toBe(200);
  });

  it('allows an active standalone Driver only with explicit active driver evidence and app access', async () => {
    harness.scenario.profileRole = 'driver';
    harness.scenario.appRole = 'driver';
    harness.scenario.isDriver = true;
    harness.scenario.drivers = [{
      id: 'driver-standalone',
      company_id: null,
      app_access: true,
      must_change_password: false,
      status: 'active',
      can_commercial_bid: true,
    }];

    const auth = await resolveRouteAuth(requestFor('/driver'));

    expect(auth.kind).toBe('authenticated');
    if (auth.kind === 'authenticated') {
      expect(auth.role).toBe('driver');
      expect(auth.driverId).toBe('driver-standalone');
      expect(auth.membershipId).toBeNull();
      expect(auth.appAccess).toBe(true);
      expect(auth.driverStatus).toBe('active');
    }

    const response = await middleware(requestFor('/driver'));
    expect(response.status).toBe(200);
  });

  it('keeps a standalone Driver fail-closed when app access is disabled', async () => {
    harness.scenario.profileRole = 'driver';
    harness.scenario.appRole = 'driver';
    harness.scenario.isDriver = true;
    harness.scenario.drivers = [{
      id: 'driver-disabled',
      company_id: null,
      app_access: false,
      must_change_password: false,
      status: 'active',
      can_commercial_bid: true,
    }];

    const auth = await resolveRouteAuth(requestFor('/driver'));
    expect(auth.kind).toBe('forbidden');
  });

  it('does not bypass company context for Broker/Admin/Carrier identities', async () => {
    harness.scenario.profileRole = 'broker';
    harness.scenario.appRole = 'broker';

    const auth = await resolveRouteAuth(requestFor('/broker'));
    expect(auth.kind).toBe('forbidden');
  });
});