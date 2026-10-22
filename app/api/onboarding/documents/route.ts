import crypto from 'crypto';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  BROKER_DOCUMENT_TYPES,
  FLEET_DOCUMENT_TYPES,
  INDIVIDUAL_DRIVER_DOCUMENT_TYPES,
  OWNER_DRIVER_DOCUMENT_TYPES,
} from '../../_lib/onboarding';
import { assessStoredOnboardingRecovery } from '../_lib/recovery';

export const runtime = 'nodejs';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const fleetDocTypeSchema = z.enum(FLEET_DOCUMENT_TYPES);
const ownerDriverDocTypeSchema = z.enum(OWNER_DRIVER_DOCUMENT_TYPES);
const brokerDocTypeSchema = z.enum(BROKER_DOCUMENT_TYPES);
const individualDriverDocTypeSchema = z.enum(INDIVIDUAL_DRIVER_DOCUMENT_TYPES);

const registerDuplicateCaseAndHold = async (params: {
  subjectUserId: string;
  subjectCompanyId: string | null;
  onboardingApplicationId: string;
  matchedUserId: string | null;
  matchedCompanyId: string | null;
  fileSha256: string;
  attemptedDocType: string;
  matchedFingerprintId: string;
  matchedDocumentFamily: string | null;
  matchedDocumentId: string | null;
}) => {
  const { data, error } = await supabaseAdmin!.rpc('register_duplicate_document_fraud_case', {
    p_subject_user_id: params.subjectUserId,
    p_subject_company_id: params.subjectCompanyId,
    p_onboarding_application_id: params.onboardingApplicationId,
    p_matched_user_id: params.matchedUserId,
    p_matched_company_id: params.matchedCompanyId,
    p_file_sha256: params.fileSha256,
    p_attempted_doc_type: params.attemptedDocType,
    p_matched_fingerprint_id: params.matchedFingerprintId,
    p_matched_document_family: params.matchedDocumentFamily,
    p_matched_document_id: params.matchedDocumentId,
  });

  if (error) return { caseId: null as string | null, error };
  return { caseId: typeof data === 'string' ? data : null, error: null };
};

