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

describe('GET /api/workspace/activity-feed', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.getBearerToken.mockReset();
    mocks.getUser.mockReset();
    mocks.eq.mockReset();
    mocks.limitResult = { data: [], error: null };
    mocks.getBearerToken.mockReturnValue('session-token');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('filters events by recipient user and returns sanitised payload', async () => {
    ({ GET } = await import('../app/api/workspace/activity-feed/route'));
    mocks.limitResult = {
      data: [
        {
          id: 'event-id-1',
          event_type: 'bid_accepted',
          entity_type: 'job',
          entity_id: 'job-123',
          payload: { job_ref: 'ABCDEFGHIJKL1234567890' },
          created_at: '2026-08-01T12:00:00.000Z',
        },
      ],
      error: null,
    };

    const res = await GET(new NextRequest('http://localhost/api/workspace/activity-feed?limit=5'));
    expect(res.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith('recipient_user_id', 'user-1');
    const body = await res.json() as {
      items: Array<{ id: string; label: string; reference: string | null; entity_type: string | null; entity_id: string | null; event_id: string | null }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe('2026-08-01T12:00:00.000Z-0');
    expect(body.items[0]?.label).toBe('Bid Accepted');
    expect(body.items[0]?.reference).toBe('ABCDEFGHIJKL123456');
    expect(body.items[0]?.entity_type).toBe('job');
    expect(body.items[0]?.entity_id).toBe('job-123');
    expect(body.items[0]?.event_id).toBe('event-id-1');
  });

  it('returns 401 when token is missing', async () => {
    ({ GET } = await import('../app/api/workspace/activity-feed/route'));
    mocks.getBearerToken.mockReturnValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/activity-feed'));
    expect(res.status).toBe(401);
  });

  it('fails closed when backend query fails', async () => {
    ({ GET } = await import('../app/api/workspace/activity-feed/route'));
    mocks.limitResult = { data: null, error: { message: 'boom' } };
    const res = await GET(new NextRequest('http://localhost/api/workspace/activity-feed'));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Unable to load activity feed');
  });
});
