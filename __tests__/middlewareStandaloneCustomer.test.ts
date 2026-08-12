import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseValidator: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'customer-user-1',
            app_metadata: { role: 'customer' },
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  },
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'profiles') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              role: 'customer',
              status: 'active',
              is_driver: false,
              company_id: null,
            },
            error: null,
          }),
        };
        return { select: vi.fn(() => query) };
      }

      if (table === 'company_memberships') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return { select: vi.fn(() => query) };
      }

      if (table === 'companies') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return { select: vi.fn(() => query) };
      }

      throw new Error(`Unexpected table query: ${table}`);
    },
  },
}));

vi.mock('../lib/authSession', () => ({
  getPostLoginRoute: vi.fn(() => '/customer'),
}));

const buildRequest = (pathname: string): import('next/server').NextRequest =>
  ({
    cookies: {
      get: () => ({ value: 'customer-token' }),
    },
    nextUrl: { pathname },
  }) as unknown as import('next/server').NextRequest;

describe('standalone customer route authentication', () => {
  it('authenticates an active customer without a company membership', async () => {
    const middleware = await import('../middleware');
    const result = await middleware.resolveRouteAuth(buildRequest('/customer'));

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.role).toBe('customer');
      expect(result.workspaceRole).toBe('customer');
      expect(result.membershipId).toBeNull();
      expect(result.membershipRole).toBeNull();
      expect(result.companyStatus).toBeNull();
      expect(result.driverId).toBeNull();
    }
  });
});
