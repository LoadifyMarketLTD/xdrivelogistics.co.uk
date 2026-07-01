import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';

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

/**
 * GET /api/driver/mobile/jobs/[id]
 *
 * Returns full detail of a single job that belongs to the authenticated driver.
 * Includes tracking events for the execution timeline.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select(
      `id, status, current_status,
       pickup_location, pickup_datetime, pickup_contact_name, pickup_contact_phone,
       pickup_lat, pickup_lng,
       delivery_location, delivery_datetime, delivery_contact_name, delivery_contact_phone,
       delivery_lat, delivery_lng,
       vehicle_type, cargo_type, load_details,
       budget_amount, currency,
       pod_required, pod_generated,
       pod_photos, delivery_photos,
       status_history,
       assigned_driver_id,
       awarded_carrier_company_id,
       company_id,
       direct_invite_company_id,
       special_instructions,
       updated_at, created_at`
    )
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  // Fetch tracking events for the execution timeline
  const { data: events } = await supabaseAdmin
    .from('job_tracking_events')
    .select('id, event_type, message, meta, created_at')
    .eq('job_id', id)
    .order('created_at', { ascending: true });

  return respond(200, { job, tracking_events: events ?? [] });
}
