import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

const allowedTypes = new Set(['waiting_time', 'toll', 'parking', 'handball', 'other']);
const reserveActive = new Set(['accepted','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery']);
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const extraSelect = 'id,job_id,driver_id,supplier_company_id,extra_type,description,amount_gbp,minutes,status,review_note,reviewed_by,reviewed_at,decision_company_id,contractual_amendment_id,contractual_snapshot,contractual_snapshot_hash,contractual_snapshot_version,invoice_item_id,created_at,updated_at';

async function requireAssignedJob(jobId: string, driverId: string) {
  return supabaseAdmin!
    .from('jobs')
    .select('id,assigned_driver_id,assigned_company_id,awarded_carrier_company_id,status,current_status,is_test,pod_generated')
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .maybeSingle();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;

  const { data: job, error: jobError } = await requireAssignedJob(id, driver.driverId);
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const { data, error } = await supabaseAdmin
    .from('driver_job_extras')
    .select(extraSelect)
    .eq('job_id', id)
    .eq('driver_id', driver.driverId)
    .order('created_at', { ascending: false });

  if (error) return respond(500, { error: error.message });
  return respond(200, { ok: true, extras: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;

  const { data: job, error: jobError } = await requireAssignedJob(id, driver.driverId);
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const current = String(job.current_status || job.status || '').toLowerCase();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(400, { error: 'Invalid execution charge request.' });
  const reserveRequest = Object.prototype.hasOwnProperty.call(body, 'requestId');
  const requestId = typeof body.requestId === 'string' ? body.requestId.toLowerCase() : '';
  if (reserveRequest && !requestIdPattern.test(requestId)) return respond(400, { error: 'Valid charge request ID required.' });
  if (reserveRequest && (!driver.companyId || job.assigned_company_id !== driver.companyId || job.is_test !== true)) return respond(403, { error: 'Reserve charge pilot requires the assigned test carrier.' });
  if (!reserveRequest && ['delivered', 'completed', 'cancelled', 'cancelled_by_customer', 'cancelled_by_driver'].includes(current)) {
    return respond(409, { error: 'Execution extras cannot be added after the job is closed.' });
  }
  const extraType = String(body.extraType ?? '').trim().toLowerCase();
  const description = String(body.description ?? '').trim().slice(0, 500);
  const amountGbp = Math.round(Number(body.amountGbp) * 100) / 100;
  const minutes = body.minutes == null || body.minutes === '' ? null : Math.round(Number(body.minutes));

  if (!allowedTypes.has(extraType)) return respond(400, { error: 'Unsupported extra type.' });
  if (!Number.isFinite(amountGbp) || amountGbp <= 0 || amountGbp > 10000) return respond(400, { error: 'Enter a valid extra amount.' });
  if (extraType === 'waiting_time' && (!Number.isFinite(minutes) || (minutes ?? 0) < 1 || (minutes ?? 0) > 1440)) {
    return respond(400, { error: 'Waiting minutes must be between 1 and 1440.' });
  }
  if (extraType !== 'waiting_time' && minutes !== null) return respond(400, { error: 'Minutes are only valid for waiting time.' });

  const findRequest = async () => supabaseAdmin!.from('driver_job_extras').select(extraSelect).eq('id', requestId).eq('job_id', id).eq('driver_id', driver.driverId).eq('supplier_company_id', driver.companyId!).maybeSingle();
  const matchesRequest = (row: Record<string, unknown>) =>
    row.id === requestId && row.job_id === id && row.driver_id === driver.driverId &&
    row.supplier_company_id === driver.companyId && row.extra_type === extraType &&
    (row.description ?? null) === (description || null) &&
    Number(row.amount_gbp) === amountGbp && (row.minutes == null ? null : Number(row.minutes)) === minutes;
  if (reserveRequest) {
    if (!description || typeof body.amountGbp !== 'number' || body.amountGbp !== amountGbp ||
      (body.minutes != null && (typeof body.minutes !== 'number' || !Number.isInteger(body.minutes)))) return respond(400, { error: 'Charge reason, exact amount and whole minutes required.' });
    const prior = await findRequest();
    if (prior.error) return respond(503, { error: 'Charge request identity could not be verified.' });
    if (prior.data) return matchesRequest(prior.data) ? respond(200, { ok: true, duplicate: true, extra: prior.data }) : respond(409, { error: 'Charge request ID already belongs to different details.' });
    if (!reserveActive.has(current) || job.pod_generated === true) return respond(409, { error: 'New charges require an active booking before POD.' });
    const agreement = await supabaseAdmin.from('job_commercial_agreements_effective').select('id,currency').eq('job_id', id).eq('supplier_company_id', driver.companyId!).eq('agreement_status', 'accepted').maybeSingle();
    if (agreement.error || !agreement.data || agreement.data.currency !== 'GBP') return respond(409, { error: 'Accepted GBP supplier agreement required for this charge.' });
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('driver_job_extras')
    .insert({
      ...(reserveRequest ? { id: requestId } : {}),
      job_id: id,
      driver_id: driver.driverId,
      supplier_company_id: driver.companyId,
      created_by: driver.userId,
      extra_type: extraType,
      description: description || null,
      amount_gbp: amountGbp,
      minutes,
      status: 'submitted',
      created_at: now,
      updated_at: now,
    })
    .select(extraSelect)
    .single();

  if (error) {
    if (reserveRequest && error.code === '23505') {
      const prior = await findRequest();
      if (!prior.error && prior.data && matchesRequest(prior.data)) return respond(200, { ok: true, duplicate: true, extra: prior.data });
      return respond(409, { error: 'Charge request ID conflict. Refresh before creating another request.' });
    }
    return respond(500, { error: 'Charge request could not be confirmed.' });
  }

  await insertTrackingEvent(id, driver.userId, 'note', 'Driver submitted execution extra: ' + extraType + ' £' + amountGbp.toFixed(2) + '.').catch(() => undefined);
  return respond(201, { ok: true, extra: data });
}
