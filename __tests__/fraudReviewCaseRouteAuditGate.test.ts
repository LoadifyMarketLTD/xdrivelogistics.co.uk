import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
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

import { PATCH } from '../app/api/super-admin/compliance/fraud-cases/route';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '22222222-2222-4222-8222-222222222222';

const requestFor = (body: unknown) =>
  new NextRequest('http://localhost/api/super-admin/compliance/fraud-cases', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.rpc.mockReset();

  mocks.getBearerToken.mockReturnValue('owner-token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: ACTOR_ID, email: 'owner@example.test' } },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'profiles') {
      throw new Error(`Unexpected direct table access during fraud PATCH: ${table}`);
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role: 'owner' }, error: null }),
        }),
      }),
    };
  });
});

describe('PATCH /api/super-admin/compliance/fraud-cases — audited deployment gate', () => {
  it('calls only the versioned audited RPC and returns its complete result', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ case_id: CASE_ID, old_status: 'open', new_status: 'investigating' }],
      error: null,
    });

    const response = await PATCH(
      requestFor({
        caseId: CASE_ID,
        action: 'investigate',
        reason: '  Evidence review started  ',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'owner_decide_fraud_review_case_audited',
      {
        p_actor_user_id: ACTOR_ID,
        p_case_id: CASE_ID,
        p_action: 'investigate',
        p_reason: 'Evidence review started',
      },
    );
    expect(await response.json()).toEqual({
      success: true,
      caseId: CASE_ID,
      status: 'investigating',
    });
  });

  it.each([
    undefined,
    '',
    '   ',
    'four',
  ])('rejects a missing or shorter-than-five-character reason (%s)', async (reason) => {
    const response = await PATCH(
      requestFor({
        caseId: CASE_ID,
        action: 'clear',
        ...(reason === undefined ? {} : { reason }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await response.json()).error).toContain('at least 5 characters');
  });

  it.each(['PGRST202', '42883'])('fails closed with 503 when audited RPC is unavailable (%s)', async (code) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'function not found' },
    });

    const response = await PATCH(
      requestFor({
        caseId: CASE_ID,
        action: 'dismiss',
        reason: 'Duplicate alert verified',
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Fraud governance audit migration is not ready. No action was applied.',
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { data: [] },
    { data: [{}] },
    { data: [{ case_id: CASE_ID }] },
    { data: [{ new_status: 'cleared' }] },
  ])('never returns success for an incomplete audited result', async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null });

    const response = await PATCH(
      requestFor({
        caseId: CASE_ID,
        action: 'clear',
        reason: 'Identity evidence verified',
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Fraud governance action returned no audited result.',
    });
  });

  it.each([
    ['P0002', 404],
    ['42501', 403],
    ['23505', 409],
    ['23514', 422],
    ['23502', 422],
    ['XX000', 500],
  ] as const)('maps database error %s to HTTP %s without false success', async (code, status) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: `database error ${code}` },
    });

    const response = await PATCH(
      requestFor({
        caseId: CASE_ID,
        action: 'confirm',
        reason: 'Confirmed from verified evidence',
      }),
    );

    expect(response.status).toBe(status);
    expect(response.status).not.toBe(200);
  });
});
