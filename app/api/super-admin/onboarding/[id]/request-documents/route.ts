import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { verifyPlatformOwner, isSuperAdminDeployPreviewReadOnly } from '../../../_lib/verifyPlatformOwner';

const bodySchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  reminder: z.boolean().optional().default(false),
});

const json = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type MissingDocumentRow = {
  doc_type?: string | null;
  required_doc_type?: string | null;
  document_type?: string | null;
};

const docName = (row: MissingDocumentRow) =>
  String(row.doc_type ?? row.required_doc_type ?? row.document_type ?? '').trim();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const owner = await verifyPlatformOwner(request);
  if (!owner || !supabaseAdmin) return json(403, { error: 'Forbidden: Platform Owner authority required.' });

  const { id: applicationId } = await context.params;
  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, company_id, completion_percentage, current_step')
    .eq('id', applicationId)
    .maybeSingle();

  if (applicationError) return json(500, { error: applicationError.message });
  if (!application) return json(404, { error: 'Onboarding application not found.' });

  const { data: missingRows, error: missingError } = await supabaseAdmin.rpc(
    'get_missing_onboarding_documents',
    { p_application_id: applicationId },
  );
  if (missingError) {
    return json(503, {
      error: 'Canonical onboarding document preflight is unavailable.',
      diagnostic: missingError.message,
    });
  }

  const missingDocuments = ((missingRows ?? []) as MissingDocumentRow[])
    .map(docName)
    .filter(Boolean);

  let outstandingRequest: Record<string, unknown> | null = null;
  const { data: requestRows, error: requestError } = await supabaseAdmin
    .from('platform_document_requests')
    .select('id, status, requested_documents, reason, requested_at, last_sent_at, reminder_count, recipient_email, resolved_at')
    .eq('onboarding_application_id', applicationId)
    .order('requested_at', { ascending: false })
    .limit(1);

  // Migration may intentionally be absent in Production while this PR is preview-only.
  if (!requestError) outstandingRequest = requestRows?.[0] ?? null;

  return json(200, {
    available: true,
    previewReadOnly: isSuperAdminDeployPreviewReadOnly(),
    application: {
      id: application.id,
      userId: application.user_id,
      recipientEmail: application.email,
      accountType: application.account_type,
      status: application.status,
      companyId: application.company_id,
      completionPercentage: application.completion_percentage,
      currentStep: application.current_step,
    },
    missingDocuments,
    missingCount: missingDocuments.length,
    canRequest: missingDocuments.length > 0 && Boolean(application.user_id && application.email),
    primaryChannel: 'email',
    supplementalChannels: ['in_app', 'push_if_available'],
    continuationPath: '/onboarding/resume',
    outstandingRequest,
    requestRegistryAvailable: !requestError,
    requestRegistryNote: requestError ? 'Document request registry migration is not applied in this environment.' : null,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const owner = await verifyPlatformOwner(request);
  if (!owner || !supabaseAdmin) {
    return json(403, {
      error: isSuperAdminDeployPreviewReadOnly()
        ? 'Deploy Preview is read-only. Document requests cannot be sent from this environment.'
        : 'Forbidden: Platform Owner authority required.',
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'A clear request reason is required.' });

  const { id: applicationId } = await context.params;
  const { data, error } = await supabaseAdmin.rpc('owner_request_onboarding_documents', {
    p_actor_user_id: owner.id,
    p_application_id: applicationId,
    p_reason: parsed.data.reason,
    p_is_reminder: parsed.data.reminder,
  });

  if (error) {
    const migrationMissing = error.code === 'PGRST202' || /owner_request_onboarding_documents/i.test(error.message);
    return json(migrationMissing ? 503 : 409, {
      error: migrationMissing
        ? 'Document request workflow migration is not applied in this environment.'
        : error.message,
      migrationRequired: migrationMissing,
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return json(200, {
    ok: true,
    request: row ?? null,
    primaryChannel: 'email',
    continuationPath: '/onboarding/resume',
    message: parsed.data.reminder ? 'Document reminder queued.' : 'Document request queued.',
  });
}
