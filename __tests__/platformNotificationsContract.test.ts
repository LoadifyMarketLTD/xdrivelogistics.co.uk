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
  profileRole: 'owner',
  notificationListResponses: [] as Array<{ data: unknown[] | null; error: { message: string; code?: string | null } | null }>,
  notificationLookupResponse: { data: { id: 'evt-1', status: 'failed' }, error: null as { message: string; code?: string | null } | null },
  notificationUpdateResponses: [] as Array<{ error: { message: string; code?: string | null } | null }>,
  notificationSelectColumns: [] as string[],
  notificationUpdatePayloads: [] as Array<Record<string, unknown>>,
  notificationEqCalls: [] as Array<[string, string]>,
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
  },
}));

const SAMPLE_BASE: NotificationEventBaseRow = {
  id: 'abc', event_type: 'job_assigned', entity_id: 'e1',
  recipient_user_id: 'u1', payload: null,
  status: 'sent', created_at: '2025-01-01T00:00:00Z', processed_at: null,
};
const SAMPLE_DURABILITY: NotificationEventDurabilityRow = {
  ...SAMPLE_BASE,
  last_error: 'timeout', attempt_count: 2, next_attempt_at: '2025-01-02T00:00:00Z',
};

const getRequest = (url: string) => new NextRequest(url, { method: 'GET' });
const patchRequest = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetModules();
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.profileRole = 'owner';
  mocks.notificationListResponses = [];
  mocks.notificationLookupResponse = { data: { id: 'evt-1', status: 'failed' }, error: null };
  mocks.notificationUpdateResponses = [];
  mocks.notificationSelectColumns = [];
  mocks.notificationUpdatePayloads = [];
  mocks.notificationEqCalls = [];

  mocks.getBearerToken.mockReturnValue('owner-token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'owner-1', email: 'owner@example.com' } },
    error: null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role: mocks.profileRole }, error: null }),
          }),
        }),
      };
    }

    if (table === 'notification_events') {
      return {
        select: (columns: string) => {
          mocks.notificationSelectColumns.push(columns);
          if (columns === 'id, status') {
            return {
              eq: (column: string, value: string) => {
                mocks.notificationEqCalls.push([column, value]);
                return {
                  maybeSingle: async () => mocks.notificationLookupResponse,
                };
              },
            };
          }
          return {
            returns: () => ({
              order: () => ({
                limit: async () => {
                  const next = mocks.notificationListResponses.shift();
                  if (!next) {
                    throw new Error('Unexpected notification list query');
                  }
                  return next;
                },
              }),
            }),
          };
        },
        update: (payload: Record<string, unknown>) => {
          mocks.notificationUpdatePayloads.push(payload);
          return {
            eq: async (column: string, value: string) => {
              mocks.notificationEqCalls.push([column, value]);
              const next = mocks.notificationUpdateResponses.shift();
              if (!next) {
                throw new Error('Unexpected notification update query');
              }
              return next;
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
});

describe('normalizeBaseRow — fallback path', () => {
  it('sets durability fields to null', () => {
    const row = normalizeBaseRow(SAMPLE_BASE);
    expect(row.last_error).toBeNull();
    expect(row.attempt_count).toBeNull();
    expect(row.next_attempt_at).toBeNull();
  });

  it('preserves all baseline fields unchanged', () => {
    const row = normalizeBaseRow(SAMPLE_BASE);
    expect(row.id).toBe('abc');
    expect(row.event_type).toBe('job_assigned');
    expect(row.status).toBe('sent');
    expect(row.created_at).toBe('2025-01-01T00:00:00Z');
  });
});

describe('normalizeDurabilityRow — primary path', () => {
  it('preserves durability fields as-is', () => {
    const row = normalizeDurabilityRow(SAMPLE_DURABILITY);
    expect(row.last_error).toBe('timeout');
    expect(row.attempt_count).toBe(2);
    expect(row.next_attempt_at).toBe('2025-01-02T00:00:00Z');
  });

  it('null durability fields remain null', () => {
    const row = normalizeDurabilityRow({ ...SAMPLE_BASE, last_error: null, attempt_count: null, next_attempt_at: null });
    expect(row.last_error).toBeNull();
    expect(row.attempt_count).toBeNull();
    expect(row.next_attempt_at).toBeNull();
  });
});

describe('isMissingDurabilityColumnError', () => {
  it('returns true for error mentioning last_error', () => {
    expect(isMissingDurabilityColumnError({ message: 'column notification_events.last_error does not exist', code: '42703' })).toBe(true);
  });
  it('returns true for error mentioning attempt_count', () => {
    expect(isMissingDurabilityColumnError({ message: 'column attempt_count does not exist', code: '42703' })).toBe(true);
  });
  it('returns true for error mentioning next_attempt_at', () => {
    expect(
      isMissingDurabilityColumnError({
        message: "Could not find the 'next_attempt_at' column of 'notification_events' in the schema cache",
        code: 'PGRST204',
      }),
    ).toBe(true);
  });
  it('returns false for an unrelated missing table error', () => {
    expect(isMissingDurabilityColumnError({ message: 'relation "public.invoices" does not exist', code: '42P01' })).toBe(false);
  });
  it('returns false for a permission denied error', () => {
    expect(isMissingDurabilityColumnError({ message: 'permission denied for table notification_events' })).toBe(false);
  });
  it('returns false when a durability column is mentioned without a missing-column indicator', () => {
    expect(
      isMissingDurabilityColumnError({
        message: 'permission denied for column last_error of relation notification_events',
        code: '42501',
      }),
    ).toBe(false);
  });
  it('returns false for a network error', () => {
    expect(isMissingDurabilityColumnError({ message: 'fetch failed' })).toBe(false);
  });
});

describe('platform notifications route flow', () => {
  it('uses durability columns on the primary notifications query', async () => {
    mocks.notificationListResponses = [{ data: [SAMPLE_DURABILITY], error: null }];
    const { GET } = await import('../app/api/super-admin/platform/route');

    const response = await GET(getRequest('http://localhost/api/super-admin/platform?section=notifications'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.notificationSelectColumns).toEqual([
      'id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at',
    ]);
    expect(body.rows).toEqual([
      expect.objectContaining({
        id: 'abc',
        last_error: 'timeout',
        attempt_count: 2,
        next_attempt_at: '2025-01-02T00:00:00Z',
      }),
    ]);
    expect(body.diagnosticNote).toBeUndefined();
  });

  it('falls back to baseline columns only for confirmed missing durability-column errors', async () => {
    mocks.notificationListResponses = [
      {
        data: null,
        error: { message: 'column notification_events.last_error does not exist', code: '42703' },
      },
      { data: [SAMPLE_BASE], error: null },
    ];
    const { GET } = await import('../app/api/super-admin/platform/route');

    const response = await GET(getRequest('http://localhost/api/super-admin/platform?section=notifications'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.notificationSelectColumns).toEqual([
      'id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at',
      'id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at',
    ]);
    expect(body.rows).toEqual([
      expect.objectContaining({
        id: 'abc',
        last_error: null,
        attempt_count: null,
        next_attempt_at: null,
      }),
    ]);
    expect(body.diagnosticNote).toContain('error detail unavailable');
  });

  it('surfaces unrelated notification query errors without falling back', async () => {
    mocks.notificationListResponses = [
      {
        data: null,
        error: {
          message: 'permission denied for column last_error of relation notification_events',
          code: '42501',
        },
      },
    ];
    const { GET } = await import('../app/api/super-admin/platform/route');

    const response = await GET(getRequest('http://localhost/api/super-admin/platform?section=notifications'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.notificationSelectColumns).toHaveLength(1);
    expect(body.rows).toEqual([]);
    expect(body.note).toBe('permission denied for column last_error of relation notification_events');
    expect(body.errorCode).toBe('42501');
  });

  it('retries PATCH with the baseline update when durability columns are unavailable', async () => {
    mocks.notificationUpdateResponses = [
      {
        error: {
          message: "Could not find the 'last_error' column of 'notification_events' in the schema cache",
          code: 'PGRST204',
        },
      },
      { error: null },
    ];
    const { PATCH } = await import('../app/api/super-admin/platform/route');

    const response = await PATCH(
      patchRequest('http://localhost/api/super-admin/platform', {
        section: 'notifications',
        action: 'retry',
        notificationId: 'evt-1',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, notificationId: 'evt-1', status: 'pending' });
    expect(mocks.notificationUpdatePayloads).toHaveLength(2);
    expect(mocks.notificationUpdatePayloads[0]).toMatchObject({
      status: 'pending',
      processed_at: null,
      last_error: null,
    });
    expect(mocks.notificationUpdatePayloads[0]?.next_attempt_at).toEqual(expect.any(String));
    expect(mocks.notificationUpdatePayloads[1]).toEqual({
      status: 'pending',
      processed_at: null,
    });
  });
});
