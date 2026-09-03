import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const isDeployPreviewReadOnly = () =>
  process.env.CONTEXT === 'deploy-preview'
  || Boolean(process.env.DEPLOY_PRIME_URL?.includes('deploy-preview-'))
  || Boolean(process.env.URL?.includes('deploy-preview-'));

type MissingDocumentRow = {
  doc_type?: string | null;
  required_doc_type?: string | null;
  document_type?: string | null;
};

type RequirementRow = {
  document_family: 'company' | 'identity' | string;
  doc_type: string;
};

type CompanyDocumentRow = {
  doc_type: string;
  file_path: string | null;
  status: string | null;
  expiry_date: string | null;
  updated_at: string | null;
};

type IdentityDocumentRow = {
  doc_type: string;
  file_path: string | null;
  upload_status: string | null;
  verification_status: string | null;
  expiry_date: string | null;
  updated_at: string | null;
};

type ChecklistStatus = 'missing' | 'uploaded' | 'approved' | 'expiring_soon' | 'expired' | 'rejected';

const documentName = (row: MissingDocumentRow) =>
  String(row.doc_type ?? row.required_doc_type ?? row.document_type ?? '').trim();

const daysUntil = (dateValue: string | null) => {
  if (!dateValue) return null;
  const expiry = Date.parse(`${dateValue}T00:00:00Z`);
  if (!Number.isFinite(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / 86_400_000);
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Onboarding service is unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, current_step, completion_percentage')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (applicationError) return json(500, { error: applicationError.message });
  if (!application) return json(200, { available: true, application: null, missingDocuments: [], missingCount: 0, documents: [] });

  const { data: rows, error: missingError } = await supabaseAdmin.rpc('get_missing_onboarding_documents', {
    p_application_id: application.id,
  });
  if (missingError) return json(503, { error: 'Required document checklist is temporarily unavailable.' });

  const missingDocuments = ((rows ?? []) as MissingDocumentRow[]).map(documentName).filter(Boolean);
  const missingSet = new Set(missingDocuments);

  const [requirementsResult, companyDocumentsResult, identityDocumentsResult] = await Promise.all([
    supabaseAdmin
      .from('compliance_document_requirements')
      .select('document_family, doc_type')
      .eq('account_type', application.account_type)
      .eq('active', true)
      .eq('required', true),
    supabaseAdmin
      .from('company_documents')
      .select('doc_type, file_path, status, expiry_date, updated_at')
      .eq('onboarding_application_id', application.id)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('driver_identity_documents')
      .select('doc_type, file_path, upload_status, verification_status, expiry_date, updated_at')
      .eq('onboarding_application_id', application.id)
      .order('updated_at', { ascending: false }),
  ]);

  const detailsAvailable = !requirementsResult.error && !companyDocumentsResult.error && !identityDocumentsResult.error;
  const companyByType = new Map<string, CompanyDocumentRow>();
  const identityByType = new Map<string, IdentityDocumentRow>();

  for (const row of (companyDocumentsResult.data ?? []) as CompanyDocumentRow[]) {
    if (!companyByType.has(row.doc_type)) companyByType.set(row.doc_type, row);
  }
  for (const row of (identityDocumentsResult.data ?? []) as IdentityDocumentRow[]) {
    if (!identityByType.has(row.doc_type)) identityByType.set(row.doc_type, row);
  }

  const documents = detailsAvailable
    ? ((requirementsResult.data ?? []) as RequirementRow[]).map((requirement) => {
      const family = requirement.document_family;
      const docType = requirement.doc_type;
      const missing = missingSet.has(docType);
      const companyDocument = family === 'company' ? companyByType.get(docType) ?? null : null;
      const identityDocument = family === 'identity' ? identityByType.get(docType) ?? null : null;
      let evidence: CompanyDocumentRow | IdentityDocumentRow | null = companyDocument ?? identityDocument;
      let satisfiedBy: string | null = null;

      if (
        !evidence
        && !missing
        && application.account_type === 'owner_driver'
        && family === 'identity'
        && docType === 'proof_of_address'
      ) {
        evidence = identityByType.get('driving_licence') ?? null;
        satisfiedBy = evidence ? 'driving_licence' : 'canonical_alternative_evidence';
      }

      const expiryDate = evidence?.expiry_date ?? null;
      const expiryDays = daysUntil(expiryDate);
      const rawStatus = companyDocument?.status
        ?? identityDocument?.verification_status
        ?? identityDocument?.upload_status
        ?? null;
      const normalizedRawStatus = String(rawStatus ?? '').toLowerCase();
      const hasFile = Boolean(evidence?.file_path);
      const isRejected = normalizedRawStatus === 'rejected';
      const isExpired = expiryDays !== null && expiryDays < 0;
      const isApproved = !missing;
      let status: ChecklistStatus;
      let reviewStatus: 'not_uploaded' | 'pending_review' | 'approved' | 'rejected';

      if (isRejected) {
        status = 'rejected';
        reviewStatus = 'rejected';
      } else if (isExpired) {
        status = 'expired';
        reviewStatus = isApproved ? 'approved' : hasFile ? 'pending_review' : 'not_uploaded';
      } else if (isApproved && expiryDays !== null && expiryDays <= 30) {
        status = 'expiring_soon';
        reviewStatus = 'approved';
      } else if (isApproved) {
        status = 'approved';
        reviewStatus = 'approved';
      } else if (hasFile) {
        status = 'uploaded';
        reviewStatus = 'pending_review';
      } else {
        status = 'missing';
        reviewStatus = 'not_uploaded';
      }

      return {
        family,
        docType,
        status,
        reviewStatus,
        expiryDate,
        daysUntilExpiry: expiryDays,
        satisfiedBy,
      };
    })
    : [];

  // Normal runtime may close a durable request once the canonical requirement set is complete.
  // Deploy Preview is strictly read-only, so even this housekeeping write must fail closed there.
  if (missingDocuments.length === 0 && !isDeployPreviewReadOnly()) {
    try {
      await supabaseAdmin.rpc('resolve_completed_document_requests', { p_application_id: application.id });
    } catch {
      // Housekeeping is best-effort and must never block the read-only checklist response.
    }
  }

  return json(200, {
    available: true,
    previewReadOnly: isDeployPreviewReadOnly(),
    application: {
      id: application.id,
      status: application.status,
      accountType: application.account_type,
      currentStep: application.current_step,
      completionPercentage: Number(application.completion_percentage ?? 0),
    },
    missingDocuments,
    missingCount: missingDocuments.length,
    complete: missingDocuments.length === 0,
    documents,
    documentDetailsAvailable: detailsAvailable,
    documentDetailsNote: detailsAvailable ? null : 'Detailed document states are temporarily unavailable; canonical missing-document truth remains available.',
  });
}
