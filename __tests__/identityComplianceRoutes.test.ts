import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getBearerToken: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  fromStorage: vi.fn(),
  createSignedUrl: vi.fn(),
  rpc: vi.fn(),
  auditInsert: vi.fn(),
  onboardingRows: [] as Array<Record<string, unknown>>,
  documentFilePath: 'company/documents/test.pdf' as string | null,
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
    storage: {
      from: mocks.fromStorage,
    },
    rpc: mocks.rpc,
  },
}));

import { POST as initOnboarding } from '../app/api/onboarding/init/route';
import { POST as submitIndividualDriver } from '../app/api/onboarding/submit/individual-driver/route';
import { GET as loadComplianceDocuments } from '../app/api/super-admin/compliance/documents/route';
import { POST as viewComplianceDocument } from '../app/api/super-admin/compliance/documents/route';
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

const getRequest = (url: string) =>
  new NextRequest(url, {
    method: 'GET',
  });

beforeEach(() => {
  mocks.getBearerToken.mockReset();
  mocks.getUser.mockReset();
  mocks.from.mockReset();
  mocks.fromStorage.mockReset();
  mocks.createSignedUrl.mockReset();
  mocks.rpc.mockReset();
  mocks.auditInsert.mockReset();
  mocks.onboardingRows = [];
  mocks.documentFilePath = 'company/documents/test.pdf';
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

    if (
      table === 'company_documents' ||
      table === 'driver_documents' ||
      table === 'vehicle_documents' ||
      table === 'driver_identity_documents'
    ) {
      return {
        select: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
          eq: () => ({
            maybeSingle: async () => ({
              data: mocks.documentFilePath
                ? { id: 'doc-1', doc_type: 'Operator Licence', file_path: mocks.documentFilePath }
                : null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'owner_audit_log') {
      return {
        insert: mocks.auditInsert,
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

  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed.example.com/object' },
    error: null,
  });
  mocks.fromStorage.mockImplementation(() => ({
    createSignedUrl: mocks.createSignedUrl,
  }));
  mocks.auditInsert.mockResolvedValue({ error: null });
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

  it('uses atomic document-review RPC for reject decisions', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ document_id: 'doc-1', old_status: 'pending', new_status: 'rejected' }],
      error: null,
    });

    const response = await reviewComplianceDocument(
      patchRequest('http://localhost/api/super-admin/compliance/documents', {
        documentFamily: 'company',
        id: '11111111-1111-4111-8111-111111111111',
        action: 'reject',
        reason: 'Missing page',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('rejected');
    expect(mocks.rpc).toHaveBeenCalledWith(
      'owner_review_compliance_document',
      expect.objectContaining({
        p_action: 'reject',
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

  it('signs relative paths in the expected fallback bucket', async () => {
    mocks.documentFilePath = '/company/app-1/proof.pdf';

    const response = await viewComplianceDocument(
      request('http://localhost/api/super-admin/compliance/documents', {
        documentFamily: 'company',
        id: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.fromStorage).toHaveBeenCalledWith('onboarding-documents');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('company/app-1/proof.pdf', 300);
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'user-1',
        action_type: 'document_viewed',
        target_type: 'company_document',
        target_id: '11111111-1111-4111-8111-111111111111',
        target_name: 'Operator Licence',
      }),
    );
  });

  it('loads compliance document list without audit insert failures', async () => {
    const response = await loadComplianceDocuments(
      getRequest('http://localhost/api/super-admin/compliance/documents?limit=10'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.summary.total).toBe(0);
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it('accepts absolute storage URL only when bucket matches fallback bucket', async () => {
    mocks.documentFilePath =
      'https://project.example.co/storage/v1/object/authenticated/onboarding-documents/company/app-1/proof.pdf';

    const response = await viewComplianceDocument(
      request('http://localhost/api/super-admin/compliance/documents', {
        documentFamily: 'company',
        id: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.fromStorage).toHaveBeenCalledWith('onboarding-documents');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('company/app-1/proof.pdf', 300);
  });

  it('rejects absolute storage URL when bucket differs from fallback bucket', async () => {
    mocks.documentFilePath =
      'https://project.example.co/storage/v1/object/authenticated/driver-docs/company/app-1/proof.pdf';

    const response = await viewComplianceDocument(
      request('http://localhost/api/super-admin/compliance/documents', {
        documentFamily: 'company',
        id: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.fromStorage).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects malformed non-storage URLs', async () => {
    mocks.documentFilePath = 'https://project.example.co/files/company/app-1/proof.pdf';

    const response = await viewComplianceDocument(
      request('http://localhost/api/super-admin/compliance/documents', {
        documentFamily: 'company',
        id: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.fromStorage).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
