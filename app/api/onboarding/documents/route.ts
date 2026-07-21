import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { BROKER_DOCUMENT_TYPES, FLEET_DOCUMENT_TYPES, OWNER_DRIVER_DOCUMENT_TYPES } from '../../_lib/onboarding';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const EDITABLE_STATUSES = new Set(['draft', 'in_progress', 'request_changes']);

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const fleetDocTypeSchema = z.enum(FLEET_DOCUMENT_TYPES);
const brokerDocTypeSchema = z.enum(BROKER_DOCUMENT_TYPES);
const ownerDriverDocTypeSchema = z.enum(OWNER_DRIVER_DOCUMENT_TYPES);

const readPayloadText = (payload: Record<string, unknown> | null | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
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

  if (!(file instanceof File)) return json(400, { error: 'No file uploaded.' });
  if (!docType) return json(400, { error: 'Document type is required.' });
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return json(413, { error: 'Document must be between 1 byte and 10MB.' });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return json(415, { error: 'Only PDF, JPG, PNG, or WebP documents are allowed.' });
  }

  const { data: app, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, payload, company_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!app) return json(404, { error: 'Onboarding application not found.' });
  if (!EDITABLE_STATUSES.has(String(app.status ?? '').toLowerCase())) {
    return json(409, {
      error: 'Documents can only be changed while onboarding is draft, in progress, or returned for changes.',
    });
  }

  const accountType = String(app.account_type ?? '');
  const parsedFleetDocType = accountType === 'fleet_courier' ? fleetDocTypeSchema.safeParse(docType) : null;
  const parsedBrokerDocType = accountType === 'broker_shipper' ? brokerDocTypeSchema.safeParse(docType) : null;
  const parsedOwnerDriverDocType = accountType === 'owner_driver' ? ownerDriverDocTypeSchema.safeParse(docType) : null;

  if (accountType === 'fleet_courier' && !parsedFleetDocType?.success) {
    return json(400, { error: 'Invalid fleet document type.' });
  }
  if (accountType === 'broker_shipper' && !parsedBrokerDocType?.success) {
    return json(400, { error: 'Invalid broker document type.' });
  }
  if (accountType === 'owner_driver' && !parsedOwnerDriverDocType?.success) {
    return json(400, { error: 'Invalid owner driver document type.' });
  }
  if (!['fleet_courier', 'broker_shipper', 'owner_driver'].includes(accountType)) {
    return json(400, { error: 'Document uploads are not supported for this onboarding account type.' });
  }

  let companyId = typeof app.company_id === 'string' ? app.company_id : null;
  if (accountType === 'fleet_courier' || accountType === 'broker_shipper') {
    if (!companyId) {
      const { data: existingCompany, error: existingCompanyError } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('created_by', authData.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCompanyError) return json(500, { error: existingCompanyError.message });
      companyId = existingCompany?.id ?? null;
    }

    if (!companyId) {
      const payload = (app.payload ?? {}) as Record<string, unknown>;
      const companyName = readPayloadText(payload, 'legal_company_name', 'company_name', 'trading_name')
        ?? `${String(app.email ?? authData.user.email ?? 'XDrive applicant').split('@')[0]} workspace`;
      const companyEmail = readPayloadText(payload, 'contact_email', 'email') ?? app.email ?? authData.user.email ?? null;
      const companyPhone = readPayloadText(payload, 'contact_phone', 'phone');
      const companyAddress = readPayloadText(payload, 'registered_address', 'billing_address', 'trading_address');

      const { data: createdCompany, error: createCompanyError } = await supabaseAdmin
        .from('companies')
        .insert({
          name: companyName,
          email: companyEmail,
          phone: companyPhone,
          address_line1: companyAddress,
          company_number: readPayloadText(payload, 'company_number'),
          vat_number: readPayloadText(payload, 'vat_number'),
          status: 'pending_approval',
          company_type: accountType === 'broker_shipper' ? 'broker' : 'carrier',
          created_by: authData.user.id,
        })
        .select('id')
        .single();

      if (createCompanyError || !createdCompany?.id) {
        return json(500, { error: createCompanyError?.message ?? 'Unable to create the pending company workspace.' });
      }
      companyId = createdCompany.id;
    }

    const { error: linkCompanyError } = await supabaseAdmin
      .from('onboarding_applications')
      .update({ company_id: companyId, last_activity_at: new Date().toISOString() })
      .eq('id', app.id)
      .eq('user_id', authData.user.id);

    if (linkCompanyError) return json(500, { error: linkCompanyError.message });
  }

  const ext = path.extname(file.name || '').toLowerCase();
  const fileName = sanitizeFilename(`${Date.now()}-${docType}${ext}`);
  const objectPath = `${authData.user.id}/${app.id}/${fileName}`;

  const cleanupUploadedObject = async () => {
    const { error } = await supabaseAdmin!.storage.from('onboarding-documents').remove([objectPath]);
    if (error) console.error('[onboarding-documents] cleanup failed', { objectPath, error: error.message });
  };

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) return json(500, { error: uploadError.message });

  let replacedPath: string | null = null;

  if (accountType === 'fleet_courier' || accountType === 'broker_shipper') {
    const parsedDocType = accountType === 'fleet_courier' ? parsedFleetDocType! : parsedBrokerDocType!;
    const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
      .from('company_documents')
      .select('id, file_path')
      .eq('onboarding_application_id', app.id)
      .eq('doc_type', parsedDocType.data)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDocumentError) {
      await cleanupUploadedObject();
      return json(500, { error: existingDocumentError.message });
    }

    if (existingDocument?.id) {
      replacedPath = existingDocument.file_path ?? null;
      const { error: updateDocumentError } = await supabaseAdmin
        .from('company_documents')
        .update({
          company_id: companyId,
          file_path: objectPath,
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
        })
        .eq('id', existingDocument.id)
        .eq('onboarding_application_id', app.id);

      if (updateDocumentError) {
        await cleanupUploadedObject();
        return json(500, { error: updateDocumentError.message });
      }
    } else {
      const { error: documentError } = await supabaseAdmin.from('company_documents').insert({
        company_id: companyId,
        onboarding_application_id: app.id,
        doc_type: parsedDocType.data,
        file_path: objectPath,
        status: 'pending',
      });
      if (documentError) {
        await cleanupUploadedObject();
        return json(500, { error: documentError.message });
      }
    }
  } else {
    const parsedDocType = parsedOwnerDriverDocType!;
    const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('id, file_path')
      .eq('onboarding_application_id', app.id)
      .eq('doc_type', parsedDocType.data)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDocumentError) {
      await cleanupUploadedObject();
      return json(500, { error: existingDocumentError.message });
    }

    if (existingDocument?.id) {
      replacedPath = existingDocument.file_path ?? null;
      const { error: updateDocumentError } = await supabaseAdmin
        .from('driver_identity_documents')
        .update({
          file_path: objectPath,
          upload_status: 'uploaded',
          verification_status: 'unverified',
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
        })
        .eq('id', existingDocument.id)
        .eq('onboarding_application_id', app.id);

      if (updateDocumentError) {
        await cleanupUploadedObject();
        return json(500, { error: updateDocumentError.message });
      }
    } else {
      const { error: documentError } = await supabaseAdmin.from('driver_identity_documents').insert({
        onboarding_application_id: app.id,
        doc_type: parsedDocType.data,
        file_path: objectPath,
        upload_status: 'uploaded',
        verification_status: 'unverified',
      });
      if (documentError) {
        await cleanupUploadedObject();
        return json(500, { error: documentError.message });
      }
    }
  }

  if (replacedPath && replacedPath !== objectPath) {
    const { error: removeOldError } = await supabaseAdmin.storage.from('onboarding-documents').remove([replacedPath]);
    if (removeOldError) {
      console.error('[onboarding-documents] unable to remove replaced object', {
        replacedPath,
        error: removeOldError.message,
      });
    }
  }

  const { data: latestApp, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({ status: 'in_progress', last_activity_at: new Date().toISOString() })
    .eq('id', app.id)
    .eq('user_id', authData.user.id)
    .select('payload')
    .single();

  if (updateError) {
    console.error('[onboarding-documents] document saved but onboarding activity update failed', {
      applicationId: app.id,
      error: updateError.message,
    });
  }

  return json(200, {
    path: objectPath,
    docType,
    accountType,
    companyId,
    replacedExistingDocument: Boolean(replacedPath),
    payload: latestApp?.payload ?? app.payload ?? null,
  });
}
