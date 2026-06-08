import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

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
  const model = String(formData.get('model') ?? 'onboarding').trim();

  if (!(file instanceof File)) {
    return json(400, { error: 'No file uploaded.' });
  }

  if (!docType) {
    return json(400, { error: 'Document type is required.' });
  }

  const { data: app, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!app) return json(404, { error: 'Onboarding application not found.' });

  const ext = path.extname(file.name || '').toLowerCase();
  const fileName = sanitizeFilename(`${Date.now()}-${docType}${ext}`);
  const objectPath = `${authData.user.id}/${app.id}/${fileName}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .upload(objectPath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return json(500, { error: uploadError.message });
  }

  if (model === 'company') {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('created_by', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (company?.id) {
      await supabaseAdmin.from('company_documents').insert({
        company_id: company.id,
        onboarding_application_id: app.id,
        doc_type: docType,
        file_path: objectPath,
        status: 'pending',
      });
    }
  } else if (model === 'driver_identity') {
    await supabaseAdmin.from('driver_identity_documents').insert({
      onboarding_application_id: app.id,
      doc_type: docType,
      file_path: objectPath,
      upload_status: 'uploaded',
      verification_status: 'unverified',
    });
  }

  const { data: latestApp } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      status: 'in_progress',
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', app.id)
    .select('payload')
    .single();

  return json(200, {
    path: objectPath,
    docType,
    model,
    payload: latestApp?.payload ?? null,
  });
}
