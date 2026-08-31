import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  isMissingDurabilityColumnError,
  normalizeBaseRow,
  normalizeDurabilityRow,
  type NotificationEventBaseRow,
  type NotificationEventDurabilityRow,
} from '../app/api/super-admin/_lib/notificationEvents';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  profileRole: 'owner',
  profileStatus: 'active',
  notificationListResponses: [] as Array<{ data: unknown[] | null; error: { message: string; code?: string | null } | null }>,
  notificationSelectColumns: [] as string[],
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: mocks.getBearerToken,
  supabaseValidator: {
    auth: {
      getUser: mocks.getUser,
    },
  },
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

const SAMPLE_BASE: NotificationEventBaseRow = {
  id: '11111111-1111-4111-8111-111111111111',
  event_type: 'job_assigned',
  entity_id: '22222222-2222-4222-8222-222222222222',
  recipient_user_id: '33333333-3333-4333-8333-333333333333',
  payload: null,
  status: 'sent',
  created_at: '2026-08-01T12:00:00Z',
  processed_at: null,
};

const SAMPLE_DURABILITY: NotificationEventDurabilityRow = {
  ...SAMPLE_BASE,
  last_error: 'timeout',
  attempt_count: 2,
  next_attempt_at: '2026-08-01T12:05:00Z',
};

const getRequest = (url: string) => new NextRequest(url, { method: 'GET' });
const patchRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/super-admin/platform', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetModules();
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  mocks.profileRole = 'owner';
  mocks.profileStatus = 'active';
  mocks.notificationListResponses = [];
  mocks.notificationSelectColumns = [];

  mocks.getBearerToken.mockReturnValue('owner-token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: '44444444-4444-4444-8444-444444444444', email: 'owner@example.com' } },
    error: null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { role: mocks.profileRole, status: mocks.profileStatus },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'notification_events') {
      return {
        select: (columns: string) => {
          mocks.notificationSelectColumns.push(columns);
          return {
            returns: () => ({
              order: () => ({
                limit: async () => {
                  const next = mocks.notificationListResponses.shift();
                  if (!next) throw new Error('Unexpected notification list query');
                  return next;
                },
              }),
            }),
          };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
});

describe('notification event normalization', () => {
  it('preserves baseline fields and marks missing durability fields unavailable', () => {
    const row = normalizeBaseRow(SAMPLE_BASE);
    expect(row.id).toBe(SAMPLE_BASE.id);
    expect(row.last_error).toBeNull();
    expect(row.attempt_count).toBeNull();
    expect(row.next_attempt_at).toBeNull();
  });

  it('preserves durability fields on the canonical path', () => {
    const row = normalizeDurabilityRow(SAMPLE_DURABILITY);
    expect(row.last_error).toBe('timeout');
    expect(row.attempt_count).toBe(2);
    expect(row.next_attempt_at).toBe('2026-08-01T12:05:00Z');
  });

  it('only classifies confirmed durability-column errors as schema fallback candidates', () => {
    expect(isMissingDurabilityColumnError({ message: 'column notification_events.last_error does not exist', code: '42703' })).toBe(true);
    expect(isMissingDurabilityColumnError({ message: 'permission denied for column last_error', code: '42501' })).toBe(false);
  });
});

describe('platform notifications route', () => {
  it('uses durability columns on the primary read path', async () => {
    mocks.notificationListResponses = [{ data: [SAMPLE_DURABILITY], error: null }];
    const { GET } = await import('../app/api/super-admin/platform/route');

    const response = await GET(getRequest('http://localhost/api/super-admin/platform?section=notifications'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.notificationSelectColumns).toEqual([
      'id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at',
    ]);
    expect(body.rows[0]).toEqual(expect.objectContaining({
      id: SAMPLE_BASE.id,
      last_error: 'timeout',
      attempt_count: 2,
    }));
    expect(body.diagnosticNote).toBeUndefined();
  });

  it('keeps the read-only degraded-schema fallback for legacy notification rows', async () => {
    mocks.notificationListResponses = [
      { data: null, error: { message: 'column notification_events.last_error does not exist', code: '42703' } },
      { data: [SAMPLE_BASE], error: null },
    ];
    const { GET } = await import('../app/api/super-admin/platform/route');

    const response = await GET(getRequest('http://localhost/api/super-admin/platform?section=notifications'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.notificationSelectColumns).toHaveLength(2);
    expect(body.rows[0].attempt_count).toBeNull();
    expect(body.diagnosticNote).toContain('durability columns');
  });

  it('does not hide unrelated notification read failures behind the schema fallback', async () => {
    mocks.notificationListResponses = [
      { data: null, error: { message: 'permission denied for column last_error', code: '42501' } },
    ];
    const { GET } = await import('../app/api/super-admin/platform/route');

    const response = await GET(getRequest('http://localhost/api/super-admin/platform?section=notifications'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.diagnosticCode).toBe('NOTIFICATION_EVENTS_QUERY_FAILED');
  });

  it('queues retries only through the audited Platform Owner RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        notification_id: SAMPLE_BASE.id,
        status: 'pending',
        attempt_count: 2,
        next_attempt_at: '2026-08-01T12:10:00Z',
      }],
      error: null,
    });
    const { PATCH } = await import('../app/api/super-admin/platform/route');

    const response = await PATCH(patchRequest({
      section: 'notifications',
      action: 'retry',
      notificationId: SAMPLE_BASE.id,
      reason: 'Provider timeout recovered',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('owner_retry_notification_event', {
      p_actor_user_id: '44444444-4444-4444-8444-444444444444',
      p_notification_id: SAMPLE_BASE.id,
      p_reason: 'Provider timeout recovered',
    });
    expect(body).toEqual(expect.objectContaining({
      success: true,
      notificationId: SAMPLE_BASE.id,
      status: 'pending',
    }));
  });

  it('fails closed when the audited retry migration is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
    const { PATCH } = await import('../app/api/super-admin/platform/route');

    const response = await PATCH(patchRequest({
      section: 'notifications',
      action: 'retry',
      notificationId: SAMPLE_BASE.id,
      reason: 'Retry after provider recovery',
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.migrationRequired).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('requires a material retry reason before touching the queue', async () => {
    const { PATCH } = await import('../app/api/super-admin/platform/route');
    const response = await PATCH(patchRequest({
      section: 'notifications',
      action: 'retry',
      notificationId: SAMPLE_BASE.id,
      reason: 'no',
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects inactive owner profiles before the retry RPC', async () => {
    mocks.profileStatus = 'suspended';
    const { PATCH } = await import('../app/api/super-admin/platform/route');
    const response = await PATCH(patchRequest({
      section: 'notifications',
      action: 'retry',
      notificationId: SAMPLE_BASE.id,
      reason: 'Retry after provider recovery',
    }));

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
