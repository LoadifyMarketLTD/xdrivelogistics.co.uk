import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';
import { assessStoredOnboardingRecovery } from '../../../onboarding/_lib/recovery';

const json = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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

  let rows;
  try {
    rows = await Promise.all((applications ?? []).map(async (application) => {
    const assessed = await assessStoredOnboardingRecovery({
      applicationId: application.id,
      accountType: application.account_type,
      companyId: application.company_id,
      payload: application.payload,
    });
    if (assessed.error) throw new Error(assessed.error);
    const { payload, recovery } = assessed;
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
  } catch (recoveryError) {
    return json(500, {
      error: recoveryError instanceof Error
        ? recoveryError.message
        : 'Unable to evaluate onboarding recovery queue.',
    });
  }

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