const hasClearedDuplicateDecision = async (
  onboardingApplicationId: string,
  fileSha256: string,
) => {
  const { data, error } = await supabaseAdmin!
    .from('fraud_review_cases')
    .select('id')
    .eq('onboarding_application_id', onboardingApplicationId)
    .eq('case_type', 'duplicate_file')
    .filter('evidence->>file_sha256', 'eq', fileSha256)
    .in('status', ['cleared', 'dismissed'])
    .limit(1)
    .maybeSingle();

  if (error) return { allowed: false, error };
  return { allowed: Boolean(data?.id), error: null };
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const bearer = getBearerToken(request);
  if (!bearer) return json(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(bearer);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized: invalid token.' });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const docType = String(formData.get('docType') ?? '').trim();

  if (!(file instanceof File)) {
    return json(400, { error: 'No file uploaded.' });
  }

  if (!docType) {
    return json(400, { error: 'Document type is required.' });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return json(413, { error: 'Document must be between 1 byte and 10MB.' });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return json(415, { error: 'Only PDF, JPG, PNG, or WebP documents are allowed.' });
  }

  const { data: appRows, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, account_type, company_id, risk_status, payload, status')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(2);

  if (appError) return json(500, { error: appError.message });
  if ((appRows ?? []).length > 1) {
    return json(409, {
      error: 'Multiple onboarding applications were found for this user. Platform Owner review is required before uploading documents.',
      code: 'onboarding_application_integrity_violation',
    });
  }
  const app = appRows?.[0] ?? null;
  if (!app) return json(404, { error: 'Onboarding application not found.' });
  if (app.risk_status === 'confirmed_fraud' || app.status === 'rejected') {
    return json(403, { error: 'This application is blocked from uploading documents.' });
  }

  const accountType = app.account_type as string;
  const parsedFleetDocType = accountType === 'fleet_courier' ? fleetDocTypeSchema.safeParse(docType) : null;
  const parsedOwnerDriverDocType = accountType === 'owner_driver' ? ownerDriverDocTypeSchema.safeParse(docType) : null;
  const parsedBrokerDocType = accountType === 'broker_shipper' ? brokerDocTypeSchema.safeParse(docType) : null;
  const parsedIndividualDriverDocType = accountType === 'individual_driver' ? individualDriverDocTypeSchema.safeParse(docType) : null;

  if (accountType === 'fleet_courier' && !parsedFleetDocType?.success) {
    return json(400, { error: 'Invalid fleet document type.' });
  }

  if (accountType === 'owner_driver' && !parsedOwnerDriverDocType?.success) {
    return json(400, { error: 'Invalid owner driver document type.' });
  }

  if (accountType === 'broker_shipper' && !parsedBrokerDocType?.success) {
    return json(400, { error: 'Invalid broker document type.' });
  }

  if (accountType === 'individual_driver' && !parsedIndividualDriverDocType?.success) {
    return json(400, { error: 'Invalid individual driver document type.' });
  }

  if (
    accountType !== 'fleet_courier' &&
    accountType !== 'owner_driver' &&
    accountType !== 'broker_shipper' &&
    accountType !== 'individual_driver'
  ) {
    return json(400, { error: 'Document uploads are not supported for this onboarding account type.' });
  }

  const bytes = await file.arrayBuffer();
  const fileSha256 = crypto
    .createHash('sha256')
    .update(Buffer.from(bytes))
    .digest('hex');

  const { data: duplicateFingerprint, error: duplicateError } = await supabaseAdmin
    .from('document_fingerprints')
    .select('id, onboarding_application_id, user_id, company_id, document_family, document_id')
    .eq('file_sha256', fileSha256)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    return json(503, {
      error: duplicateError.message,
      code: 'identity_compliance_registry_unavailable',
    });
  }

  if (duplicateFingerprint) {
    const sameApplication = duplicateFingerprint.onboarding_application_id === app.id;
    if (sameApplication) {
      return json(409, {
        error: 'This exact document has already been uploaded to this application.',
        code: 'duplicate_document_in_application',
      });
    }

    const { allowed, error: clearanceError } = await hasClearedDuplicateDecision(app.id, fileSha256);
    if (clearanceError) {
      return json(503, {
        error: clearanceError.message,
        code: 'identity_compliance_registry_unavailable',
      });
    }

    if (!allowed) {
      const { caseId, error: caseError } = await registerDuplicateCaseAndHold({
        subjectUserId: authData.user.id,
        subjectCompanyId: app.company_id ?? null,
        onboardingApplicationId: app.id,
        matchedUserId: duplicateFingerprint.user_id ?? null,
        matchedCompanyId: duplicateFingerprint.company_id ?? null,
        fileSha256,
        attemptedDocType: docType,
        matchedFingerprintId: duplicateFingerprint.id,
        matchedDocumentFamily: (duplicateFingerprint.document_family as string | null) ?? null,
        matchedDocumentId: (duplicateFingerprint.document_id as string | null) ?? null,
      });

      if (caseError || !caseId) {
        return json(500, { error: caseError?.message ?? 'Failed to create fraud review case.' });
      }

      return json(409, {
        error: 'A duplicate document was detected. The application is on hold for Platform Owner review.',
        code: 'duplicate_document_detected',
        reviewCaseId: caseId,
      });
    }
  }

  const ext = path.extname(file.name || '').toLowerCase();
  const fileName = sanitizeFilename(`${crypto.randomUUID()}-${docType}${ext}`);
  const objectPath = `${authData.user.id}/${app.id}/${fileName}`;

  const cleanupUploadedObject = async () => {
    const { error } = await supabaseAdmin!.storage.from('onboarding-documents').remove([objectPath]);
    if (error) console.error('[onboarding-documents] cleanup failed', { objectPath, error: error.message });
  };

  const { error: uploadError } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return json(500, { error: uploadError.message });
  }

  const documentFamily = ['owner_driver', 'individual_driver'].includes(accountType) ? 'identity' : 'company';
  // The database serializes the application, archives prior evidence, inserts
  // the new unverified revision and preserves the submitted review state.
  const { data: stored, error: storeError } = await supabaseAdmin.rpc('store_onboarding_document_revision', {
    p_application_id: app.id,
    p_actor_user_id: authData.user.id,
    p_document_family: documentFamily,
    p_doc_type: docType,
    p_file_path: objectPath,
    p_file_sha256: fileSha256,
  });
  if (storeError) {
    await cleanupUploadedObject();
    const status = storeError.code === '42501' ? 403 : storeError.code === 'P0002' ? 404
      : ['23505', '23514'].includes(storeError.code ?? '') ? 409 : 503;
    return json(status, { error: storeError.message, code: 'document_revision_not_saved' });
  }
  const result = stored as Record<string, unknown>;
  const savedApplication = result.application as Record<string, unknown> | undefined;
  if (savedApplication?.status === 'in_progress' && !savedApplication.submitted_at) {
    const assessed = await assessStoredOnboardingRecovery({
      applicationId: app.id, accountType, companyId: app.company_id, payload: savedApplication.payload,
    });
    if (!assessed.error) {
      // Never demote an application that a reviewer/submission advanced while
      // progress was calculated. A progress-refresh failure keeps the saved file.
      const { data: refreshed } = await supabaseAdmin.from('onboarding_applications')
        .update({ completion_percentage: assessed.recovery.progress })
        .eq('id', app.id).eq('status', 'in_progress').is('submitted_at', null)
        .select('*').maybeSingle();
      if (refreshed) result.application = refreshed;
    }
  }
  return json(200, { ...result, fileSha256 });
}

