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

type ApplicationRow = {
  id: string;
  status: string | null;
  account_type: string | null;
  current_step: string | null;
  completion_percentage: number | null;
};

const documentName = (row: MissingDocumentRow) =>
  String(row.doc_type ?? row.required_doc_type ?? row.document_type ?? '').trim();

async function authenticatedApplication(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Onboarding service is unavailable.' }) } as const;
  }

  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized.' }) } as const;

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return { error: json(401, { error: 'Unauthorized.' }) } as const;

  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, current_step, completion_percentage')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (applicationError) return { error: json(500, { error: applicationError.message }) } as const;
  return { application: (application ?? null) as ApplicationRow | null } as const;
}

async function canonicalMissingDocuments(applicationId: string) {
  if (!supabaseAdmin) return { missingDocuments: [], error: 'Onboarding service is unavailable.' };

  const { data: rows, error } = await supabaseAdmin.rpc('get_missing_onboarding_documents', {
    p_application_id: applicationId,
  });

  if (error) return { missingDocuments: [], error: 'Required document checklist is temporarily unavailable.' };

  return {
    missingDocuments: ((rows ?? []) as MissingDocumentRow[]).map(documentName).filter(Boolean),
    error: null,
  };
}

export async function GET(request: NextRequest) {
  const authenticated = await authenticatedApplication(request);
  if ('error' in authenticated) return authenticated.error;

  const application = authenticated.application;
  if (!application) {
    return json(200, {
      available: true,
      previewReadOnly: isDeployPreviewReadOnly(),
      application: null,
      missingDocuments: [],
      missingCount: 0,
      complete: true,
    });
  }

  const checklist = await canonicalMissingDocuments(application.id);
  if (checklist.error) return json(503, { error: checklist.error });

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
    missingDocuments: checklist.missingDocuments,
    missingCount: checklist.missingDocuments.length,
    complete: checklist.missingDocuments.length === 0,
  });
}

export async function POST(request: NextRequest) {
  if (isDeployPreviewReadOnly()) {
    return json(403, { error: 'Deploy Preview is read-only. Checklist resolution is disabled.' });
  }

  const authenticated = await authenticatedApplication(request);
  if ('error' in authenticated) return authenticated.error;

  const application = authenticated.application;
  if (!application) return json(200, { ok: true, resolved: 0, complete: true });

  const checklist = await canonicalMissingDocuments(application.id);
  if (checklist.error) return json(503, { error: checklist.error });
  if (checklist.missingDocuments.length > 0) {
    return json(409, {
      error: 'Required onboarding documents are still outstanding.',
      complete: false,
      missingDocuments: checklist.missingDocuments,
    });
  }

  if (!supabaseAdmin) return json(503, { error: 'Onboarding service is unavailable.' });
  const { data, error } = await supabaseAdmin.rpc('resolve_completed_document_requests', {
    p_application_id: application.id,
  });
  if (error) return json(503, { error: 'Document request resolution is temporarily unavailable.' });

  return json(200, { ok: true, resolved: Number(data ?? 0), complete: true });
}
