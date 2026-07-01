import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };

type DispatchPayload = {
  driverId?: string;
  vehicleId?: string | null;
};

const DISPATCH_ROLES = new Set(['owner', 'admin', 'dispatcher']);

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not available — admin client not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — no bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Unauthorized — invalid token.' });

  const { id: jobId } = await params;
  if (!jobId) return json(400, { error: 'Missing job id.' });

  const payload = (await request.json().catch(() => null)) as DispatchPayload | null;
  if (!payload?.driverId) return json(400, { error: 'driverId is required.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, status, assigned_driver_id, status_history')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError || !job) return json(404, { error: 'Job not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('user_id', user.id)
    .eq('company_id', job.company_id as string)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership || !DISPATCH_ROLES.has(membership.role_in_company as string | null)) {
    return json(403, { error: 'Forbidden — insufficient role to dispatch jobs.' });
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, company_id, status')
    .eq('id', payload.driverId)
    .maybeSingle();

  if (driverError || !driver) return json(404, { error: 'Driver not found.' });
  if (driver.company_id !== job.company_id) return json(403, { error: 'Driver is not part of this company.' });
  if (['rejected', 'suspended', 'inactive'].includes((driver.status as string | null) ?? '')) {
    return json(400, { error: 'Driver is not eligible for dispatch.' });
  }

  if (payload.vehicleId) {
    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('vehicles')
      .select('id, company_id')
      .eq('id', payload.vehicleId)
      .maybeSingle();
    if (vehicleError || !vehicle) return json(404, { error: 'Vehicle not found.' });
    if (vehicle.company_id !== job.company_id) return json(403, { error: 'Vehicle is not part of this company.' });

    await supabaseAdmin
      .from('vehicles')
      .update({ assigned_driver_id: driver.id })
      .eq('id', payload.vehicleId);
  }

  const now = new Date().toISOString();
  const statusHistory = Array.isArray(job.status_history) ? job.status_history : [];
  const normalizedStatus = (job.status as string | null) ?? 'posted';

  const { error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({
      assigned_driver_id: driver.id,
      status: ['awarded', 'allocated', 'collected', 'in_transit', 'delivered', 'invoiced', 'paid']
        .includes(normalizedStatus)
        ? normalizedStatus
        : 'allocated',
      status_history: [
        ...statusHistory,
        {
          status: 'allocated',
          timestamp: now,
          assigned_driver_id: driver.id,
          assigned_by: user.id,
          vehicle_id: payload.vehicleId ?? null,
        },
      ],
      updated_at: now,
    })
    .eq('id', jobId);

  if (updateError) return json(500, { error: `Failed to dispatch job: ${updateError.message}` });

  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    created_by: user.id,
    event_type: 'allocated',
    message: payload.vehicleId
      ? 'Job dispatched to driver and vehicle.'
      : 'Job dispatched to driver.',
    meta: {
      assigned_driver_id: driver.id,
      assigned_driver_user_id: driver.user_id,
      vehicle_id: payload.vehicleId ?? null,
      assigned_by_user_id: user.id,
      assigned_at: now,
    },
  });

  return json(200, {
    success: true,
    jobId,
    assignedDriverId: driver.id,
    vehicleId: payload.vehicleId ?? null,
  });
}
