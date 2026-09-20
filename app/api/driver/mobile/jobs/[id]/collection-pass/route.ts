import { createHmac, randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'cancelled_by_customer', 'cancelled_by_driver']);

function signingSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';
}

function passHash(jobId: string, code: string) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(jobId + ':' + code).digest('hex');
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

type AssignedJob = {
  id: string;
  status: string | null;
  current_status: string | null;
  assigned_driver_id: string | null;
  accepted_bid_id: string | null;
  collection_pass_required: boolean | null;
  pickup_datetime: string | null;
  collection_window_end: string | null;
};

async function loadAssignedJob(id: string, driverId: string) {
  return supabaseAdmin!
    .from('jobs')
    .select('id,status,current_status,assigned_driver_id,accepted_bid_id,collection_pass_required,pickup_datetime,collection_window_end')
    .eq('id', id)
    .eq('assigned_driver_id', driverId)
    .maybeSingle();
}

async function resolveVehicleId(job: AssignedJob, driverId: string) {
  if (job.accepted_bid_id) {
    const { data: acceptedBid } = await supabaseAdmin!
      .from('job_bids')
      .select('quote_vehicle_id')
      .eq('id', job.accepted_bid_id)
      .maybeSingle();
    if (acceptedBid?.quote_vehicle_id) return String(acceptedBid.quote_vehicle_id);
  }

  const { data: vehicle } = await supabaseAdmin!
    .from('vehicles')
    .select('id')
    .eq('assigned_driver_id', driverId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return vehicle?.id ? String(vehicle.id) : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;

  const { data: jobData, error: jobError } = await loadAssignedJob(id, driver.driverId);
  if (jobError) return respond(500, { error: jobError.message });
  if (!jobData) return respond(404, { error: 'Job not found.' });
  const job = jobData as AssignedJob;

  const { data: pass, error: passError } = await supabaseAdmin
    .from('driver_collection_passes')
    .select('status,code_last4,expires_at,activated_at,verified_at,vehicle_id,locked_until')
    .eq('job_id', id)
    .eq('driver_id', driver.driverId)
    .maybeSingle();
  if (passError) return respond(500, { error: passError.message });

  const now = Date.now();
  const expired = Boolean(pass?.expires_at && Date.parse(pass.expires_at) <= now && pass.status === 'active');
  if (expired) {
    await supabaseAdmin
      .from('driver_collection_passes')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('job_id', id)
      .eq('driver_id', driver.driverId)
      .eq('status', 'active');
  }

  const vehicleId = pass?.vehicle_id ? String(pass.vehicle_id) : await resolveVehicleId(job, driver.driverId);

  return respond(200, {
    ok: true,
    required: job.collection_pass_required === true,
    status: expired ? 'expired' : pass?.status ?? 'not_activated',
    codeLast4: pass?.code_last4 ?? null,
    expiresAt: pass?.expires_at ?? null,
    activatedAt: pass?.activated_at ?? null,
    verifiedAt: pass?.verified_at ?? null,
    vehicleId,
    lockedUntil: pass?.locked_until ?? null,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const action = String(body.action ?? 'activate').trim().toLowerCase();
  if (!['activate', 'rotate', 'revoke'].includes(action)) return respond(400, { error: 'Unsupported collection pass action.' });

  const { data: jobData, error: jobError } = await loadAssignedJob(id, driver.driverId);
  if (jobError) return respond(500, { error: jobError.message });
  if (!jobData) return respond(404, { error: 'Job not found.' });
  const job = jobData as AssignedJob;

  const jobStatus = normalizeStatus(job.current_status || job.status);
  if (terminalStatuses.has(jobStatus)) return respond(409, { error: 'Collection Pass is unavailable after the job has finished.' });
  if (!signingSecret()) return respond(503, { error: 'Collection Pass signing is not configured.' });

  if (action === 'revoke') {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('driver_collection_passes')
      .update({ status: 'revoked', updated_at: now })
      .eq('job_id', id)
      .eq('driver_id', driver.driverId)
      .in('status', ['active', 'expired']);
    if (error) return respond(500, { error: error.message });
    await insertTrackingEvent(id, driver.userId, 'note', 'Collection Pass revoked by assigned driver.');
    return respond(200, { ok: true, status: 'revoked' });
  }

  const vehicleId = await resolveVehicleId(job, driver.driverId);
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  const record = {
    job_id: id,
    driver_id: driver.driverId,
    vehicle_id: vehicleId,
    token_hash: passHash(id, code),
    code_last4: code.slice(-4),
    status: 'active',
    expires_at: expiresAt,
    activated_at: now.toISOString(),
    verified_at: null,
    verified_by_user_id: null,
    verify_attempts: 0,
    last_attempt_at: null,
    locked_until: null,
    updated_at: now.toISOString(),
  };

  const { error: upsertError } = await supabaseAdmin
    .from('driver_collection_passes')
    .upsert(record, { onConflict: 'job_id' });
  if (upsertError) return respond(500, { error: upsertError.message });

  await insertTrackingEvent(id, driver.userId, 'note', action === 'rotate' ? 'Collection Pass rotated by assigned driver.' : 'Collection Pass activated by assigned driver.');

  return respond(200, {
    ok: true,
    status: 'active',
    required: job.collection_pass_required === true,
    code,
    codeLast4: code.slice(-4),
    expiresAt,
    vehicleId,
  });
}
