import { describe, expect, it, vi } from 'vitest';

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

import { resolveRouteAuth } from '../middleware';

const request = {
  cookies: {
    get: () => ({ value: 'valid-token' }),
  },
  nextUrl: {
    pathname: '/driver/jobs',
  },
} as unknown as import('next/server').NextRequest;

describe('middleware shared Company Driver surface', () => {
  it('authenticates a valid same-company driver from a standard carrier company on /driver', async () => {
    const result = await resolveRouteAuth(request);

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.workspaceRole).toBe('driver');
      expect(result.membershipRole).toBe('driver');
      expect(result.membershipId).toBe('membership-1');
      expect(result.driverId).toBe('driver-1');
      expect(result.canAccessDriverMode).toBe(true);
      expect(result.appAccess).toBe(true);
      expect(result.driverStatus).toBe('active');
      expect(result.companyStatus).toBe('active');
    }
  });
});
