import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const bodySchema = z.object({
  nextStatus: z.enum([
    'on_my_way',
    'on_site_pickup',
    'loaded',
    'in_transit',
    'on_site_delivery',
    'delivered',
    'completed',
  ]),
  expectedStatus: z.string().trim().optional(),
  note: z.string().trim().max(1000).optional(),
});

const transitions: Record<string, string> = {
  awarded: 'on_my_way',
  allocated: 'on_my_way',
  on_my_way: 'on_site_pickup',
  on_site_pickup: 'loaded',
  loaded: 'in_transit',
  collected: 'in_transit',
  in_transit: 'on_site_delivery',
  on_site_delivery: 'delivered',
  delivered: 'completed',
};

const timestampField: Record<string, string | undefined> = {
  on_my_way: 'on_my_way_at',
  on_site_pickup: 'on_site_pickup_at',
  loaded: 'loaded_at',
  on_site_delivery: 'on_site_delivery_at',
  delivered: 'delivered_at',
  completed: 'completed_at',
};

const eventType: Record<string, string> = {
  on_my_way: 'driver_en_route',
  on_site_pickup: 'arrived_pickup',
  loaded: 'collected',
  in_transit: 'in_transit',
  on_site_delivery: 'arrived_delivery',
  delivered: 'delivered',
  completed: 'note',
};

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const hasPod = (job: Record<string, unknown>) => {
  const photos = Array.isArray(job.delivery_photos) ? job.delivery_photos : [];
  const pod = Array.isArray(job.pod_photos) ? job.pod_photos : [];
  return Boolean(
    job.pod_generated ||
    photos.length > 0 ||
    pod.length > 0 ||
    job.delivery_signature_data ||
    job.client_signature_name
  );
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid transition request.' });

  const { id } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, assigned_driver_id, status, current_status, status_history, pod_required, pod_generated, delivery_photos, pod_photos, delivery_signature_data, client_signature_name')
    .eq('id', id)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const operatingCompanyId = job.awarded_carrier_company_id ?? job.company_id;
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', operatingCompanyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });
  if (!membership) return respond(403, { error: 'Only an operator of the executing company may update this job.' });

  const currentStatus = String(job.current_status ?? job.status ?? '').toLowerCase();
  if (parsed.data.expectedStatus && currentStatus !== parsed.data.expectedStatus.toLowerCase()) {
    return respond(409, { error: `Job status changed to ${currentStatus}. Refresh before continuing.` });
  }
  const expectedNext = transitions[currentStatus];
  if (expectedNext !== parsed.data.nextStatus) {
    return respond(409, { error: `Invalid transition: ${currentStatus} → ${parsed.data.nextStatus}. Expected ${expectedNext ?? 'no further action'}.` });
  }
  if (!job.assigned_driver_id) {
    return respond(409, { error: 'Assign an approved driver before starting job execution.' });
  }
  if (parsed.data.nextStatus === 'delivered' && job.pod_required !== false && !hasPod(job as Record<string, unknown>)) {
    return respond(409, { error: 'POD is required before the job can be marked delivered.' });
  }

  const now = new Date().toISOString();
  const history = Array.isArray(job.status_history) ? job.status_history : [];
  const update: Record<string, unknown> = {
    status: parsed.data.nextStatus,
    current_status: parsed.data.nextStatus,
    status_updated_at: now,
    updated_at: now,
    status_history: [
      ...history,
      {
        status: parsed.data.nextStatus,
        label: parsed.data.nextStatus.replaceAll('_', ' '),
        timestamp: now,
        actor_user_id: authData.user.id,
        source: 'operator_api',
        note: parsed.data.note ?? null,
      },
    ],
  };
  const field = timestampField[parsed.data.nextStatus];
  if (field) update[field] = now;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', id)
    .eq('status', job.status)
    .select('id, status, current_status, assigned_driver_id, updated_at')
    .maybeSingle();
  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'Job changed while the transition was being saved. Refresh and retry.' });

  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: id,
    event_type: eventType[parsed.data.nextStatus],
    created_by: authData.user.id,
    message: parsed.data.note || `Operator changed status to ${parsed.data.nextStatus.replaceAll('_', ' ')}.`,
  });

  return respond(200, { success: true, job: updated });
}
