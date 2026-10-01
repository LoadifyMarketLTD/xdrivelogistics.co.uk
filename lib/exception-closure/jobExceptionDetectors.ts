export type DetectorJob = {
  id: string;
  company_id?: string | null;
  posted_by_company_id?: string | null;
  assigned_company_id?: string | null;
  awarded_carrier_company_id?: string | null;
  assigned_driver_id?: string | null;
  current_status?: string | null;
  status?: string | null;
  load_id?: string | null;
  your_ref?: string | null;
  load_ref?: string | null;
  pickup_datetime?: string | null;
  delivery_datetime?: string | null;
  collection_window_start?: string | null;
  collection_window_end?: string | null;
  delivery_window_end?: string | null;
  status_updated_at?: string | null;
  updated_at?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
  pod_required?: boolean | null;
  pod_generated?: boolean | null;
  broker_pod_review_status?: string | null;
  is_test?: boolean | null;
};

export type JobExceptionCandidate = {
  caseType: 'pickup_overdue' | 'delivery_overdue' | 'driver_status_stale' | 'driver_gps_stale' | 'pod_missing' | 'pod_rejected' | 'delivered_without_invoice' | 'job_unallocated_collection_imminent';
  severity: 'P1' | 'P2';
  title: string;
  description: string;
  jobId: string;
  entityType: 'job';
  entityId: string;
  entityLabel: string;
  companyId: string | null;
  dedupeKey: string;
  nextAction: string;
  nextActionDueMinutes: number;
  customerUpdateDueMinutes: number | null;
  closureDueMinutes: number;
  metadata: Record<string, unknown>;
};

const ACTIVE = new Set(['allocated','accepted','on_my_way','on_my_way_to_pickup','on_site_pickup','loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery']);
const PRE_COLLECTION = new Set(['allocated','accepted','on_my_way','on_my_way_to_pickup','on_site_pickup']);
const DRIVER_MOVING = new Set(['on_my_way','on_my_way_to_pickup','on_site_pickup','loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery']);
const COMPLETED = new Set(['delivered','completed','invoiced','paid']);
const parseMs = (value?: string | null) => value ? Date.parse(value) : Number.NaN;
const entityLabel = (job: DetectorJob) => job.load_id?.trim() || job.your_ref?.trim() || job.load_ref?.trim() || job.id.slice(0,8).toUpperCase();
const companyId = (job: DetectorJob) => job.assigned_company_id || job.awarded_carrier_company_id || job.company_id || job.posted_by_company_id || null;

function makeCandidate(job: DetectorJob, input: Omit<JobExceptionCandidate,'jobId'|'entityType'|'entityId'|'entityLabel'|'companyId'|'dedupeKey'>): JobExceptionCandidate {
  return {...input, jobId: job.id, entityType: 'job', entityId: job.id, entityLabel: entityLabel(job), companyId: companyId(job), dedupeKey: `exception:${input.caseType}:job:${job.id}`};
}

