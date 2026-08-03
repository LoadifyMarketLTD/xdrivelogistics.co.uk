import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { ROUTE_AUTH_COOKIE_NAME } from '../lib/routeAuthCookie';

const harness = vi.hoisted(() => {
  const ok = <T,>(data: T) => Promise.resolve({ data, error: null });

  const admin = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => ok({
                role: 'driver',
                status: 'active',
                is_driver: true,
                company_id: 'company-1',
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
                order: () => ok([
                  {
                    id: 'membership-1',
                    company_id: 'company-1',
                    user_id: 'user-1',
                    role_in_company: 'driver',
                    status: 'active',
                    companies: {
                      id: 'company-1',
                      name: 'Carrier Company',
                      company_type: 'standard',
                      status: 'active',
                    },
                  },
                ]),
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
                limit: () => ({
                  maybeSingle: () => ok({
                    id: 'driver-1',
                    company_id: 'company-1',
                    app_access: true,
                    must_change_password: false,
                    status: 'active',
                    can_commercial_bid: true,
                  }),
                }),
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
          id: 'user-1',
          app_metadata: { role: 'driver' },
          user_metadata: {},
        },
      })),
    },
  };

  return { admin, validator };
});

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: harness.admin,
  supabaseValidator: harness.validator,
}));

vi.mock('../lib/authSession', () => ({
  getPostLoginRoute: vi.fn(() => '/driver'),
}));

import { middleware } from '../middleware';

function expectNonceContract(response: Response) {
  const csp = response.headers.get('content-security-policy');
  const forwardedCsp = response.headers.get('x-middleware-request-content-security-policy');
  const nonce = response.headers.get('x-middleware-request-x-nonce');
  const overrideHeaders = response.headers.get('x-middleware-override-headers');

  expect(csp).toBeTruthy();
  expect(forwardedCsp).toBe(csp);
  expect(nonce).toBeTruthy();
  expect(csp).toContain(`'nonce-${nonce}'`);
  expect(overrideHeaders?.split(',')).toEqual(
    expect.arrayContaining(['content-security-policy', 'x-nonce']),
  );
}

describe('middleware CSP nonce contract', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards the nonce-bearing CSP on public routes', async () => {
    const response = await middleware(new NextRequest('https://example.test/'));

    expectNonceContract(response);
    expect(response.headers.get('content-security-policy')).not.toContain('unsafe-inline');
    expect(response.headers.get('content-security-policy')).not.toContain('unsafe-eval');
  });

  it('forwards the nonce-bearing CSP on protected routes while preserving x-nonce', async () => {
    const response = await middleware(
      new NextRequest('https://example.test/driver/jobs', {
        headers: {
          cookie: `${ROUTE_AUTH_COOKIE_NAME}=valid-token`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expectNonceContract(response);
  });
});
