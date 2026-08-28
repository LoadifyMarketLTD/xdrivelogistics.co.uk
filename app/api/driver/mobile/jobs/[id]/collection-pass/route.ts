import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../../../_lib';

const PASS_ELIGIBLE_STATUSES = new Set([
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'arrived_pickup',
]);

function statusOf(row: { current_status?: string | null; status?: string | null }) {
  return String(row.current_status ?? row.status ?? '').trim().toLowerCase();
}

function generatePassCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let output = 'XD-';
  for (let index = 0; index < 8; index += 1) output += alphabet[bytes[index] % alphabet.length];
  return output;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id: jobId } = await params;

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,status,current_status,assigned_driver_id,vehicle_id,pickup_datetime')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Assigned job not found.' });

  const status = statusOf(job);
  if (!PASS_ELIGIBLE_STATUSES.has(status)) {
    return respond(409, { error: 'Collection Pass is available only after allocation and before the job is loaded.' });
  }

  const nowIso = new Date().toISOString();
  const { data: pass, error: passError } = await supabaseAdmin
    .from('driver_collection_passes')
    .select('job_id,pass_code,issued_at,expires_at,verified_at,revoked_at,driver_id,vehicle_id')
    .eq('job_id', jobId)
    .eq('driver_id', driver.driverId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (passError) return respond(500, { error: passError.message });

  if (!pass) {
    return respond(404, {
      error: 'No active Collection Pass has been issued for this job.',
      canIssue: true,
    });
  }

  return respond(200, {
    collectionPass: {
      jobId: pass.job_id,
      passCode: pass.pass_code,
      issuedAt: pass.issued_at,
      expiresAt: pass.expires_at,
      verifiedAt: pass.verified_at,
      vehicleId: pass.vehicle_id,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id: jobId } = await params;

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,status,current_status,assigned_driver_id,vehicle_id,pickup_datetime')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Assigned job not found.' });

  const status = statusOf(job);
  if (!PASS_ELIGIBLE_STATUSES.has(status)) {
    return respond(409, { error: 'Collection Pass is available only after allocation and before the job is loaded.' });
  }
  if (!job.vehicle_id) return respond(409, { error: 'A verified assigned vehicle is required before a Collection Pass can be issued.' });

  const { data: eligibleVehicle, error: vehicleError } = await supabaseAdmin
    .from('vehicles')
    .select('id,assigned_driver_id')
    .eq('id', job.vehicle_id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (vehicleError) return respond(500, { error: vehicleError.message });
  if (!eligibleVehicle) return respond(409, { error: 'The allocated vehicle is not currently assigned to this driver.' });

  const now = new Date();
  const pickupTime = job.pickup_datetime ? new Date(job.pickup_datetime) : null;
  const candidateExpiry = pickupTime && Number.isFinite(pickupTime.getTime())
    ? new Date(pickupTime.getTime() + 6 * 60 * 60 * 1000)
    : new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const maxExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiresAt = candidateExpiry.getTime() > maxExpiry.getTime() ? maxExpiry : candidateExpiry;
  if (expiresAt.getTime() <= now.getTime()) expiresAt.setTime(now.getTime() + 2 * 60 * 60 * 1000);

  const { data: existing } = await supabaseAdmin
    .from('driver_collection_passes')
    .select('job_id,pass_code,issued_at,expires_at,verified_at,vehicle_id')
    .eq('job_id', jobId)
    .eq('driver_id', driver.driverId)
    .is('revoked_at', null)
    .gt('expires_at', now.toISOString())
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return respond(200, {
      collectionPass: {
        jobId: existing.job_id,
        passCode: existing.pass_code,
        issuedAt: existing.issued_at,
        expiresAt: existing.expires_at,
        verifiedAt: existing.verified_at,
        vehicleId: existing.vehicle_id,
      },
      idempotent: true,
    });
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('driver_collection_passes')
    .insert({
      job_id: jobId,
      driver_id: driver.driverId,
      vehicle_id: job.vehicle_id,
      pass_code: generatePassCode(),
      expires_at: expiresAt.toISOString(),
    })
    .select('job_id,pass_code,issued_at,expires_at,verified_at,vehicle_id')
    .single();
  if (createError) return respond(500, { error: createError.message });

  return respond(201, {
    collectionPass: {
      jobId: created.job_id,
      passCode: created.pass_code,
      issuedAt: created.issued_at,
      expiresAt: created.expires_at,
      verifiedAt: created.verified_at,
      vehicleId: created.vehicle_id,
    },
    idempotent: false,
  });
}
