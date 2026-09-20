import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

const allowedTypes = new Set(['waiting_time', 'toll', 'parking', 'handball', 'other']);

async function requireAssignedJob(jobId: string, driverId: string) {
  return supabaseAdmin!
    .from('jobs')
    .select('id,assigned_driver_id,awarded_carrier_company_id,status,current_status')
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
    .select('id,job_id,driver_id,supplier_company_id,extra_type,description,amount_gbp,minutes,status,review_note,created_at,updated_at')
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
  if (['delivered', 'completed', 'cancelled', 'cancelled_by_customer', 'cancelled_by_driver'].includes(current)) {
    return respond(409, { error: 'Execution extras cannot be added after the job is closed.' });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
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

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('driver_job_extras')
    .insert({
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
    .select('id,job_id,driver_id,supplier_company_id,extra_type,description,amount_gbp,minutes,status,review_note,created_at,updated_at')
    .single();

  if (error) return respond(500, { error: error.message });

  await insertTrackingEvent(id, driver.userId, 'note', 'Driver submitted execution extra: ' + extraType + ' £' + amountGbp.toFixed(2) + '.');
  return respond(201, { ok: true, extra: data });
}
