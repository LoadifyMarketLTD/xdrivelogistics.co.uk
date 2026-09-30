import type { SupabaseClient } from '@supabase/supabase-js';

import { detectFinanceExceptions, type DetectorInvoice, type InvoiceFailureEvent, type JobFinanceContext } from './financeExceptionDetectors';
import { detectJobExceptions, type DetectorJob } from './jobExceptionDetectors';

const JOB_SELECT = [
  'id','company_id','posted_by_company_id','assigned_company_id','awarded_carrier_company_id',
  'assigned_driver_id','current_status','status','load_id','your_ref','load_ref',
  'pickup_datetime','delivery_datetime','collection_window_start','collection_window_end',
  'delivery_window_end','status_updated_at','updated_at','delivered_at','completed_at',
  'pod_required','pod_generated','broker_pod_review_status','is_test',
].join(',');

const INVOICE_SELECT = [
  'id','job_id','company_id','supplier_company_id','buyer_company_id','invoice_number','load_id','job_ref',
  'status','payment_status','due_date','issue_date','payment_due_days','disputed_at','paid_at',
].join(',');

export type ExceptionReconcileResult = {
  detected: number;
  createdOrMatched: number;
  planned: number;
  autoAssigned: number;
  customerUpdateEscalated: number;
  closureEscalated: number;
  errors: string[];
};

const isoAfterMinutes = (nowMs: number, minutes: number | null) =>
  minutes === null ? null : new Date(nowMs + minutes * 60_000).toISOString();

export async function reconcileJobExceptions(
  client: SupabaseClient,
  actorUserId: string,
  nowMs = Date.now(),
): Promise<ExceptionReconcileResult> {
  const [jobsResult, invoicesResult, invoiceFailureEventsResult] = await Promise.all([
    client.from('jobs').select(JOB_SELECT),
    client.from('invoices').select(INVOICE_SELECT).not('job_id', 'is', null),
    client
      .from('job_tracking_events')
      .select('job_id, message, event_time, created_at')
      .eq('event_type', 'invoice_generation_failed')
      .gte('created_at', new Date(nowMs - 30 * 24 * 60 * 60_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const errors: string[] = [];
  if (jobsResult.error) errors.push(`jobs: ${jobsResult.error.message}`);
  if (invoicesResult.error) errors.push(`invoices: ${invoicesResult.error.message}`);
  if (invoiceFailureEventsResult.error) errors.push(`invoice_failure_events: ${invoiceFailureEventsResult.error.message}`);
  if (errors.length) return { detected: 0, createdOrMatched: 0, planned: 0, autoAssigned: 0, customerUpdateEscalated: 0, closureEscalated: 0, errors };

  const jobs = (jobsResult.data ?? []) as unknown as DetectorJob[];
  const invoices = (invoicesResult.data ?? []) as unknown as DetectorInvoice[];
  const invoiceFailureEvents = (invoiceFailureEventsResult.data ?? []) as unknown as InvoiceFailureEvent[];
  const invoiceJobIds = new Set(
    invoices
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
      return { detected: 0, createdOrMatched: 0, planned: 0, autoAssigned: 0, customerUpdateEscalated: 0, closureEscalated: 0, errors };
    }

    for (const row of locationsResult.data ?? []) {
      const driverId = String(row.driver_id ?? '');
      if (!driverId || latestGpsByDriver.has(driverId)) continue;
      const recordedAt = Date.parse(String(row.recorded_at ?? ''));
      if (Number.isFinite(recordedAt)) latestGpsByDriver.set(driverId, recordedAt);
    }
  }

  const jobCandidates = detectJobExceptions(
    jobs,
    invoiceJobIds,
    latestGpsByDriver,
    nowMs,
  );

  const jobsById = new Map<string, JobFinanceContext>(
    jobs.map((job) => [
      job.id,
      {
        id: job.id,
        label: job.load_id?.trim() || job.your_ref?.trim() || job.load_ref?.trim() || job.id.slice(0, 8).toUpperCase(),
        companyId: job.assigned_company_id || job.awarded_carrier_company_id || job.company_id || job.posted_by_company_id || null,
        isTest: Boolean(job.is_test),
      },
    ]),
  );

  const financeCandidates = detectFinanceExceptions(
    invoices,
    invoiceFailureEvents,
    jobsById,
    nowMs,
  );

  const candidates = [...jobCandidates, ...financeCandidates];

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
      p_entity_type: candidate.entityType,
      p_entity_id: candidate.entityId,
      p_entity_label: candidate.entityLabel,
      p_company_id: candidate.companyId,
      p_assigned_to_user_id: actorUserId,
      p_dedupe_key: candidate.dedupeKey,
      p_metadata: candidate.metadata,
    });

    if (createResult.error) {
      errors.push(`${candidate.caseType}:${candidate.entityId}: ${createResult.error.message}`);
      continue;
    }
    const caseRow = Array.isArray(createResult.data)
      ? createResult.data[0] ?? null
      : createResult.data;
    const caseId = String(caseRow?.id ?? '');
    if (!caseId) {
      errors.push(`${candidate.caseType}:${candidate.entityId}: no case id returned`);
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
        errors.push(`${candidate.caseType}:${candidate.entityId}: plan: ${planResult.error.message}`);
      } else {
        planned += 1;
      }
    }
  }

  const reconciledAt = new Date(nowMs).toISOString();
  const slaResult = await client.rpc('service_reconcile_platform_case_sla', {
    p_now: reconciledAt,
  });
  if (slaResult.error) errors.push(`sla: ${slaResult.error.message}`);

  const obligationResult = await client.rpc('service_reconcile_platform_case_obligations', {
    p_actor_user_id: actorUserId,
    p_now: reconciledAt,
  });
  if (obligationResult.error) errors.push(`obligations: ${obligationResult.error.message}`);
  const obligationRow = Array.isArray(obligationResult.data)
    ? obligationResult.data[0] ?? null
    : obligationResult.data;

  return {
    detected: candidates.length,
    createdOrMatched,
    planned,
    autoAssigned: Number(obligationRow?.auto_assigned_count ?? 0),
    customerUpdateEscalated: Number(obligationRow?.customer_update_escalated_count ?? 0),
    closureEscalated: Number(obligationRow?.closure_escalated_count ?? 0),
    errors,
  };
}