// Authenticated self-service only. Pending applicants do not need access to an
// operational workspace to see or correct their own onboarding evidence.
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Document service is unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Sign in to manage your documents.' });
  const { data: auth, error: authError } = await (supabaseValidator ?? supabaseAdmin).auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: 'Sign in again to manage your documents.' });
  const { data: application, error: appError } = await supabaseAdmin.from('onboarding_applications')
    .select('id, account_type, status, risk_status').eq('user_id', auth.user.id).maybeSingle();
  if (appError) return json(503, { error: 'Your application could not be loaded.' });
  if (!application) return json(404, { error: 'No onboarding application was found for your account.' });
  const identity = ['owner_driver', 'individual_driver'].includes(application.account_type);
  const table = identity ? 'driver_identity_documents' : 'company_documents';
  const { data: documents, error } = await supabaseAdmin.from(table)
    .select(identity ? 'id, doc_type, file_path, upload_status, verification_status, created_at'
      : 'id, doc_type, file_path, status, created_at')
    .eq('onboarding_application_id', application.id).order('created_at', { ascending: false });
  if (error) return json(503, { error: 'Your documents could not be loaded.' });
  const entries = (documents ?? []) as unknown as Array<Record<string, unknown>>;
  const previewId = new URL(request.url).searchParams.get('id');
  if (previewId) {
    const document = entries.find(entry => entry.id === previewId);
    if (!document) return json(404, { error: 'Document not found in your application.' });
    const filePath = typeof document.file_path === 'string' ? document.file_path.trim() : '';
    if (!filePath) return json(409, { error: 'No file has been uploaded for this document.' });
    // Applicant uploads use private object paths, never arbitrary external URLs.
    if (!filePath.startsWith(auth.user.id + '/' + application.id + '/') || filePath.includes('..')) {
      return json(409, { error: 'This legacy file needs a secure preview from Platform Compliance.' });
    }
    const { data: signed, error: signError } = await supabaseAdmin.storage.from('onboarding-documents').createSignedUrl(filePath, 300);
    if (signError || !signed?.signedUrl) return json(503, { error: 'A secure document preview could not be created.' });
    return json(200, { url: signed.signedUrl, expiresInSeconds: 300 });
  }
  return json(200, { application, documents: entries.map(entry => ({
    id: entry.id, docType: entry.doc_type,
    status: entry.verification_status ?? entry.status,
    hasFile: typeof entry.file_path === 'string' && entry.file_path.trim().length > 0,
    uploadedAt: entry.created_at,
  })) });
}
