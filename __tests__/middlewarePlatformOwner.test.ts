import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  type Result<T> = Promise<{ data: T; error: { message: string } | null }>;

  const ok = <T,>(data: T): Result<T> => Promise.resolve({ data, error: null });

  let profile: Result<{
    role: string;
    status: string;
    is_driver: boolean;
    company_id: string | null;
  } | null> = ok({ role: 'owner', status: 'active', is_driver: false, company_id: null });
  let memberships: Result<unknown[]> = ok([]);
  let creatorCompany: Result<unknown> = ok(null);
  let appMetadata: Record<string, unknown> = {};

  const admin = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => profile }),
          }),
        };
      }

      if (table === 'company_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => memberships }),
            }),
          }),
        };
      }

      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: () => creatorCompany }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table query: ${table}`);
    },
  };

  const validator = {
    auth: {
      getUser: vi.fn(() => ok({
        user: {
          id: 'user-1',
          app_metadata: appMetadata,
          user_metadata: {},
        },
      })),
    },
  };

  return {
    admin,
    validator,
    ok,
    reset() {
      profile = ok({ role: 'owner', status: 'active', is_driver: false, company_id: null });
      memberships = ok([]);
      creatorCompany = ok(null);
      appMetadata = {};
    },
    setProfile(value: {
      role: string;
      status: string;
      is_driver: boolean;
      company_id: string | null;
    }) {
      profile = ok(value);
    },
    setAppMetadata(value: Record<string, unknown>) {
      appMetadata = value;
    },
  };
});

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: harness.admin,
  supabaseValidator: harness.validator,
}));

vi.mock('../lib/authSession', () => ({
  getPostLoginRoute: vi.fn(() => '/super-admin'),
}));

import { resolveRouteAuth } from '../middleware';

const request = (pathname: string): import('next/server').NextRequest => ({
  cookies: {
    get: () => ({ value: 'valid-token' }),
  },
  nextUrl: {
    pathname,
  },
}) as unknown as import('next/server').NextRequest;

describe('platform owner middleware boundary', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('allows an active server-side platform owner to use /super-admin without memberships', async () => {
    const result = await resolveRouteAuth(request('/super-admin/users'));

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.role).toBe('owner');
      expect(result.workspaceRole).toBe('platform_owner');
      expect(result.membershipId).toBeNull();
      expect(result.membershipRole).toBeNull();
      expect(result.accountStatus).toBe('active');
    }
  });

  it('does not trust app metadata to create platform-owner access', async () => {
    harness.setProfile({
      role: 'customer',
      status: 'active',
      is_driver: false,
      company_id: null,
    });
    harness.setAppMetadata({ role: 'owner', platform_owner: true });

    const result = await resolveRouteAuth(request('/super-admin'));
    expect(result.kind).toBe('forbidden');
  });

  it('blocks inactive platform-owner profiles', async () => {
    harness.setProfile({
      role: 'owner',
      status: 'suspended',
      is_driver: false,
      company_id: null,
    });

    const result = await resolveRouteAuth(request('/super-admin'));
    expect(result.kind).toBe('forbidden');
  });
});
