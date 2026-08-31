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

const documentName = (row: MissingDocumentRow) =>
  String(row.doc_type ?? row.required_doc_type ?? row.document_type ?? '').trim();

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
  if (!application) return json(200, { available: true, application: null, missingDocuments: [], missingCount: 0 });

  const { data: rows, error: missingError } = await supabaseAdmin.rpc('get_missing_onboarding_documents', {
    p_application_id: application.id,
  });
  if (missingError) return json(503, { error: 'Required document checklist is temporarily unavailable.' });

  const missingDocuments = ((rows ?? []) as MissingDocumentRow[]).map(documentName).filter(Boolean);

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
  });
}
