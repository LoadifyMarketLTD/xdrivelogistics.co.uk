import type { SupabaseClient } from '@supabase/supabase-js';

import { detectJobExceptions, type DetectorJob } from './jobExceptionDetectors';

const JOB_SELECT = [
  'id','company_id','posted_by_company_id','assigned_company_id','awarded_carrier_company_id',
  'assigned_driver_id','current_status','status','load_id','job_ref','load_ref',
  'pickup_datetime','delivery_datetime','collection_window_start','collection_window_end',
  'delivery_window_end','status_updated_at','updated_at','delivered_at','completed_at',
  'pod_required','pod_generated','broker_pod_review_status','is_test',
].join(',');

export type ExceptionReconcileResult = {
  detected: number;
  createdOrMatched: number;
  planned: number;
  errors: string[];
};

const isoAfterMinutes = (nowMs: number, minutes: number | null) =>
  minutes === null ? null : new Date(nowMs + minutes * 60_000).toISOString();

export async function reconcileJobExceptions(
  client: SupabaseClient,
  actorUserId: string,
  nowMs = Date.now(),
): Promise<ExceptionReconcileResult> {
  const [jobsResult, invoicesResult] = await Promise.all([
    client.from('jobs').select(JOB_SELECT),
    client.from('invoices').select('job_id').not('job_id', 'is', null),
  ]);

  const errors: string[] = [];
  if (jobsResult.error) errors.push(`jobs: ${jobsResult.error.message}`);
  if (invoicesResult.error) errors.push(`invoices: ${invoicesResult.error.message}`);
  if (errors.length) return { detected: 0, createdOrMatched: 0, planned: 0, errors };

  const jobs = (jobsResult.data ?? []) as unknown as DetectorJob[];
  const invoiceJobIds = new Set(
    (invoicesResult.data ?? [])
      .map((row) => String(row.job_id ?? ''))
      .filter(Boolean),
  );

  const driverIds = Array.from(new Set(
    jobs
      .filter((job) => !job.is_test)
      .map((job) => job.assigned_driver_id ?? '')
      .filter(Boolean),
  ));

  const latestGpsByDriver = new Map<string, number>();
  if (driverIds.length > 0) {
    const locationsResult = await client
      .from('driver_locations')
      .select('driver_id, recorded_at')
      .in('driver_id', driverIds)
      .gte('recorded_at', new Date(nowMs - 24 * 60 * 60_000).toISOString())
      .order('recorded_at', { ascending: false })
      .limit(5000);

    if (locationsResult.error) {
      errors.push(`driver_locations: ${locationsResult.error.message}`);
      return { detected: 0, createdOrMatched: 0, planned: 0, errors };
    }

    for (const row of locationsResult.data ?? []) {
      const driverId = String(row.driver_id ?? '');
      if (!driverId || latestGpsByDriver.has(driverId)) continue;
      const recordedAt = Date.parse(String(row.recorded_at ?? ''));
      if (Number.isFinite(recordedAt)) latestGpsByDriver.set(driverId, recordedAt);
    }
  }

  const candidates = detectJobExceptions(
    jobs,
    invoiceJobIds,
    latestGpsByDriver,
    nowMs,
  );

  let createdOrMatched = 0;
  let planned = 0;

  for (const candidate of candidates) {
    const createResult = await client.rpc('owner_create_platform_case', {
      p_actor_user_id: actorUserId,
      p_source: 'exception_closure_engine',
      p_case_type: candidate.caseType,
      p_severity: candidate.severity,
      p_title: candidate.title,
      p_description: candidate.description,
      p_entity_type: 'job',
      p_entity_id: candidate.jobId,
      p_entity_label: candidate.entityLabel,
      p_company_id: candidate.companyId,
      p_assigned_to_user_id: null,
      p_dedupe_key: candidate.dedupeKey,
      p_metadata: candidate.metadata,
    });

    if (createResult.error) {
      errors.push(`${candidate.caseType}:${candidate.jobId}: ${createResult.error.message}`);
      continue;
    }
    const caseRow = Array.isArray(createResult.data)
      ? createResult.data[0] ?? null
      : createResult.data;
    const caseId = String(caseRow?.id ?? '');
    if (!caseId) {
      errors.push(`${candidate.caseType}:${candidate.jobId}: no case id returned`);
      continue;
    }

    createdOrMatched += 1;

    if (!caseRow?.next_action) {
      const planResult = await client.rpc('owner_set_platform_case_plan', {
        p_actor_user_id: actorUserId,
        p_case_id: caseId,
        p_next_action: candidate.nextAction,
        p_next_action_due_at: isoAfterMinutes(nowMs, candidate.nextActionDueMinutes),
        p_customer_update_due_at: isoAfterMinutes(nowMs, candidate.customerUpdateDueMinutes),
        p_closure_due_at: isoAfterMinutes(nowMs, candidate.closureDueMinutes),
      });

      if (planResult.error) {
        errors.push(`${candidate.caseType}:${candidate.jobId}: plan: ${planResult.error.message}`);
      } else {
        planned += 1;
      }
    }
  }

  const slaResult = await client.rpc('service_reconcile_platform_case_sla', {
    p_now: new Date(nowMs).toISOString(),
  });
  if (slaResult.error) errors.push(`sla: ${slaResult.error.message}`);

  return {
    detected: candidates.length,
    createdOrMatched,
    planned,
    errors,
  };
}
