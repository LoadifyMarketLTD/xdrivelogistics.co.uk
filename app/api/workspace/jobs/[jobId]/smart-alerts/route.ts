import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ jobId: string }> };

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const patchSchema = z.object({
  enabled: z.boolean(),
  pickupProximityEnabled: z.boolean(),
  deliveryProximityEnabled: z.boolean(),
  pickupRadiusMiles: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  deliveryRadiusMiles: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
  onSitePickupEnabled: z.boolean(),
  loadedEnabled: z.boolean(),
  onSiteDeliveryEnabled: z.boolean(),
  podSubmittedEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
});

const MANAGE_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager']);

const JOB_ALERT_SELECT = [
  'id',
  'company_id',
  'proximity_alerts_enabled',
  'pickup_proximity_alert_enabled',
  'delivery_proximity_alert_enabled',
  'pickup_alert_radius_miles',
  'delivery_alert_radius_miles',
  'alert_on_site_pickup_enabled',
  'alert_loaded_enabled',
  'alert_on_site_delivery_enabled',
  'alert_pod_submitted_enabled',
  'smart_alert_in_app_enabled',
  'smart_alert_email_enabled',
  'smart_alert_push_enabled',
  'smart_alerts_updated_at',
].join(',');

function mapPreferences(row: Record<string, unknown>) {
  return {
    enabled: row.proximity_alerts_enabled === true,
    pickupProximityEnabled: row.pickup_proximity_alert_enabled !== false,
    deliveryProximityEnabled: row.delivery_proximity_alert_enabled !== false,
    pickupRadiusMiles: Number(row.pickup_alert_radius_miles ?? 1),
    deliveryRadiusMiles: Number(row.delivery_alert_radius_miles ?? 1),
    onSitePickupEnabled: row.alert_on_site_pickup_enabled !== false,
    loadedEnabled: row.alert_loaded_enabled !== false,
    onSiteDeliveryEnabled: row.alert_on_site_delivery_enabled !== false,
    podSubmittedEnabled: row.alert_pod_submitted_enabled !== false,
    inAppEnabled: row.smart_alert_in_app_enabled !== false,
    emailEnabled: row.smart_alert_email_enabled === true,
    pushEnabled: row.smart_alert_push_enabled === true,
  };
}

async function loadContext(request: NextRequest, jobId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: respond(503, { error: 'Smart Alerts are temporarily unavailable.' }) };
  }

  const token = getBearerToken(request);
  if (!token) return { error: respond(401, { error: 'Unauthorized.' }) };

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return { error: respond(401, { error: 'Unauthorized.' }) };

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(JOB_ALERT_SELECT)
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return { error: respond(500, { error: 'Booking could not be loaded.' }) };
  const jobRecord = job as unknown as Record<string, unknown> | null;
  if (!jobRecord?.company_id) return { error: respond(404, { error: 'Booking not found.' }) };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', String(jobRecord.company_id))
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return { error: respond(503, { error: 'Smart Alert authority could not be verified.' }) };
  if (!membership) return { error: respond(403, { error: 'Smart Alerts are managed by the booking owner company.' }) };

  const role = String(membership.role_in_company ?? '').trim().toLowerCase();
  return {
    userId: authData.user.id,
    companyId: String(jobRecord.company_id),
    canManage: MANAGE_ROLES.has(role),
    job: jobRecord,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  if (!jobId) return respond(400, { error: 'jobId is required.' });

  const ctx = await loadContext(request, jobId);
  if ('error' in ctx) return ctx.error;

  return respond(200, {
    preferences: mapPreferences(ctx.job),
    configured: Boolean(ctx.job.smart_alerts_updated_at),
    canManage: ctx.canManage,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  if (!jobId) return respond(400, { error: 'jobId is required.' });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid Smart Alert preferences.' });

  if (parsed.data.enabled && !parsed.data.inAppEnabled && !parsed.data.emailEnabled && !parsed.data.pushEnabled) {
    return respond(400, { error: 'Enable at least one Smart Alert delivery channel.' });
  }

  const ctx = await loadContext(request, jobId);
  if ('error' in ctx) return ctx.error;
  if (!ctx.canManage) return respond(403, { error: 'This role cannot manage Smart Alerts.' });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin!
    .from('jobs')
    .update({
      proximity_alerts_enabled: parsed.data.enabled,
      pickup_proximity_alert_enabled: parsed.data.pickupProximityEnabled,
      delivery_proximity_alert_enabled: parsed.data.deliveryProximityEnabled,
      pickup_alert_radius_miles: parsed.data.pickupRadiusMiles,
      delivery_alert_radius_miles: parsed.data.deliveryRadiusMiles,
      alert_on_site_pickup_enabled: parsed.data.onSitePickupEnabled,
      alert_loaded_enabled: parsed.data.loadedEnabled,
      alert_on_site_delivery_enabled: parsed.data.onSiteDeliveryEnabled,
      alert_pod_submitted_enabled: parsed.data.podSubmittedEnabled,
      smart_alert_in_app_enabled: parsed.data.inAppEnabled,
      smart_alert_email_enabled: parsed.data.emailEnabled,
      smart_alert_push_enabled: parsed.data.pushEnabled,
      smart_alerts_updated_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('company_id', ctx.companyId)
    .select(JOB_ALERT_SELECT)
    .maybeSingle();

  if (error) return respond(500, { error: 'Smart Alert preferences could not be saved.' });
  if (!data) return respond(409, { error: 'Booking changed while Smart Alerts were being saved. Refresh and retry.' });

  const { error: auditError } = await supabaseAdmin!.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: 'note',
    created_by: ctx.userId,
    message: parsed.data.enabled ? 'Smart / Pro Alerts updated.' : 'Smart / Pro Alerts disabled.',
    meta: { kind: 'smart_alerts_updated', enabled: parsed.data.enabled },
  });

  const updatedRecord = data as unknown as Record<string, unknown>;
  return respond(200, {
    preferences: mapPreferences(updatedRecord),
    configured: true,
    canManage: true,
    auditWarning: auditError ? 'Smart Alerts were saved, but the audit event could not be recorded.' : null,
  });
}
