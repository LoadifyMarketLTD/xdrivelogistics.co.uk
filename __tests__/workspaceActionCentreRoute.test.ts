import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  eq: vi.fn(),
  limitResult: { data: [] as Array<Record<string, unknown>> | null, error: null as { message?: string } | null },
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: mocks.getBearerToken,
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          mocks.eq(...args);
          return {
            order: () => ({
              limit: () => Promise.resolve(mocks.limitResult),
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
    mocks.eq.mockReset();
    mocks.limitResult = { data: [], error: null };
    mocks.getBearerToken.mockReturnValue('session-token');
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          app_metadata: { role: 'broker', raw_role: 'broker' },
          user_metadata: {},
        },
      },
      error: null,
    });
  });

  it('filters by recipient and strips admin-only events for broker role', async () => {
    ({ GET } = await import('../app/api/workspace/action-centre/route'));
    mocks.limitResult = {
      data: [
        {
          id: 'evt-1',
          event_type: 'bid_accepted',
          entity_type: 'job',
          status: 'pending',
          created_at: '2026-08-01T12:00:00.000Z',
        },
        {
          id: 'evt-2',
          event_type: 'admin_membership_changed',
          entity_type: 'membership',
          status: 'pending',
          created_at: '2026-08-01T11:00:00.000Z',
        },
      ],
      error: null,
    };

    const res = await GET(new NextRequest('http://localhost/api/workspace/action-centre?role=broker&limit=5'));
    expect(res.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith('recipient_user_id', 'user-1');

    const body = await res.json() as { items: Array<{ event_id: string; cta_href: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.event_id).toBe('evt-1');
    expect(body.items[0]?.cta_href.startsWith('/broker/')).toBe(true);
  });

  it('rejects cross-role requests for admin surface', async () => {
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
