import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import type { TrackingEventType } from '../../../../../../../lib/types/database';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return {
    userId: authData.user.id,
    driverId: driverRow.id as string,
    companyId: driverRow.company_id as string,
  };
}

// Canonical driver execution actions → (new job status, tracking event type)
const ACTION_MAP: Record<
  string,
  { jobStatus: string; eventType: TrackingEventType; label: string }
> = {
  'on-my-way-pickup': {
    jobStatus: 'allocated',
    eventType: 'driver_en_route',
    label: 'Driver en route to pickup',
  },
  'arrived-pickup': {
    jobStatus: 'allocated',
    eventType: 'arrived_pickup',
    label: 'Driver arrived at pickup',
  },
  loaded: {
    jobStatus: 'collected',
    eventType: 'collected',
    label: 'Load collected',
  },
  'on-my-way-delivery': {
    jobStatus: 'in_transit',
    eventType: 'in_transit',
    label: 'In transit to delivery',
  },
  'arrived-delivery': {
    jobStatus: 'in_transit',
    eventType: 'arrived_delivery',
    label: 'Driver arrived at delivery',
  },
  delivered: {
    jobStatus: 'delivered',
    eventType: 'delivered',
    label: 'Job delivered',
  },
};

// Valid preceding statuses for each action (guard against out-of-order updates)
const PREREQUISITE_STATUS: Record<string, string[]> = {
  'on-my-way-pickup': ['awarded', 'allocated'],
  'arrived-pickup': ['allocated'],
  loaded: ['allocated'],
  'on-my-way-delivery': ['collected'],
  'arrived-delivery': ['in_transit'],
  delivered: ['in_transit'],
};

/**
 * POST /api/driver/mobile/jobs/[id]/status
 *
 * Body: { action: 'on-my-way-pickup' | 'arrived-pickup' | 'loaded' |
 *                  'on-my-way-delivery' | 'arrived-delivery' | 'delivered',
 *         note?: string }
 *
 * Atomically advances the job status and writes a tracking event.
 * The backend is the single source of truth — the mobile app just sends
 * the action; the server validates the transition.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  let body: { action?: string; note?: string };
  try {
    body = (await request.json()) as { action?: string; note?: string };
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { action, note } = body;

  if (!action || !ACTION_MAP[action]) {
    return respond(400, {
      error: `Unknown action "${action}". Valid actions: ${Object.keys(ACTION_MAP).join(', ')}.`,
    });
  }

  const transition = ACTION_MAP[action];
  const prerequisiteStatuses = PREREQUISITE_STATUS[action] ?? [];

  // Fetch the job — must belong to this driver
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, status, pod_required, pod_generated')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  // Guard: POD must be captured before marking as delivered
  if (action === 'delivered' && job.pod_required && !job.pod_generated) {
    return respond(409, {
      error: 'POD must be captured before marking the job as delivered.',
      code: 'POD_REQUIRED',
    });
  }

  // Guard: must be in a valid preceding status
  if (prerequisiteStatuses.length > 0 && !prerequisiteStatuses.includes(job.status as string)) {
    return respond(409, {
      error: `Cannot perform "${action}" when job status is "${job.status}". Expected: ${prerequisiteStatuses.join(', ')}.`,
      code: 'INVALID_TRANSITION',
    });
  }

  const now = new Date().toISOString();

  // Write tracking event
  const { error: eventError } = await supabaseAdmin
    .from('job_tracking_events')
    .insert({
      job_id: id,
      event_type: transition.eventType,
      message: note ?? transition.label,
      meta: { driver_id: driver.driverId, action },
      created_at: now,
    });

  if (eventError) return respond(500, { error: eventError.message });

  // Update job status
  const statusUpdate: Record<string, unknown> = {
    status: transition.jobStatus,
    current_status: transition.jobStatus,
    updated_at: now,
  };

  if (action === 'delivered') {
    statusUpdate.delivery_confirmed_at = now;
  }

  const { error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(statusUpdate)
    .eq('id', id);

  if (updateError) return respond(500, { error: updateError.message });

  return respond(200, {
    ok: true,
    job_id: id,
    action,
    new_status: transition.jobStatus,
    event_type: transition.eventType,
  });
}
