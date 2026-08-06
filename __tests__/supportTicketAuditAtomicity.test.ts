import { readFileSync } from 'fs';
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

import { PATCH } from '../app/api/super-admin/support/route';

const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const patchRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/super-admin/support', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const successfulMutation = (status: string) => ({
  ticket_id: TICKET_ID,
  status,
  resolution_note: 'Operational reason recorded',
  resolved_at: status === 'resolved' || status === 'closed'
    ? '2026-08-06T21:00:00.000Z'
    : null,
  closed_at: status === 'closed' ? '2026-08-06T21:01:00.000Z' : null,
  updated_at: '2026-08-06T21:01:00.000Z',
});

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.rpc.mockReset();

  mocks.getBearerToken.mockReturnValue('owner-token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: ACTOR_ID, email: 'owner@example.com' } },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'profiles') {
      throw new Error(`Unexpected direct table access during support-ticket PATCH: ${table}`);
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

describe('PATCH /api/super-admin/support — atomic support-ticket audit', () => {
  const cases = [
    ['investigating', 'investigating'],
    ['resolve', 'resolved'],
    ['close', 'closed'],
    ['reopen', 'open'],
  ] as const;

  it.each(cases)('routes %s through the single atomic RPC', async (action, resultingStatus) => {
    mocks.rpc.mockResolvedValue({ data: [successfulMutation(resultingStatus)], error: null });

    const response = await PATCH(
      patchRequest({
        section: 'tickets',
        ticketId: TICKET_ID,
        action,
        note: '  Operational reason recorded  ',
      }),
    );
    const body = await response.json() as {
      ticket: { id: string; status: string; resolution_note: string };
    };

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('owner_update_support_ticket_with_audit', {
      p_actor_user_id: ACTOR_ID,
      p_ticket_id: TICKET_ID,
      p_action: action,
      p_note: 'Operational reason recorded',
    });
    expect(body.ticket).toEqual(
      expect.objectContaining({
        id: TICKET_ID,
        status: resultingStatus,
        resolution_note: 'Operational reason recorded',
      }),
    );
  });

  it.each([
    undefined,
    '',
    '   ',
    'no',
  ])('rejects a missing or too-short reason before mutation (%s)', async (note) => {
    const response = await PATCH(
      patchRequest({
        section: 'tickets',
        ticketId: TICKET_ID,
        action: 'resolve',
        ...(note === undefined ? {} : { note }),
      }),
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('reason');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['P0002', 404],
    ['42501', 403],
    ['23514', 400],
    ['23502', 400],
    ['22P02', 400],
    ['XX000', 500],
  ] as const)('maps RPC error %s to HTTP %s', async (code, expectedStatus) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: `database error ${code}` },
    });

    const response = await PATCH(
      patchRequest({
        section: 'tickets',
        ticketId: TICKET_ID,
        action: 'close',
        note: 'Closing after verified resolution',
      }),
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(expectedStatus);
    expect(body.error).toBe(`database error ${code}`);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the RPC returns no mutation row', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const response = await PATCH(
      patchRequest({
        section: 'tickets',
        ticketId: TICKET_ID,
        action: 'investigating',
        note: 'Escalating to the operations team',
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Support ticket update returned no data.' });
  });

  it('contains no direct ticket update or separate audit insert in the PATCH handler', () => {
    const route = readRepoFile('app/api/super-admin/support/route.ts');
    const patchStart = route.indexOf('export async function PATCH');
    const postStart = route.indexOf('export async function POST');
    const patchHandler = route.slice(patchStart, postStart);

    expect(patchStart).toBeGreaterThanOrEqual(0);
    expect(postStart).toBeGreaterThan(patchStart);
    expect(patchHandler).toContain("'owner_update_support_ticket_with_audit'");
    expect(patchHandler.match(/supabaseAdmin\.rpc\(/g)).toHaveLength(1);
    expect(patchHandler).not.toMatch(/\.from\(['\"]support_tickets['\"]\)[\s\S]*?\.update\(/);
    expect(patchHandler).not.toMatch(/\.from\(['\"]owner_audit_log['\"]\)[\s\S]*?\.insert\(/);
  });

  it('preserves the generic audit schema and nullable-company SQL regression', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260806215000_atomic_support_ticket_audit.sql',
    );
    const nullableCompanyRegression = readRepoFile(
      'supabase/tests/support_ticket_audit_nullable_company.sql',
    );

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS metadata jsonb');
    expect(migration).toMatch(/ALTER COLUMN target_company_id DROP NOT NULL/);
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.owner_update_support_ticket_with_audit(',
    );
    expect(nullableCompanyRegression).toContain('target_company_id IS NULL');
    expect(nullableCompanyRegression).toContain("metadata->>'ticket_id'");
    expect(nullableCompanyRegression).toContain('ROLLBACK;');
  });
});
