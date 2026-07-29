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

export const runtime = 'nodejs';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

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

type StoredDocument = {
  id: string;
  family: 'company' | 'identity';
  table: 'company_documents' | 'driver_identity_documents';
  companyId: string | null;
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

  const { data: app, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, account_type, company_id, risk_status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!app) return json(404, { error: 'Onboarding application not found.' });
  if (app.risk_status === 'confirmed_fraud') {
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

    const { data: reviewCase, error: caseError } = await supabaseAdmin
      .from('fraud_review_cases')
      .insert({
        subject_user_id: authData.user.id,
        subject_company_id: app.company_id ?? null,
        onboarding_application_id: app.id,
        matched_user_id: duplicateFingerprint.user_id ?? null,
        matched_company_id: duplicateFingerprint.company_id ?? null,
        case_type: 'duplicate_file',
        severity: 'critical',
        status: 'open',
        automatic_hold: true,
        evidence: {
          file_sha256: fileSha256,
          attempted_doc_type: docType,
          matched_fingerprint_id: duplicateFingerprint.id,
          matched_document_family: duplicateFingerprint.document_family,
          matched_document_id: duplicateFingerprint.document_id,
        },
      })
      .select('id')
      .single();

    if (caseError) {
      return json(500, { error: caseError.message });
    }

    const { error: holdError } = await supabaseAdmin
      .from('onboarding_applications')
      .update({
        risk_status: 'on_hold',
        risk_reason: 'Exact document file already exists on another platform identity.',
        risk_updated_at: new Date().toISOString(),
      })
      .eq('id', app.id);

    if (holdError) {
      return json(500, { error: holdError.message });
    }

    return json(409, {
      error: 'A duplicate document was detected. The application is on hold for Platform Owner review.',
      code: 'duplicate_document_detected',
      reviewCaseId: reviewCase.id,
    });
  }

  const ext = path.extname(file.name || '').toLowerCase();
  const fileName = sanitizeFilename(`${Date.now()}-${docType}${ext}`);
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

  let storedDocument: StoredDocument | null = null;

  if (accountType === 'fleet_courier') {
    const parsedDocType = parsedFleetDocType!;
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('created_by', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companyError || !company?.id) {
      await cleanupUploadedObject();
      return json(409, { error: companyError?.message ?? 'Company workspace must exist before uploading fleet documents.' });
    }

    const { data: document, error: documentError } = await supabaseAdmin
      .from('company_documents')
      .insert({
        company_id: company.id,
        onboarding_application_id: app.id,
        doc_type: parsedDocType.data,
        file_path: objectPath,
        file_sha256: fileSha256,
        status: 'pending',
      })
      .select('id')
      .single();

    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }

    storedDocument = {
      id: document.id,
      family: 'company',
      table: 'company_documents',
      companyId: company.id,
    };
  } else if (accountType === 'owner_driver') {
    const parsedDocType = parsedOwnerDriverDocType!;

    const { data: document, error: documentError } = await supabaseAdmin
      .from('driver_identity_documents')
      .insert({
        onboarding_application_id: app.id,
        doc_type: parsedDocType.data,
        file_path: objectPath,
        file_sha256: fileSha256,
        upload_status: 'uploaded',
        verification_status: 'unverified',
      })
      .select('id')
      .single();

    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }

    storedDocument = {
      id: document.id,
      family: 'identity',
      table: 'driver_identity_documents',
      companyId: app.company_id ?? null,
    };
  } else if (accountType === 'broker_shipper') {
    const parsedDocType = parsedBrokerDocType!;
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('created_by', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companyError || !company?.id) {
      await cleanupUploadedObject();
      return json(409, { error: companyError?.message ?? 'Company workspace must exist before uploading broker documents.' });
    }

    const { data: document, error: documentError } = await supabaseAdmin
      .from('company_documents')
      .insert({
        company_id: company.id,
        onboarding_application_id: app.id,
        doc_type: parsedDocType.data,
        file_path: objectPath,
        file_sha256: fileSha256,
        status: 'pending',
      })
      .select('id')
      .single();

    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }

    storedDocument = {
      id: document.id,
      family: 'company',
      table: 'company_documents',
      companyId: company.id,
    };
  } else if (accountType === 'individual_driver') {
    const parsedDocType = parsedIndividualDriverDocType!;

    const { data: document, error: documentError } = await supabaseAdmin
      .from('driver_identity_documents')
      .insert({
        onboarding_application_id: app.id,
        doc_type: parsedDocType.data,
        file_path: objectPath,
        file_sha256: fileSha256,
        upload_status: 'uploaded',
        verification_status: 'unverified',
      })
      .select('id')
      .single();

    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }

    storedDocument = {
      id: document.id,
      family: 'identity',
      table: 'driver_identity_documents',
      companyId: app.company_id ?? null,
    };
  }

  if (!storedDocument) {
    await cleanupUploadedObject();
    return json(500, { error: 'Document record was not created.' });
  }

  const { error: fingerprintError } = await supabaseAdmin
    .from('document_fingerprints')
    .insert({
      document_family: storedDocument.family,
      document_id: storedDocument.id,
      onboarding_application_id: app.id,
      user_id: authData.user.id,
      company_id: storedDocument.companyId,
      file_sha256: fileSha256,
    });

  if (fingerprintError) {
    await supabaseAdmin.from(storedDocument.table).delete().eq('id', storedDocument.id);
    await cleanupUploadedObject();
    return json(500, { error: fingerprintError.message });
  }

  const { data: latestApp, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      status: 'in_progress',
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', app.id)
    .select('payload, risk_status')
    .single();

  if (updateError) {
    await supabaseAdmin.from('document_fingerprints').delete().eq('document_id', storedDocument.id);
    await supabaseAdmin.from(storedDocument.table).delete().eq('id', storedDocument.id);
    await cleanupUploadedObject();
    return json(500, { error: updateError.message });
  }

  return json(200, {
    path: objectPath,
    docType,
    accountType,
    documentId: storedDocument.id,
    fileSha256,
    riskStatus: latestApp?.risk_status ?? 'clear',
    payload: latestApp?.payload ?? null,
  });
}
