import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';
import { getOnboardingContract } from '../../../../../lib/onboardingContract';
import { assessOnboardingRecovery } from '../../../../../lib/onboardingProgress';

const json = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const asPayload = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export async function GET(request: NextRequest) {
  const owner = await verifyPlatformOwner(request);
  if (!owner || !supabaseAdmin) return json(403, { error: 'Forbidden: Platform Owner authority required.' });

  const { data: applications, error } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, current_step, completion_percentage, company_id, payload, created_at, last_activity_at')
    .in('status', ['invited', 'draft', 'in_progress', 'request_changes'])
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) return json(500, { error: error.message });

  const applicationIds = (applications ?? []).map((application) => application.id);
  const latestRecoveryEventByApplication = new Map<string, { event_type: string; created_at: string }>();
  if (applicationIds.length > 0) {
    const { data: recoveryEvents, error: recoveryEventsError } = await supabaseAdmin
      .from('notification_events')
      .select('entity_id, event_type, created_at')
      .eq('entity_type', 'onboarding_application')
      .in('entity_id', applicationIds)
      .in('event_type', ['onboarding_completion_required', 'onboarding_reminder'])
      .order('created_at', { ascending: false });
    if (recoveryEventsError) return json(500, { error: recoveryEventsError.message });
    for (const event of recoveryEvents ?? []) {
      if (!latestRecoveryEventByApplication.has(event.entity_id)) {
        latestRecoveryEventByApplication.set(event.entity_id, {
          event_type: event.event_type,
          created_at: event.created_at,
        });
      }
    }
  }

  const rows = await Promise.all((applications ?? []).map(async (application) => {
    const payload = asPayload(application.payload);
    const contract = getOnboardingContract(application.account_type);
    const identityTypes = contract?.documents.filter((doc) => doc.family === 'identity').map((doc) => doc.type) ?? [];
    const companyTypes = contract?.documents.filter((doc) => doc.family === 'company').map((doc) => doc.type) ?? [];

    if (identityTypes.length > 0) {
      const { data: docs, error: docsError } = await supabaseAdmin!
        .from('driver_identity_documents')
        .select('doc_type, file_path, upload_status')
        .eq('onboarding_application_id', application.id)
        .in('doc_type', identityTypes);
      if (!docsError) {
        for (const doc of docs ?? []) {
          if (doc.file_path && doc.upload_status === 'uploaded') payload[`doc_${doc.doc_type}`] = doc.file_path;
        }
      }
    }

    if (companyTypes.length > 0) {
      const { data: docs, error: docsError } = await supabaseAdmin!
        .from('company_documents')
        .select('doc_type, file_path, status')
        .eq('onboarding_application_id', application.id)
        .in('doc_type', companyTypes);
      if (!docsError) {
        for (const doc of docs ?? []) {
          if (doc.file_path && doc.status !== 'rejected') payload[`doc_${doc.doc_type}`] = doc.file_path;
        }
      }
    }

    const recovery = assessOnboardingRecovery(application.account_type, payload, { companyId: application.company_id });
    const payloadName = typeof payload.full_name === 'string'
      ? payload.full_name
      : typeof payload.contact_person === 'string'
        ? payload.contact_person
        : typeof payload.legal_company_name === 'string'
          ? payload.legal_company_name
          : typeof payload.company_name === 'string'
            ? payload.company_name
            : '';

    const lastActivityAt = application.last_activity_at ?? application.created_at;
    const inactiveDays = lastActivityAt
      ? Math.max(0, Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (24 * 60 * 60 * 1000)))
      : null;
    const latestRecoveryEvent = latestRecoveryEventByApplication.get(application.id) ?? null;
    const elapsedSinceRecoveryMs = latestRecoveryEvent
      ? Date.now() - new Date(latestRecoveryEvent.created_at).getTime()
      : null;
    const reminderEligible = typeof elapsedSinceRecoveryMs === 'number'
      && Number.isFinite(elapsedSinceRecoveryMs)
      && elapsedSinceRecoveryMs >= 7 * 24 * 60 * 60 * 1000;

    return {
      id: application.id,
      user_id: application.user_id,
      email: application.email ?? '',
      applicant_name: payloadName || application.email || 'Unknown applicant',
      account_type: application.account_type,
      status: application.status,
      current_step: application.current_step,
      stored_completion_percentage: Number(application.completion_percentage ?? 0),
      canonical_completion_percentage: recovery.progress,
      company_id: application.company_id,
      last_activity_at: lastActivityAt,
      inactive_days: inactiveDays,
      missing_fields: recovery.missingFields,
      missing_documents: recovery.missingDocuments,
      blocking_reasons: recovery.blockingReasons,
      recovery_required: !recovery.complete,
      last_recovery_event_type: latestRecoveryEvent?.event_type ?? null,
      last_recovery_event_at: latestRecoveryEvent?.created_at ?? null,
      reminder_eligible: reminderEligible,
    };
  }));

  return json(200, {
    rows,
    summary: {
      total: rows.length,
      recovery_required: rows.filter((row) => row.recovery_required).length,
      stale_over_7_days: rows.filter((row) => typeof row.inactive_days === 'number' && row.inactive_days > 7).length,
      close_to_complete: rows.filter((row) => row.canonical_completion_percentage >= 70 && row.recovery_required).length,
    },
  });
}
