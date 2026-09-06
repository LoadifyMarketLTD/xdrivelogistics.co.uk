import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatedSessionId(token: string): string | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof payload.session_id === 'string' && UUID_RE.test(payload.session_id)
      ? payload.session_id
      : null;
  } catch {
    return null;
  }
}

function localPreviewDeviceBypass(request: NextRequest) {
  if (process.env.XDRIVE_LOCAL_PREVIEW_DEVICE_BYPASS !== 'true') return false;
  const hostname = request.nextUrl.hostname.toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

async function enforceActiveNativeDeviceBinding(
  request: NextRequest,
  token: string,
  userId: string,
  driverId: string,
): Promise<NextResponse | null> {
  if (localPreviewDeviceBypass(request)) return null;
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const authSessionId = validatedSessionId(token);
  if (!authSessionId) return respond(401, { error: 'Authenticated session identity is required.' });

  const [{ data: activeBinding, error: bindingError }, { data: nativeHistory, error: historyError }] = await Promise.all([
    supabaseAdmin
      .from('driver_mobile_device_sessions')
      .select('installation_id, auth_session_id')
      .eq('user_id', userId)
      .eq('driver_id', driverId)
      .eq('enabled', true)
      .is('revoked_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('driver_mobile_device_sessions')
      .select('installation_id')
      .eq('user_id', userId)
      .eq('driver_id', driverId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (bindingError || historyError) return respond(500, { error: 'Mobile device session validation failed.' });

  if (!activeBinding) {
    if (nativeHistory) return respond(401, { error: 'No active native device session is authorised.' });
    return null;
  }

  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  if (!UUID_RE.test(installationId)) return respond(401, { error: 'Active native device identity is required.' });

  if (String(activeBinding.installation_id) !== installationId || String(activeBinding.auth_session_id) !== authSessionId) {
    return respond(401, { error: 'This mobile session has been revoked or replaced by another device.' });
  }

  void supabaseAdmin
    .from('driver_mobile_device_sessions')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('installation_id', installationId)
    .eq('auth_session_id', authSessionId);

  return null;
}

export type DriverContext = {
  userId: string;
  driverId: string;
  companyId: string;
  driverType: string | null;
  canCommercialBid: boolean;
};

export type MobileJobRow = {
  id: string;
  status: string | null;
  current_status: string | null;
  assigned_driver_id: string | null;
  company_id: string | null;
  awarded_carrier_company_id: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  budget_amount: number | string | null;
  agreed_rate: number | string | null;
  agreed_rate_gbp: number | string | null;
  collection_contact_name: string | null;
  collection_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_signature_name: string | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
  delivery_photos: string[] | null;
  pod_photos: string[] | null;
  delivery_signature_data: unknown;
  status_history: unknown;
  updated_at: string | null;
  created_at: string | null;
};

export async function requireDriver(request: NextRequest): Promise<DriverContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const authClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const [{ data: driverRow, error: driverError }, { data: profileRow, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id, company_id, user_id, app_access, status, driver_type, can_commercial_bid')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (driverError) return respond(500, { error: driverError.message });
  if (profileError) return respond(500, { error: profileError.message });
  if (!profileRow) return respond(403, { error: 'Driver profile not found.' });
  if (!driverRow) return respond(403, { error: 'Driver record not found.' });
  if (driverRow.app_access !== true) return respond(403, { error: 'Driver app access has not been approved.' });
  if (String(profileRow.status ?? '').trim().toLowerCase() !== 'active') return respond(403, { error: 'Driver profile is not active.' });
  if (String(driverRow.status ?? '').trim().toLowerCase() !== 'active') return respond(403, { error: 'Driver account is not active.' });

  const driverId = String(driverRow.id);
  const deviceGate = await enforceActiveNativeDeviceBinding(request, token, authData.user.id, driverId);
  if (deviceGate) return deviceGate;

  const companyId = String(driverRow.company_id ?? '').trim();
  if (!companyId) return respond(403, { error: 'Driver company membership is required.' });

  return {
    userId: authData.user.id,
    driverId,
    companyId,
    driverType: typeof driverRow.driver_type === 'string' ? driverRow.driver_type : null,
    canCommercialBid: driverRow.can_commercial_bid === true,
  };
}

export function isDriverContext(value: DriverContext | NextResponse): value is DriverContext {
  return !(value instanceof NextResponse);
}

export const jobSelect = [
  'id',
  'status',
  'current_status',
  'assigned_driver_id',
  'company_id',
  'awarded_carrier_company_id',
  'pickup_location',
  'delivery_location',
  'pickup_datetime',
  'delivery_datetime',
  'vehicle_type',
  'requested_vehicle_type',
  'requested_vehicle_label',
  'cargo_type',
  'requested_cargo_label',
  'budget_amount',
  'agreed_rate',
  'agreed_rate_gbp',
  'collection_contact_name',
  'collection_contact_phone',
  'delivery_contact_name',
  'delivery_contact_phone',
  'client_name',
  'client_phone',
  'client_signature_name',
  'load_details',
  'special_requirements',
  'access_restrictions',
  'pod_required',
  'pod_generated',
  'delivery_photos',
  'pod_photos',
  'delivery_signature_data',
  'status_history',
  'updated_at',
  'created_at',
].join(',');

export function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function appendStatusHistory(existingHistory: unknown, entry: Record<string, unknown>) {
  if (Array.isArray(existingHistory)) return [...existingHistory.filter((item) => item && typeof item === 'object'), entry];
  return [entry];
}

export function hasPod(job: Pick<MobileJobRow, 'delivery_photos' | 'delivery_signature_data' | 'client_signature_name' | 'pod_generated'>) {
  return Boolean(job.pod_generated)
    && safeArray(job.delivery_photos).length > 0
    && Boolean(job.delivery_signature_data)
    && Boolean(String(job.client_signature_name ?? '').trim());
}

export function toMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Price TBC';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
}

export function mobileStatus(job: Pick<MobileJobRow, 'status' | 'current_status'>) {
  const current = String(job.current_status || job.status || 'awarded').trim().toLowerCase();
  if (['cancelled', 'canceled'].includes(current)) return 'cancelled';
  if (['assigned', 'accepted', 'allocated'].includes(current)) return 'awarded';
  if (['on_my_way', 'on_my_way_to_pickup'].includes(current)) return 'on_my_way_pickup';
  if (['on_site_pickup', 'arrived_pickup'].includes(current)) return 'arrived_pickup';
  if (['collected', 'loaded'].includes(current)) return 'loaded';
  if (['in_transit', 'on_route_delivery', 'on_my_way_to_delivery'].includes(current)) return 'on_my_way_delivery';
  if (['on_site_delivery', 'arrived_delivery'].includes(current)) return 'arrived_delivery';
  if (['delivered', 'completed', 'invoiced', 'paid'].includes(current)) return 'delivered';
  return current;
}

export function mapJob(row: MobileJobRow) {
  const contactName = row.delivery_contact_name || row.collection_contact_name || row.client_name || undefined;
  const contactPhone = row.delivery_contact_phone || row.collection_contact_phone || row.client_phone || undefined;
  return {
    id: row.id,
    reference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    status: mobileStatus(row),
    lifecycleStatus: row.status,
    pickupLocation: row.pickup_location || 'Pickup TBC',
    deliveryLocation: row.delivery_location || 'Delivery TBC',
    pickupTime: row.pickup_datetime || 'Pickup time TBC',
    deliveryTime: row.delivery_datetime || 'Delivery time TBC',
    cargoType: row.requested_cargo_label || row.cargo_type || 'Cargo TBC',
    vehicleRequirement: row.requested_vehicle_label || row.requested_vehicle_type || row.vehicle_type || 'Vehicle TBC',
    price: toMoney(row.agreed_rate_gbp ?? row.agreed_rate ?? row.budget_amount),
    priority: ['delayed', 'disputed', 'failed'].includes(String(row.status ?? '').toLowerCase()) ? 'high' : 'normal',
    podRequired: row.pod_required !== false,
    podGenerated: hasPod(row),
    contactAllowed: Boolean(contactPhone),
    contactName,
    contactPhone,
    requirements: [row.load_details, row.special_requirements, row.access_restrictions].filter(Boolean).join('\n'),
    updatedAt: row.updated_at,
  };
}

export async function insertTrackingEvent(jobId: string, userId: string, eventType: string, note: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    created_by: userId,
    event_type: eventType,
    note,
  });
}
