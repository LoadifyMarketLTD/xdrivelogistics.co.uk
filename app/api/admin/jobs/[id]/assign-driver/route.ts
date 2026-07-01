import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import {
  ASSIGNABLE_JOB_STATUSES,
  PRE_ALLOCATION_JOB_STATUSES,
} from '../../../../../../lib/jobAssignment';

type Params = { params: Promise<{ id: string }> };

const json = (status: number, body: unknown) =>
  NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  // ── 0. Service availability ──────────────────────────────────────────────
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not available — admin client not configured.' });
  }

  // ── 1. Authenticate caller ───────────────────────────────────────────────
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — no bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Unauthorized — invalid token.' });

  // ── 2. Parse job id & request body ──────────────────────────────────────
  const { id: jobId } = await params;
  if (!jobId) return json(400, { error: 'Bad request — missing job id.' });

  let driverIdInput: unknown;
  let vehicleIdInput: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    driverIdInput = body.driver_id;
    vehicleIdInput = body.vehicle_id;
  } catch {
    return json(400, { error: 'Bad request — invalid JSON body.' });
  }

  if (typeof driverIdInput !== 'string' || !driverIdInput.trim()) {
    return json(400, { error: 'Bad request — driver_id is required.' });
  }
  const driverId = driverIdInput.trim();
  const vehicleId =
    typeof vehicleIdInput === 'string' && vehicleIdInput.trim()
      ? vehicleIdInput.trim()
      : null;

  // ── 3. Fetch job and verify it exists ────────────────────────────────────
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, status, company_id, assigned_company_id, awarded_carrier_company_id, assigned_driver_id',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return json(500, { error: `Failed to fetch job: ${jobError.message}` });
  if (!job) return json(404, { error: 'Job not found.' });

  // ── 4. Resolve the carrier company id the caller must belong to ──────────
  // Priority: awarded_carrier_company_id → assigned_company_id → company_id
  const candidateCompanyIds = [
    job.awarded_carrier_company_id as string | null,
    job.assigned_company_id as string | null,
    job.company_id as string | null,
  ].filter((id): id is string => Boolean(id));

  if (candidateCompanyIds.length === 0) {
    return json(403, { error: 'Forbidden — job has no associated company.' });
  }

  // ── 5. Verify caller belongs to one of those companies ───────────────────
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, company_id, role_in_company, companies!inner(status)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('company_id', candidateCompanyIds)
    .maybeSingle();

  if (membershipError) {
    return json(500, { error: `Failed to verify membership: ${membershipError.message}` });
  }
  if (!membership) {
    return json(403, { error: 'Forbidden — you are not an active member of the job company.' });
  }

  const companiesRel = membership.companies as { status?: string } | { status?: string }[] | null;
  const companyStatus = Array.isArray(companiesRel)
    ? companiesRel[0]?.status
    : companiesRel?.status;
  if (companyStatus !== 'active') {
    return json(403, { error: 'Forbidden — your company is not active.' });
  }

  const callerCompanyId: string = membership.company_id;

  // ── 6. Verify job status is assignable ──────────────────────────────────
  const normalizedStatus = (job.status as string || '').toLowerCase();
  if (!ASSIGNABLE_JOB_STATUSES.has(normalizedStatus)) {
    return json(409, {
      error: `Job is not in an assignable status (current: ${job.status}). Must be one of: ${[...ASSIGNABLE_JOB_STATUSES].join(', ')}.`,
    });
  }

  // ── 7. Verify driver belongs to caller's company & is active ────────────
  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status, display_name, user_id')
    .eq('id', driverId)
    .maybeSingle();

  if (driverError) return json(500, { error: `Failed to fetch driver: ${driverError.message}` });
  if (!driver) return json(404, { error: 'Driver not found.' });

  if (driver.company_id !== callerCompanyId) {
    return json(403, {
      error: 'Forbidden — driver does not belong to your company workspace.',
    });
  }

  const driverStatus = (driver.status as string | null) ?? '';
  if (driverStatus && !['active', 'available'].includes(driverStatus.toLowerCase())) {
    return json(409, {
      error: `Driver is not active/available (current status: ${driver.status}).`,
    });
  }

  // ── 8. Compute next job status ───────────────────────────────────────────
  const nextStatus = PRE_ALLOCATION_JOB_STATUSES.has(normalizedStatus) ? 'allocated' : job.status;
  const now = new Date().toISOString();

  // ── 9. Update job ────────────────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = {
    assigned_driver_id: driverId,
    status: nextStatus,
    current_status: nextStatus,
    updated_at: now,
    ...(job.assigned_company_id !== callerCompanyId && {
      assigned_company_id: callerCompanyId,
    }),
    ...(vehicleId ? { assigned_vehicle_id: vehicleId } : {}),
  };

  const { error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(updatePayload)
    .eq('id', jobId);

  if (updateError) {
    return json(500, { error: `Failed to update job: ${updateError.message}` });
  }

  // ── 10. Create job tracking event ────────────────────────────────────────
  const { error: trackingError } = await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    created_by: user.id,
    event_type: 'driver_assigned',
    message: `Driver ${driver.display_name as string} assigned to job.`,
    meta: {
      assigned_driver_id: driverId,
      assigned_by: user.id,
      assigned_at: now,
      previous_status: job.status,
      new_status: nextStatus,
      assigned_company_id: callerCompanyId,
      ...(vehicleId ? { assigned_vehicle_id: vehicleId } : {}),
    },
  });

  if (trackingError) {
    console.error('[assign-driver] Failed to write job_tracking_events:', trackingError.message);
  }

  // ── 11. Create notification event for driver ─────────────────────────────
  const { error: notificationError } = await supabaseAdmin.from('notification_events').insert({
    event_type: 'driver_assigned',
    entity_type: 'job',
    entity_id: jobId,
    company_id: callerCompanyId,
    recipient_user_id: driver.user_id ?? null,
    payload: {
      job_id: jobId,
      driver_id: driverId,
      driver_name: driver.display_name,
      assigned_by: user.id,
      assigned_at: now,
      new_status: nextStatus,
      ...(vehicleId ? { assigned_vehicle_id: vehicleId } : {}),
    },
  });

  if (notificationError) {
    console.error('[assign-driver] Failed to write notification_events:', notificationError.message);
  }

  return json(200, {
    success: true,
    jobId,
    driverId,
    newStatus: nextStatus,
    assignedCompanyId: callerCompanyId,
    ...(vehicleId ? { vehicleId } : {}),
  });
}
