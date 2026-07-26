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
    .select('id, user_id, account_type')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!app) return json(404, { error: 'Onboarding application not found.' });

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

  if (uploadError) {
    return json(500, { error: uploadError.message });
  }

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

    const { error: documentError } = await supabaseAdmin.from('company_documents').insert({
      company_id: company.id,
      onboarding_application_id: app.id,
      doc_type: parsedDocType.data,
      file_path: objectPath,
      status: 'pending',
    });

    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }
  } else if (accountType === 'owner_driver') {
    const parsedDocType = parsedOwnerDriverDocType!;

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

    const { error: documentError } = await supabaseAdmin.from('company_documents').insert({
      company_id: company.id,
      onboarding_application_id: app.id,
      doc_type: parsedDocType.data,
      file_path: objectPath,
      status: 'pending',
    });

    if (documentError) {
      await cleanupUploadedObject();
      return json(500, { error: documentError.message });
    }
  } else if (accountType === 'individual_driver') {
    const parsedDocType = parsedIndividualDriverDocType!;

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

  const { data: latestApp, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      status: 'in_progress',
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', app.id)
    .select('payload')
    .single();

  if (updateError) {
    await cleanupUploadedObject();
    return json(500, { error: updateError.message });
  }

  return json(200, {
    path: objectPath,
    docType,
    accountType,
    payload: latestApp?.payload ?? null,
  });
}