export function detectJobExceptions(jobs: DetectorJob[], invoiceJobIds: Set<string>, latestGpsByDriver: Map<string, number>, nowMs = Date.now()) {
  const out: JobExceptionCandidate[] = [];
  for (const job of jobs) {
    if (job.is_test) continue;
    const status = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
    const pickupDue = parseMs(job.collection_window_end ?? job.pickup_datetime);
    const deliveryDue = parseMs(job.delivery_window_end ?? job.delivery_datetime);
    const statusUpdated = parseMs(job.status_updated_at ?? job.updated_at);

    if (PRE_COLLECTION.has(status) && Number.isFinite(pickupDue) && pickupDue < nowMs) out.push(makeCandidate(job,{caseType:'pickup_overdue',severity:'P1',title:'Collection is overdue',description:'The planned collection deadline has passed while the job remains in pre-collection execution.',nextAction:'Contact the driver or dispatcher, confirm collection status and update the customer.',nextActionDueMinutes:15,customerUpdateDueMinutes:15,closureDueMinutes:120,metadata:{detector:'pickup_overdue',job_status:status,pickup_due_at:new Date(pickupDue).toISOString()}}));
    if (ACTIVE.has(status) && Number.isFinite(deliveryDue) && deliveryDue < nowMs) out.push(makeCandidate(job,{caseType:'delivery_overdue',severity:'P1',title:'Delivery is overdue',description:'The planned delivery deadline has passed while the job remains in active execution.',nextAction:'Confirm delivery position, recovery ETA and customer communication.',nextActionDueMinutes:15,customerUpdateDueMinutes:15,closureDueMinutes:120,metadata:{detector:'delivery_overdue',job_status:status,delivery_due_at:new Date(deliveryDue).toISOString()}}));
    if (DRIVER_MOVING.has(status) && Number.isFinite(statusUpdated) && statusUpdated < nowMs - 30*60_000) out.push(makeCandidate(job,{caseType:'driver_status_stale',severity:'P2',title:'Driver status update is stale',description:'An executing job has not received a driver status update within the operational freshness window.',nextAction:'Confirm driver progress and restore current job status.',nextActionDueMinutes:30,customerUpdateDueMinutes:30,closureDueMinutes:240,metadata:{detector:'driver_status_stale',job_status:status}}));
    const podReview=String(job.broker_pod_review_status ?? '').trim().toLowerCase();
    const podMissingFromCompletion = COMPLETED.has(status) && (job.pod_required ?? true) && !(job.pod_generated ?? false);
    if (podMissingFromCompletion || podReview === 'missing_requested') out.push(makeCandidate(job,{caseType:'pod_missing',severity:podReview === 'missing_requested' ? 'P1' : 'P2',title:'POD is missing',description:'The job requires proof of delivery evidence that is not currently accepted as complete.',nextAction:'Request or complete the missing POD and verify delivery evidence.',nextActionDueMinutes:podReview === 'missing_requested' ? 30 : 120,customerUpdateDueMinutes:podReview === 'missing_requested' ? 30 : null,closureDueMinutes:podReview === 'missing_requested' ? 240 : 480,metadata:{detector:'pod_missing',job_status:status,pod_review_status:podReview || null}}));

    if (podReview==='rejected') out.push(makeCandidate(job,{caseType:'pod_rejected',severity:'P1',title:'POD was rejected',description:'The recorded proof of delivery was rejected and requires replacement evidence or corrective action.',nextAction:'Resolve the POD rejection and provide acceptable replacement evidence.',nextActionDueMinutes:30,customerUpdateDueMinutes:30,closureDueMinutes:240,metadata:{detector:'pod_rejected',pod_review_status:podReview}}));

    const closureAt=parseMs(job.delivered_at ?? job.completed_at ?? job.status_updated_at ?? job.updated_at);
    if ((status==='delivered'||status==='completed') && Number.isFinite(closureAt) && closureAt < nowMs-10*60_000 && !invoiceJobIds.has(job.id)) out.push(makeCandidate(job,{caseType:'delivered_without_invoice',severity:'P1',title:'Delivered job has no invoice',description:'The job is delivered or completed but no invoice record exists after the closure grace period.',nextAction:'Investigate invoice generation and restore the job-to-invoice closure path.',nextActionDueMinutes:30,customerUpdateDueMinutes:null,closureDueMinutes:120,metadata:{detector:'delivered_without_invoice',job_status:status}}));

    const pickupStart=parseMs(job.collection_window_start ?? job.pickup_datetime);
    const awarded=status==='awarded'||Boolean(job.awarded_carrier_company_id||job.assigned_company_id);
    if (awarded && !job.assigned_driver_id && Number.isFinite(pickupStart) && pickupStart>=nowMs && pickupStart<=nowMs+60*60_000) out.push(makeCandidate(job,{caseType:'job_unallocated_collection_imminent',severity:'P1',title:'Collection is imminent and unallocated',description:'An awarded job is approaching collection without an assigned driver.',nextAction:'Allocate a driver and confirm the collection plan.',nextActionDueMinutes:15,customerUpdateDueMinutes:null,closureDueMinutes:60,metadata:{detector:'job_unallocated_collection_imminent'}}));

    if (job.assigned_driver_id && DRIVER_MOVING.has(status) && Number.isFinite(statusUpdated) && statusUpdated < nowMs-3*60_000) {
      const latest=latestGpsByDriver.get(job.assigned_driver_id);
      if (latest===undefined || latest < nowMs-3*60_000) out.push(makeCandidate(job,{caseType:'driver_gps_stale',severity:'P2',title:'Driver GPS is stale',description:'An executing job has no fresh driver GPS position inside the tracking freshness window.',nextAction:'Restore live tracking or confirm the driver position manually.',nextActionDueMinutes:30,customerUpdateDueMinutes:30,closureDueMinutes:240,metadata:{detector:'driver_gps_stale',job_status:status,latest_gps_at:latest?new Date(latest).toISOString():null}}));
    }
  }
  return out;
}
