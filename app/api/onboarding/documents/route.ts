import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  BROKER_DOCUMENT_TYPES,
  FLEET_DOCUMENT_TYPES,
  OWNER_DRIVER_DOCUMENT_TYPES,
  normalizeOnboardingStatus,
} from '../../_lib/onboarding';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const EDITABLE_STATUSES = new Set(['invited', 'draft', 'in_progress', 'request_changes']);

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const brokerDocTypeSchema = z.enum(BROKER_DOCUMENT_TYPES);
const fleetDocTypeSchema = z.enum(FLEET_DOCUMENT_TYPES);
const ownerDriverDocTypeSchema = z.enum(OWNER_DRIVER_DOCUMENT_TYPES);

const companyDetailsFromApplication = (app: {
  email: string | null;
  account_type: string;
  payload: Record<string, unknown> | null;
}) => {
  const payload = app.payload ?? {};
  const text = (key: string) => typeof payload[key] === 'string' ? String(payload[key]).trim() : '';
  const name = text('company_name') || text('legal_company_name') || text('trading_name') || 'Pending onboarding company';
  return {
    name,
    email: text('contact_email') || app.email || null,
    phone: text('contact_phone') || null,
    address_line1: text('registered_address') || text('billing_address') || text('trading_address') || null,
    company_number: text('company_number') || null,
    vat_number: text('vat_number') || null,
    company_type: app.account_type === 'broker_shipper' ? 'broker' : 'carrier',
  };
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const bearer = getBearerToken(request);
  if (!bearer) return json(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(bearer);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized: invalid token.' });

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
    .select('id, user_id, email, account_type, status, company_id, payload')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!app) return json(404, { error: 'Onboarding application not found.' });

  const lifecycleStatus = normalizeOnboardingStatus(app.status);
  if (!EDITABLE_STATUSES.has(lifecycleStatus)) {
    return json(409, { error: `Documents cannot be changed while onboarding is ${lifecycleStatus}.` });
  }

  const accountType = String(app.account_type);
  const parsedBrokerDocType = accountType === 'broker_shipper' ? brokerDocTypeSchema.safeParse(docType) : null;
  const parsedFleetDocType = accountType === 'fleet_courier' ? fleetDocTypeSchema.safeParse(docType) : null;
  const parsedOwnerDriverDocType = accountType === 'owner_driver' ? ownerDriverDocTypeSchema.safeParse(docType) : null;

  if (accountType === 'broker_shipper' && !parsedBrokerDocType?.success) {
    return json(400, { error: 'Invalid broker document type.' });
  }
  if (accountType === 'fleet_courier' && !parsedFleetDocType?.success) {
    return json(400, { error: 'Invalid fleet document type.' });
  }
  if (accountType === 'owner_driver' && !parsedOwnerDriverDocType?.success) {
    return json(400, { error: 'Invalid owner driver document type.' });
  }
  if (!['broker_shipper', 'fleet_courier', 'owner_driver'].includes(accountType)) {
    return json(400, { error: 'Document uploads are not supported for this onboarding account type.' });
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

  let companyId = typeof app.company_id === 'string' ? app.company_id : null;

  if (accountType === 'broker_shipper' || accountType === 'fleet_courier') {
    if (!companyId) {
      const { data: existingCompany, error: existingCompanyError } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('created_by', authData.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingCompanyError) {
        await cleanupUploadedObject();
        return json(500, { error: existingCompanyError.message });
      }
      companyId = existingCompany?.id ?? null;
    }

    if (!companyId) {
      const details = companyDetailsFromApplication(app);
      const { data: createdCompany, error: companyCreateError } = await supabaseAdmin
        .from('companies')
        .insert({
          ...details,
          status: 'pending_approval',
          created_by: authData.user.id,
        })
        .select('id')
        .single();
      if (companyCreateError || !createdCompany?.id) {
        await cleanupUploadedObject();
        return json(500, { error: companyCreateError?.message ?? 'Unable to create pending company workspace.' });
      }
      companyId = createdCompany.id;
    }

    const { data: membership, error: membershipReadError } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (membershipReadError) {
      await cleanupUploadedObject();
      return json(500, { error: membershipReadError.message });
    }
    if (!membership) {
      const { error: membershipInsertError } = await supabaseAdmin.from('company_memberships').insert({
        company_id: companyId,
        user_id: authData.user.id,
        invited_email: authData.user.email ?? app.email,
        role_in_company: 'owner',
        status: 'invited',
        updated_at: new Date().toISOString(),
      });
      if (membershipInsertError) {
        await cleanupUploadedObject();
        return json(500, { error: membershipInsertError.message });
      }
    }

    const { data: existingDocument, error: documentReadError } = await supabaseAdmin
      .from('company_documents')
      .select('id, file_path')
      .eq('onboarding_application_id', app.id)
      .eq('doc_type', docType)
      .maybeSingle();
    if (documentReadError) {
      await cleanupUploadedObject();
      return json(500, { error: documentReadError.message });
    }

    const documentWrite = existingDocument
      ? supabaseAdmin.from('company_documents').update({
          company_id: companyId,
          file_path: objectPath,
          status: 'pending',
        }).eq('id', existingDocument.id)
      : supabaseAdmin.from('company_documents').insert({
          company_id: companyId,
          onboarding_application_id: app.id,
          doc_type: docType,
          file_path: objectPath,
          status: 'pending',
        });

    const { error: documentError } = await documentWrite;
    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }
    if (existingDocument?.file_path) {
      await supabaseAdmin.storage.from('onboarding-documents').remove([existingDocument.file_path]);
    }
  } else {
    const { data: existingDocument, error: documentReadError } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('id, file_path')
      .eq('onboarding_application_id', app.id)
      .eq('doc_type', docType)
      .maybeSingle();
    if (documentReadError) {
      await cleanupUploadedObject();
      return json(500, { error: documentReadError.message });
    }

    const documentWrite = existingDocument
      ? supabaseAdmin.from('driver_identity_documents').update({
          file_path: objectPath,
          upload_status: 'uploaded',
          verification_status: 'unverified',
        }).eq('id', existingDocument.id)
      : supabaseAdmin.from('driver_identity_documents').insert({
          onboarding_application_id: app.id,
          doc_type: parsedOwnerDriverDocType!.data,
          file_path: objectPath,
          upload_status: 'uploaded',
          verification_status: 'unverified',
        });

    const { error: documentError } = await documentWrite;
    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }
    if (existingDocument?.file_path) {
      await supabaseAdmin.storage.from('onboarding-documents').remove([existingDocument.file_path]);
    }
  }

  const payload = {
    ...((app.payload ?? {}) as Record<string, unknown>),
    [`doc_${docType}`]: objectPath,
  };
  const { error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      company_id: companyId,
      status: 'in_progress',
      payload,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', app.id);

  if (updateError) {
    await cleanupUploadedObject();
    return json(500, { error: updateError.message });
  }

  return json(200, { path: objectPath, docType, accountType, companyId, payload });
}
