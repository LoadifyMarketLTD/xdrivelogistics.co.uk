import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { autoGenerateMarketplaceInvoice } from '../../../../_lib/autoGenerateMarketplaceInvoice';
import { assertCanonicalPodReady } from '../../../../_lib/pod';

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

const lifecycleStatusFor = (nextStatus: string, existingLifecycle: string | null) => {
  if (nextStatus === 'in_transit' || nextStatus === 'on_site_delivery') return 'in_transit';
  if (nextStatus === 'delivered' || nextStatus === 'completed') return 'delivered';
  if (['on_my_way', 'on_site_pickup', 'loaded'].includes(nextStatus)) {
    return ['awarded', 'allocated'].includes(String(existingLifecycle ?? '').toLowerCase())
      ? 'allocated'
      : existingLifecycle;
  }
  return existingLifecycle;
};

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

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
    .select('id, company_id, awarded_carrier_company_id, assigned_company_id, assigned_driver_id, status, current_status, status_history, pod_required, pod_generated, delivery_photos, pod_photos, delivery_signature_data, client_signature_name')
    .eq('id', id)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const operatingCompanyId = job.awarded_carrier_company_id ?? job.assigned_company_id ?? job.company_id;
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', operatingCompanyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher', 'finance'])
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

  if (parsed.data.nextStatus === 'delivered' || parsed.data.nextStatus === 'completed') {
    try {
      const podReady = await assertCanonicalPodReady(supabaseAdmin, id);
      if (!podReady.ok) return respond(409, { error: podReady.reason });
    } catch (reason) {
      return respond(503, {
        error: reason instanceof Error ? `POD validation failed: ${reason.message}` : 'POD validation failed.',
      });
    }
  }

  const now = new Date().toISOString();
  const history = Array.isArray(job.status_history) ? job.status_history : [];
  const nextLifecycleStatus = lifecycleStatusFor(parsed.data.nextStatus, job.status);
  const update: Record<string, unknown> = {
    status: nextLifecycleStatus,
    current_status: parsed.data.nextStatus,
    status_updated_at: now,
    updated_at: now,
    status_history: [
      ...history,
      {
        status: parsed.data.nextStatus,
        lifecycle_status: nextLifecycleStatus,
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

  let updateQuery = supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', id)
    .eq('status', job.status);
  updateQuery = job.current_status === null
    ? updateQuery.is('current_status', null)
    : updateQuery.eq('current_status', job.current_status);

  const { data: updated, error: updateError } = await updateQuery
    .select('id, status, current_status, assigned_driver_id, updated_at')
    .maybeSingle();
  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'Job changed while the transition was being saved. Refresh and retry.' });

  const { error: trackingError } = await supabaseAdmin.from('job_tracking_events').insert({
    job_id: id,
    event_type: eventType[parsed.data.nextStatus],
    created_by: authData.user.id,
    user_id: authData.user.id,
    message: parsed.data.note || `Operator changed status to ${parsed.data.nextStatus.replaceAll('_', ' ')}.`,
    meta: {
      source: 'operator_api',
      role: membership.role_in_company,
      lifecycle_status: nextLifecycleStatus,
    },
  });
  if (trackingError) {
    console.error('Job transition succeeded but tracking event insert failed:', trackingError.message);
  }

  if (
    parsed.data.nextStatus === 'delivered'
    && typeof job.awarded_carrier_company_id === 'string'
    && job.awarded_carrier_company_id
  ) {
    try {
      await autoGenerateMarketplaceInvoice({
        supabase: supabaseAdmin,
        jobId: id,
        supplierCompanyId: job.awarded_carrier_company_id,
        actorUserId: authData.user.id,
        idempotencyKey: `auto-pod-${id}`,
      });
    } catch (reason) {
      console.error(
        'Job transition succeeded but auto invoice generation failed:',
        reason instanceof Error ? reason.message : reason
      );
    }
  }

  return respond(200, { success: true, job: updated });
}
