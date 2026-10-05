import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  clientEq: vi.fn(),
  clientNotifications: { data: [] as Array<Record<string, unknown>>, error: null as { message?: string } | null },
  adminRows: {} as Record<string, { data: unknown; error: { message?: string } | null }>,
}));

const makeAdminQuery = (table: string) => {
  const query: Record<string, unknown> & PromiseLike<unknown> = {
    select: () => query,
    eq: () => query,
    is: () => query,
    in: () => query,
    or: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(mocks.adminRows[table] ?? { data: null, error: null }),
    then: ((onfulfilled, onrejected) =>
      Promise.resolve(mocks.adminRows[table] ?? { data: [], error: null }).then(onfulfilled ?? undefined, onrejected ?? undefined)) as PromiseLike<unknown>['then'],
  };
  return query;
};

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: mocks.getBearerToken,
  supabaseAdmin: { from: (table: string) => makeAdminQuery(table) },
  supabaseValidator: { auth: { getUser: mocks.getUser } },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          mocks.clientEq(...args);
          return {
            order: () => ({
              limit: () => Promise.resolve(mocks.clientNotifications),
            }),
          };
        },
      }),
    }),
  })),
}));

let GET: (request: NextRequest) => Promise<Response>;

describe('GET /api/workspace/action-centre', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.clientEq.mockReset();
    mocks.clientNotifications = { data: [], error: null };
    mocks.adminRows = {
      profiles: { data: { company_id: 'company-1', role: 'broker', status: 'active', is_driver: false }, error: null },
      company_memberships: {
        data: [{ id: 'membership-1', company_id: 'company-1', user_id: 'user-1', role_in_company: 'admin', status: 'active', companies: { id: 'company-1', name: 'Test Co', company_type: 'broker', status: 'active' } }],
        error: null,
      },
      drivers: { data: [], error: null },
      notification_events: { data: [], error: null },
      jobs: { data: [], error: null },
      job_bids: { data: [], error: null },
      invoices: { data: [], error: null },
    };
    mocks.getBearerToken.mockReturnValue('session-token');
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          app_metadata: {},
          user_metadata: { role: 'admin' },
        },
      },
      error: null,
    });
  });

  it('uses authoritative DB role evidence and strips admin-only notifications for Broker', async () => {
    ({ GET } = await import('../app/api/workspace/action-centre/route'));
    mocks.clientNotifications = {
      data: [
        { id: 'evt-1', event_type: 'bid_accepted', entity_type: 'job', status: 'pending', created_at: '2026-08-01T12:00:00.000Z' },
        { id: 'evt-2', event_type: 'admin_membership_changed', entity_type: 'membership', status: 'pending', created_at: '2026-08-01T11:00:00.000Z' },
      ],
      error: null,
    };

    const res = await GET(new NextRequest('http://localhost/api/workspace/action-centre?role=broker&limit=5'));
    expect(res.status).toBe(200);
    expect(mocks.clientEq).toHaveBeenCalledWith('recipient_user_id', 'user-1');
    const body = await res.json() as { items: Array<{ event_id: string; cta_href: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.event_id).toBe('evt-1');
    expect(body.items[0]?.cta_href.startsWith('/broker/')).toBe(true);
  });

  it('rejects a cross-role request even when user_metadata claims admin', async () => {
    ({ GET } = await import('../app/api/workspace/action-centre/route'));
    const res = await GET(new NextRequest('http://localhost/api/workspace/action-centre?role=admin'));
    expect(res.status).toBe(403);
  });

  it('returns 401 when token is missing', async () => {
    ({ GET } = await import('../app/api/workspace/action-centre/route'));
    mocks.getBearerToken.mockReturnValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/action-centre?role=broker'));
    expect(res.status).toBe(401);
  });
});
