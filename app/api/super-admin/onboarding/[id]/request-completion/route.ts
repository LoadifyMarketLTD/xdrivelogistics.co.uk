import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { verifyPlatformOwner, isSuperAdminDeployPreviewReadOnly } from '../../../_lib/verifyPlatformOwner';
import { assessStoredOnboardingRecovery } from '../../../../onboarding/_lib/recovery';

const bodySchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  reminder: z.boolean().optional().default(false),
});

const json = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const owner = await verifyPlatformOwner(request);
  if (!owner || !supabaseAdmin) return json(403, { error: 'Forbidden: Platform Owner authority required.' });

  const { id } = await context.params;
  const { data: application, error } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, company_id, current_step, completion_percentage, payload, last_activity_at, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!application) return json(404, { error: 'Onboarding application not found.' });

  try {
    const derived = await assessStoredOnboardingRecovery({
      applicationId: application.id,
      accountType: application.account_type,
      companyId: application.company_id,
      payload: application.payload,
    });
    if (derived.error) throw new Error(derived.error);
    return json(200, {
      previewReadOnly: isSuperAdminDeployPreviewReadOnly(),
      application: {
        id: application.id,
        userId: application.user_id,
        recipientEmail: application.email,
        accountType: application.account_type,
        status: application.status,
        companyId: application.company_id,
        currentStep: application.current_step,
        storedCompletionPercentage: application.completion_percentage,
        lastActivityAt: application.last_activity_at ?? application.created_at,
      },
      recovery: derived?.recovery ?? null,
      continuationPath: '/onboarding/resume',
    });
  } catch (recoveryError) {
    return json(500, {
      error: recoveryError instanceof Error ? recoveryError.message : 'Unable to evaluate onboarding recovery.',
    });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const owner = await verifyPlatformOwner(request);
  if (!owner || !supabaseAdmin) {
    return json(403, {
      error: isSuperAdminDeployPreviewReadOnly()
        ? 'Deploy Preview is read-only. Onboarding recovery notifications cannot be sent from this environment.'
        : 'Forbidden: Platform Owner authority required.',
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'A clear recovery reason is required.' });

  const { id } = await context.params;
  const { data: application, error } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, company_id, current_step, completion_percentage, payload, last_activity_at, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!application) return json(404, { error: 'Onboarding application not found.' });
  if (!application.user_id || !application.email) return json(409, { error: 'The onboarding application has no canonical recipient.' });
  if (String(application.status).toLowerCase() === 'approved') return json(409, { error: 'Approved onboarding does not require recovery.' });

  let derived;
  try {
    derived = await assessStoredOnboardingRecovery({
      applicationId: application.id,
      accountType: application.account_type,
      companyId: application.company_id,
      payload: application.payload,
    });
    if (derived.error) throw new Error(derived.error);
  } catch (recoveryError) {
    return json(500, {
      error: recoveryError instanceof Error ? recoveryError.message : 'Unable to evaluate onboarding recovery.',
    });
  }

  if (!derived || derived.recovery.complete) {
    return json(409, { error: 'No missing onboarding requirements remain for this application.' });
  }

  const eventType = parsed.data.reminder ? 'onboarding_reminder' : 'onboarding_completion_required';

  if (parsed.data.reminder) {
    const { data: previous } = await supabaseAdmin
      .from('notification_events')
      .select('id, created_at')
      .eq('entity_type', 'onboarding_application')
      .eq('entity_id', application.id)
      .in('event_type', ['onboarding_completion_required', 'onboarding_reminder'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!previous) return json(409, { error: 'No prior onboarding completion request exists to remind.' });
    const elapsedMs = Date.now() - new Date(previous.created_at).getTime();
    if (Number.isFinite(elapsedMs) && elapsedMs < 7 * 24 * 60 * 60 * 1000) {
      return json(409, { error: 'A reminder can be sent only after 7 days.' });
    }
  }

  const missingFields = derived.recovery.missingFields.map((item) => item.label);
  const missingDocuments = derived.recovery.missingDocuments.map((item) => item.label);
  const idempotencyDay = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `onboarding-completion:${application.id}:${eventType}:${idempotencyDay}`;

  const { data: event, error: eventError } = await supabaseAdmin
    .from('notification_events')
    .insert({
      event_type: eventType,
      entity_type: 'onboarding_application',
      entity_id: application.id,
      company_id: application.company_id,
      recipient_user_id: application.user_id,
      idempotency_key: idempotencyKey,
      payload: {
        onboarding_application_id: application.id,
        account_type: application.account_type,
        missing_fields: missingFields,
        missing_documents: missingDocuments,
        blocking_reasons: derived.recovery.blockingReasons,
        canonical_progress: derived.recovery.progress,
        reason: parsed.data.reason,
        onboarding_url: '/onboarding/resume',
        email_required: true,
      },
    })
    .select('id, event_type, created_at')
    .single();

  if (eventError) {
    if (eventError.code === '23505') return json(409, { error: 'This recovery notification has already been queued today.' });
    return json(500, { error: eventError.message });
  }

  const { error: auditError } = await supabaseAdmin
    .from('owner_audit_log')
    .insert({
      target_type: 'onboarding_application',
      target_id: application.id,
      target_name: `Onboarding application ${application.id}`,
      target_company_id: application.company_id,
      actor_user_id: owner.id,
      action_type: eventType,
      old_status: application.status,
      new_status: application.status,
      reason: `${parsed.data.reason} | missing_fields=${JSON.stringify(missingFields)} | missing_documents=${JSON.stringify(missingDocuments)} | blocking_reasons=${JSON.stringify(derived.recovery.blockingReasons)}`,
    });

  if (auditError) return json(500, { error: 'Recovery notification queued but audit logging failed.' });

  return json(200, {
    ok: true,
    event,
    recovery: derived.recovery,
    continuationPath: '/onboarding/resume',
    message: parsed.data.reminder ? 'Onboarding completion reminder queued.' : 'Onboarding completion request queued.',
  });
}
