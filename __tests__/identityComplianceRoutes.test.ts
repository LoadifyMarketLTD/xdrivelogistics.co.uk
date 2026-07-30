import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  onboardingRows: [] as Array<Record<string, unknown>>,
  profileRole: 'owner',
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

import { POST as initOnboarding } from '../app/api/onboarding/init/route';
import { POST as submitIndividualDriver } from '../app/api/onboarding/submit/individual-driver/route';
import { PATCH as reviewComplianceDocument } from '../app/api/super-admin/compliance/documents/route';
import { PATCH as reviewFraudCase } from '../app/api/super-admin/compliance/fraud-cases/route';

const request = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const patchRequest = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.rpc.mockReset();
  mocks.onboardingRows = [];
  mocks.profileRole = 'owner';

  mocks.getBearerToken.mockReturnValue('token');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
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

    if (table === 'onboarding_applications') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: mocks.onboardingRows, error: null }),
            }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  });
});

describe('identity compliance route hardening', () => {
  it('fails closed when onboarding init finds multiple historical applications', async () => {
    mocks.onboardingRows = [
      { id: 'a', created_at: '2026-07-29T10:00:00.000Z', account_type: 'owner_driver', status: 'draft' },
      { id: 'b', created_at: '2026-07-28T10:00:00.000Z', account_type: 'owner_driver', status: 'draft' },
    ];

    const response = await initOnboarding(request('http://localhost/api/onboarding/init', {}));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('onboarding_application_integrity_violation');
  });

  it('fails closed when company-driver submission finds multiple applications', async () => {
    mocks.onboardingRows = [
      { id: 'a', account_type: 'individual_driver', created_at: '2026-07-29T10:00:00.000Z' },
      { id: 'b', account_type: 'individual_driver', created_at: '2026-07-28T10:00:00.000Z' },
    ];

    const response = await submitIndividualDriver(
      request('http://localhost/api/onboarding/submit/individual-driver'),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('onboarding_application_integrity_violation');
  });

  it('uses atomic document-review RPC for compliance decisions', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ document_id: 'doc-1', old_status: 'pending', new_status: 'approved' }],
      error: null,
    });

    const response = await reviewComplianceDocument(
      patchRequest('http://localhost/api/super-admin/compliance/documents', {
        documentFamily: 'company',
        id: '11111111-1111-4111-8111-111111111111',
        action: 'approve',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('approved');
    expect(mocks.rpc).toHaveBeenCalledWith(
      'owner_review_compliance_document',
      expect.objectContaining({
        p_action: 'approve',
        p_document_family: 'company',
      }),
    );
  });

  it('maps atomic fraud decision conflicts to deterministic 409 responses', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Fraud review case is already finalised as confirmed.', code: '23505' },
    });

    const response = await reviewFraudCase(
      patchRequest('http://localhost/api/super-admin/compliance/fraud-cases', {
        caseId: '22222222-2222-4222-8222-222222222222',
        action: 'clear',
        reason: 'manual verification complete',
      }),
    );

    expect(response.status).toBe(409);
  });
});
