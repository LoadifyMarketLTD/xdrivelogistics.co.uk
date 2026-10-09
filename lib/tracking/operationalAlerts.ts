import type { SupabaseClient } from '@supabase/supabase-js';

import { getOrRefreshTrafficEta } from './trafficEta';

export type OperationalAlertJob = {
  id: string;
  company_id: string | null;
  current_status: string | null;
  status: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  pickup_postcode?: string | null;
  delivery_postcode?: string | null;
  delivery_datetime?: string | null;
  proximity_alerts_enabled?: boolean | null;
  pickup_proximity_alert_enabled?: boolean | null;
  delivery_proximity_alert_enabled?: boolean | null;
  pickup_alert_radius_miles?: number | null;
  delivery_alert_radius_miles?: number | null;
  smart_alert_in_app_enabled?: boolean | null;
  smart_alert_email_enabled?: boolean | null;
  smart_alert_push_enabled?: boolean | null;
};

const PICKUP_PROXIMITY_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup',
]);
const DELIVERY_PROXIMITY_STATUSES = new Set([
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery',
]);
const DELIVERY_ETA_STATUSES = new Set([
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);

const EARTH_RADIUS_MILES = 3958.7613;
const ETA_ALERT_MIN_LATE_MINUTES = 5;
const ETA_ALERT_COOLDOWN_MS = 15 * 60_000;
const ETA_ALERT_CHANGE_MINUTES = 10;

const statusOf = (job: Pick<OperationalAlertJob, 'current_status' | 'status'>) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

const toRadians = (degrees: number) => degrees * Math.PI / 180;

function distanceMiles(latA: number, lngA: number, latB: number, lngB: number) {
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function emitProximityAlert(
  admin: SupabaseClient,
  job: OperationalAlertJob,
  kind: 'pickup' | 'delivery',
  distance: number,
  radius: number,
  source: string,
) {
  const eventType = kind === 'pickup' ? 'pickup_proximity_alert' : 'delivery_proximity_alert';
  const message = kind === 'pickup'
    ? `Pickup proximity alert: the assigned vehicle is within ${radius} mile${radius === 1 ? '' : 's'} of collection.`
    : `Delivery proximity alert: the assigned vehicle is within ${radius} mile${radius === 1 ? '' : 's'} of delivery.`;

  await admin.rpc('fn_emit_job_operational_alert', {
    p_job_id: job.id,
    p_event_type: eventType,
    p_message: message,
    p_idempotency_suffix: kind === 'pickup' ? 'pickup-proximity' : 'delivery-proximity',
    p_extra_payload: {
      distance_miles: Number(distance.toFixed(2)),
      radius_miles: radius,
      location_type: kind,
      location_postcode: kind === 'pickup' ? job.pickup_postcode ?? null : job.delivery_postcode ?? null,
      source,
    },
  });
}

async function maybeCreateProximityAlerts(
  admin: SupabaseClient,
  job: OperationalAlertJob,
  lat: number,
  lng: number,
  source: string,
) {
  if (job.proximity_alerts_enabled !== true) return;
  const status = statusOf(job);

  if (
    job.pickup_proximity_alert_enabled !== false
    && PICKUP_PROXIMITY_STATUSES.has(status)
    && Number.isFinite(Number(job.pickup_lat))
    && Number.isFinite(Number(job.pickup_lng))
  ) {
    const radius = Number(job.pickup_alert_radius_miles ?? 1);
    const distance = distanceMiles(lat, lng, Number(job.pickup_lat), Number(job.pickup_lng));
    if (distance <= radius) await emitProximityAlert(admin, job, 'pickup', distance, radius, source);
  }

  if (
    job.delivery_proximity_alert_enabled !== false
    && DELIVERY_PROXIMITY_STATUSES.has(status)
    && Number.isFinite(Number(job.delivery_lat))
    && Number.isFinite(Number(job.delivery_lng))
  ) {
    const radius = Number(job.delivery_alert_radius_miles ?? 1);
    const distance = distanceMiles(lat, lng, Number(job.delivery_lat), Number(job.delivery_lng));
    if (distance <= radius) await emitProximityAlert(admin, job, 'delivery', distance, radius, source);
  }
}

async function maybeCreateEtaAlert(
  admin: SupabaseClient,
  job: OperationalAlertJob,
  lat: number,
  lng: number,
) {
  if (job.proximity_alerts_enabled !== true || !job.company_id || !DELIVERY_ETA_STATUSES.has(statusOf(job))) return;

  const eta = await getOrRefreshTrafficEta({
    admin,
    jobId: job.id,
    originLat: lat,
    originLng: lng,
    deliveryPostcode: job.delivery_postcode ?? null,
    plannedDeliveryAt: job.delivery_datetime ?? null,
  });
  if (!eta || eta.late_by_minutes == null || eta.late_by_minutes <= ETA_ALERT_MIN_LATE_MINUTES) return;

  const lateByMinutes = eta.late_by_minutes;
  const { data: latestAlert } = await admin
    .from('notification_events')
    .select('created_at, payload')
    .eq('event_type', 'tracking_eta_alert')
    .eq('entity_type', 'job')
    .eq('entity_id', job.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestAlert?.created_at) {
    const lastCreatedMs = new Date(latestAlert.created_at).getTime();
    const previousLateBy = Number((latestAlert.payload as Record<string, unknown> | null)?.late_by_minutes);
    const withinCooldown = Number.isFinite(lastCreatedMs) && Date.now() - lastCreatedMs < ETA_ALERT_COOLDOWN_MS;
    const materialChange = !Number.isFinite(previousLateBy)
      || Math.abs(lateByMinutes - previousLateBy) >= ETA_ALERT_CHANGE_MINUTES;
    if (withinCooldown && !materialChange) return;
  }

  const { data: recipients } = await admin
    .from('company_memberships')
    .select('user_id')
    .eq('company_id', job.company_id)
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .limit(100);
  const recipientIds = [...new Set((recipients ?? []).map((row) => String(row.user_id ?? '')).filter(Boolean))];
  if (!recipientIds.length) return;

  const payload = {
    job_id: job.id,
    eta_at: eta.eta_at,
    planned_delivery_at: job.delivery_datetime ?? null,
    late_by_minutes: lateByMinutes,
    message: `Traffic ETA alert: delivery is currently predicted about ${lateByMinutes} minutes after the planned delivery time.`,
    in_app_enabled: job.smart_alert_in_app_enabled !== false,
    email_enabled: job.smart_alert_email_enabled === true,
    push_enabled: job.smart_alert_push_enabled === true,
  };

  await admin.from('notification_events').insert(recipientIds.map((recipientUserId) => ({
    event_type: 'tracking_eta_alert',
    entity_type: 'job',
    entity_id: job.id,
    company_id: job.company_id,
    recipient_user_id: recipientUserId,
    payload,
    status: 'pending',
  })));
}

export async function maybeCreateOperationalLocationAlerts(
  admin: SupabaseClient,
  job: OperationalAlertJob,
  lat: number,
  lng: number,
  source: string,
) {
  await Promise.all([
    maybeCreateProximityAlerts(admin, job, lat, lng, source),
    maybeCreateEtaAlert(admin, job, lat, lng),
  ]);
}
