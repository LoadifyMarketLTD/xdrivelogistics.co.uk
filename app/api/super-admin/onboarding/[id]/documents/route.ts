import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';
import { getOnboardingComplianceReadiness } from '../../../../../../lib/server/onboardingCompliance';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const reviewSchema = z.object({
  kind: z.enum(['company', 'driver']),
  documentId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().trim().max(2000).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'owner') return null;
  return authData.user;
};

const signedDocumentUrl = async (filePath: string | null) => {
  if (!filePath || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .createSignedUrl(filePath, 10 * 60);
  if (error) return null;
  return data.signedUrl;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { id } = await params;
  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, company_id, current_step, completion_percentage, submitted_at, reviewed_at, review_notes, payload')
    .eq('id', id)
    .maybeSingle();

  if (applicationError) return respond(500, { error: applicationError.message });
  if (!application) return respond(404, { error: 'Onboarding application not found.' });

  const { data: readiness, error: readinessError } = await getOnboardingComplianceReadiness(supabaseAdmin, {
    applicationId: id,
  });
  if (readinessError) return respond(500, { error: readinessError });

  let rawDocuments: Array<Record<string, unknown>> = [];
  let kind: 'company' | 'driver' = 'company';

  // Missing placeholder rows are represented by the readiness response. The
  // review queue contains uploaded evidence only, preventing empty optional
  // placeholders from appearing as reviewable documents or receiving URLs.
  if (application.account_type === 'owner_driver') {
    kind = 'driver';
    const { data, error } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('id, doc_type, file_path, upload_status, verification_status, reviewed_by, reviewed_at, review_notes, expiry_date, created_at, updated_at')
      .eq('onboarding_application_id', id)
      .not('file_path', 'is', null)
      .eq('upload_status', 'uploaded')
      .order('doc_type')
      .order('updated_at', { ascending: false });
    if (error) return respond(500, { error: error.message });
    rawDocuments = (data ?? []) as Array<Record<string, unknown>>;
  } else {
    const { data, error } = await supabaseAdmin
      .from('company_documents')
      .select('id, doc_type, file_path, status, reviewed_by, reviewed_at, review_notes, expiry_date, created_at, updated_at')
      .eq('onboarding_application_id', id)
      .not('file_path', 'is', null)
      .order('doc_type')
      .order('updated_at', { ascending: false });
    if (error) return respond(500, { error: error.message });
    rawDocuments = (data ?? []) as Array<Record<string, unknown>>;
  }

  const documents = await Promise.all(rawDocuments.map(async (document) => ({
    ...document,
    kind,
    signedUrl: await signedDocumentUrl(typeof document.file_path === 'string' ? document.file_path : null),
  })));

  return respond(200, {
    application,
    documents,
    readiness,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid document review action.' });

  const { id } = await params;
  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, account_type, status')
    .eq('id', id)
    .maybeSingle();

  if (applicationError) return respond(500, { error: applicationError.message });
  if (!application) return respond(404, { error: 'Onboarding application not found.' });
  if (application.status === 'approved') {
    return respond(409, { error: 'Approved onboarding evidence is locked. Reopen the application before changing document decisions.' });
  }

  const now = new Date().toISOString();
  const { kind, documentId, action, notes, expiryDate } = parsed.data;

  if (kind === 'driver') {
    if (application.account_type !== 'owner_driver') {
      return respond(409, { error: 'Driver evidence is not valid for this onboarding type.' });
    }

    const { data: document, error: documentError } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('id, file_path, upload_status')
      .eq('id', documentId)
      .eq('onboarding_application_id', id)
      .maybeSingle();
    if (documentError) return respond(500, { error: documentError.message });
    if (!document) return respond(404, { error: 'Driver document not found.' });
    if (!document.file_path || document.upload_status !== 'uploaded') {
      return respond(409, { error: 'A missing document cannot be approved or rejected.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('driver_identity_documents')
      .update({
        verification_status: action === 'approve' ? 'verified' : 'rejected',
        reviewed_by: owner.id,
        reviewed_at: now,
        review_notes: notes ?? null,
        expiry_date: expiryDate ?? null,
      })
      .eq('id', documentId)
      .eq('onboarding_application_id', id);
    if (updateError) return respond(500, { error: updateError.message });
  } else {
    if (application.account_type === 'owner_driver') {
      return respond(409, { error: 'Company evidence is not valid for owner-driver onboarding.' });
    }

    const { data: document, error: documentError } = await supabaseAdmin
      .from('company_documents')
      .select('id, file_path')
      .eq('id', documentId)
      .eq('onboarding_application_id', id)
      .maybeSingle();
    if (documentError) return respond(500, { error: documentError.message });
    if (!document) return respond(404, { error: 'Company document not found.' });
    if (!document.file_path) return respond(409, { error: 'A missing document cannot be approved or rejected.' });

    const { error: updateError } = await supabaseAdmin
      .from('company_documents')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: owner.id,
        reviewed_at: now,
        review_notes: notes ?? null,
        expiry_date: expiryDate ?? null,
      })
      .eq('id', documentId)
      .eq('onboarding_application_id', id);
    if (updateError) return respond(500, { error: updateError.message });
  }

  const { data: readiness, error: readinessError } = await getOnboardingComplianceReadiness(supabaseAdmin, {
    applicationId: id,
  });
  if (readinessError) return respond(500, { error: readinessError });

  return respond(200, {
    success: true,
    documentId,
    action,
    readiness,
  });
}
