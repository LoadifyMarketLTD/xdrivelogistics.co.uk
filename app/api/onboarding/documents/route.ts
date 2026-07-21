import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { FLEET_DOCUMENT_TYPES, OWNER_DRIVER_DOCUMENT_TYPES } from '../../_lib/onboarding';

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

type OnboardingApplication = {
  id: string;
  user_id: string;
  email: string | null;
  account_type: string;
  company_id: string | null;
  payload: Record<string, unknown> | null;
};

const textPayloadValue = (payload: Record<string, unknown> | null, key: string) => {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const ensureFleetCompanyId = async (app: OnboardingApplication): Promise<{ companyId: string | null; error: string | null }> => {
  if (!supabaseAdmin) return { companyId: null, error: 'Server auth is not configured.' };
  if (app.company_id) return { companyId: app.company_id, error: null };

  const { data: existingCompany, error: existingCompanyError } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('created_by', app.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCompanyError) return { companyId: null, error: existingCompanyError.message };

  let companyId = existingCompany?.id ?? null;
  if (!companyId) {
    const email = app.email ?? 'unknown@xdrive.local';
    const companyName =
      textPayloadValue(app.payload, 'legal_company_name') ??
      textPayloadValue(app.payload, 'company_name') ??
      textPayloadValue(app.payload, 'trading_name') ??
      `${email.split('@')[0]} fleet`;

    const { data: createdCompany, error: createCompanyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        email,
        company_number: textPayloadValue(app.payload, 'company_number'),
        vat_number: textPayloadValue(app.payload, 'vat_number'),
        address_line1:
          textPayloadValue(app.payload, 'registered_address') ??
          textPayloadValue(app.payload, 'trading_address'),
        status: 'pending_approval',
        company_type: 'carrier',
        created_by: app.user_id,
      })
      .select('id')
      .single();

    if (createCompanyError || !createdCompany?.id) {
      return { companyId: null, error: createCompanyError?.message ?? 'Unable to create the pending fleet company.' };
    }
    companyId = createdCompany.id;
  }

  const { error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .upsert({
      company_id: companyId,
      user_id: app.user_id,
      role_in_company: 'owner',
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,user_id' });
  if (membershipError) return { companyId: null, error: membershipError.message };

  const [{ error: appUpdateError }, { error: profileUpdateError }] = await Promise.all([
    supabaseAdmin
      .from('onboarding_applications')
      .update({ company_id: companyId, updated_at: new Date().toISOString() })
      .eq('id', app.id)
      .eq('user_id', app.user_id),
    supabaseAdmin
      .from('profiles')
      .update({ company_id: companyId, updated_at: new Date().toISOString() })
      .eq('user_id', app.user_id),
  ]);

  if (appUpdateError) return { companyId: null, error: appUpdateError.message };
  if (profileUpdateError) return { companyId: null, error: profileUpdateError.message };
  return { companyId, error: null };
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

  const { data: appData, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, company_id, payload')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!appData) return json(404, { error: 'Onboarding application not found.' });

  const app = appData as OnboardingApplication;
  const parsedFleetDocType = app.account_type === 'fleet_courier' ? fleetDocTypeSchema.safeParse(docType) : null;
  const parsedOwnerDriverDocType = app.account_type === 'owner_driver' ? ownerDriverDocTypeSchema.safeParse(docType) : null;

  if (app.account_type === 'fleet_courier' && !parsedFleetDocType?.success) {
    return json(400, { error: 'Invalid fleet document type.' });
  }
  if (app.account_type === 'owner_driver' && !parsedOwnerDriverDocType?.success) {
    return json(400, { error: 'Invalid owner driver document type.' });
  }
  if (app.account_type !== 'fleet_courier' && app.account_type !== 'owner_driver') {
    return json(400, { error: 'Document uploads are not supported for this onboarding account type.' });
  }

  let fleetCompanyId: string | null = null;
  if (app.account_type === 'fleet_courier') {
    const ensured = await ensureFleetCompanyId(app);
    if (ensured.error || !ensured.companyId) {
      return json(409, { error: ensured.error ?? 'Unable to prepare the fleet company workspace.' });
    }
    fleetCompanyId = ensured.companyId;
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
    .upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return json(500, { error: uploadError.message });

  if (app.account_type === 'fleet_courier') {
    const parsedDocType = parsedFleetDocType!;
    const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
      .from('company_documents')
      .select('id')
      .eq('onboarding_application_id', app.id)
      .eq('doc_type', parsedDocType.data)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDocumentError) {
      await cleanupUploadedObject();
      return json(500, { error: existingDocumentError.message });
    }

    const documentMutation = existingDocument?.id
      ? supabaseAdmin.from('company_documents').update({
          company_id: fleetCompanyId,
          file_path: objectPath,
          status: 'pending',
        }).eq('id', existingDocument.id)
      : supabaseAdmin.from('company_documents').insert({
          company_id: fleetCompanyId,
          onboarding_application_id: app.id,
          doc_type: parsedDocType.data,
          file_path: objectPath,
          status: 'pending',
        });

    const { error: documentError } = await documentMutation;
    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }
  } else {
    const parsedDocType = parsedOwnerDriverDocType!;
    const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('id')
      .eq('onboarding_application_id', app.id)
      .eq('doc_type', parsedDocType.data)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDocumentError) {
      await cleanupUploadedObject();
      return json(500, { error: existingDocumentError.message });
    }

    const documentMutation = existingDocument?.id
      ? supabaseAdmin.from('driver_identity_documents').update({
          file_path: objectPath,
          upload_status: 'uploaded',
          verification_status: 'unverified',
        }).eq('id', existingDocument.id)
      : supabaseAdmin.from('driver_identity_documents').insert({
          onboarding_application_id: app.id,
          doc_type: parsedDocType.data,
          file_path: objectPath,
          upload_status: 'uploaded',
          verification_status: 'unverified',
        });

    const { error: documentError } = await documentMutation;
    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }
  }

  const nextPayload = {
    ...(app.payload ?? {}),
    [`doc_${docType}`]: objectPath,
  };
  const { data: latestApp, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      company_id: fleetCompanyId ?? app.company_id,
      payload: nextPayload,
      status: 'in_progress',
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)
    .eq('user_id', authData.user.id)
    .select('payload, company_id')
    .single();

  if (updateError) {
    await cleanupUploadedObject();
    return json(500, { error: updateError.message });
  }

  return json(200, {
    path: objectPath,
    docType,
    accountType: app.account_type,
    companyId: latestApp.company_id ?? null,
    payload: latestApp.payload ?? null,
  });
}
