import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isMissingDriverCommercialColumn = (
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
): boolean => {
  if (!error || error.code !== '42703') return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('driver_type') || text.includes('can_commercial_bid');
};

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

async function enforceActiveNativeDeviceBinding(
  request: NextRequest,
  token: string,
  userId: string,
  driverId: string,
): Promise<NextResponse | null> {
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

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

  if (bindingError || historyError) {
    return respond(500, { error: 'Mobile device session validation failed.' });
  }

  // Legacy compatibility ends permanently after this driver completes the first
  // native-device registration. If that registered session is later logged out or
  // revoked, an old JWT must not regain access merely because there is no active
  // row left. Only drivers with no native-session history may use the legacy path.
  if (!activeBinding) {
    if (nativeHistory) return respond(401, { error: 'No active native device session is authorised.' });
    return null;
  }

  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  const authSessionId = validatedSessionId(token);
  if (!UUID_RE.test(installationId) || !authSessionId) {
    return respond(401, { error: 'Active native device identity is required.' });
  }

  if (
    String(activeBinding.installation_id) !== installationId ||
    String(activeBinding.auth_session_id) !== authSessionId
  ) {
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
  companyId: string | null;
  driverStatus: string;
  appAccess: boolean;
  driverType: string | null;
  canCommercialBid: boolean;
  companyStatus: string | null;
};

export type MobileJobRow = {
  id: string;
  status: string | null;
  current_status: string | null;
  assigned_driver_id: string | null;
  company_id: string | null;
  awarded_carrier_company_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  distance_miles: number | string | null;
  job_distance_miles: number | string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  agreed_rate: number | string | null;
  agreed_rate_gbp: number | string | null;
  collection_contact_name: string | null;
  collection_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  client_name: string | null;
  client_phone: string | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
  collection_photo_url: string | null;
  delivery_photos: string[] | null;
  pod_photos: string[] | null;
  delivery_signature_data: unknown;
  client_signature_name: string | null;
  status_history: unknown;
  updated_at: string | null;
  created_at: string | null;
};

export async function requireDriver(
  request: NextRequest,
  options: { requireOperationallyActive?: boolean } = {},
): Promise<DriverContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const [{ data: driverInitialRow, error: driverInitialError }, { data: profileRow, error: profileError }] = await Promise.all([
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

  const useLegacyDriverFallback = isMissingDriverCommercialColumn(driverInitialError);
  const { data: driverLegacyRow, error: driverLegacyError } = useLegacyDriverFallback
    ? await supabaseAdmin
        .from('drivers')
        .select('id, company_id, user_id, app_access, status')
        .eq('user_id', authData.user.id)
        .maybeSingle()
    : { data: null, error: null };
  const driverRow = useLegacyDriverFallback
    ? (driverLegacyRow ? { ...driverLegacyRow, driver_type: null, can_commercial_bid: false } : null)
    : driverInitialRow;
  const driverError = useLegacyDriverFallback ? driverLegacyError : driverInitialError;

  if (driverError) return respond(500, { error: driverError.message });
  if (profileError) return respond(500, { error: profileError.message });
  if (!profileRow) return respond(403, { error: 'Driver profile not found.' });
  if (!driverRow) return respond(403, { error: 'Driver record not found.' });
  if (driverRow.app_access !== true) {
    return respond(403, { error: 'Driver app access has not been approved.' });
  }

  const profileStatus = String(profileRow.status ?? '').trim().toLowerCase();
  const driverStatus = String(driverRow.status ?? '').trim().toLowerCase();
  if (options.requireOperationallyActive !== false) {
    if (profileStatus !== 'active') {
      return respond(403, { error: 'Driver profile is not active.' });
    }
    if (driverStatus !== 'active') {
      return respond(403, { error: 'Driver account is not active.' });
    }
  }

  const driverId = String(driverRow.id);
  const deviceGate = await enforceActiveNativeDeviceBinding(
    request,
    token,
    authData.user.id,
    driverId,
  );
  if (deviceGate) return deviceGate;

  const companyId = typeof driverRow.company_id === 'string' && driverRow.company_id.trim().length > 0
    ? driverRow.company_id.trim()
    : null;
  let companyStatus: string | null = null;
  if (companyId) {
    const { data: companyRow, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('status')
      .eq('id', companyId)
      .maybeSingle();
    if (companyError) return respond(500, { error: companyError.message });
    companyStatus = String(companyRow?.status ?? '').trim().toLowerCase() || null;
  }

  return {
    userId: authData.user.id,
    driverId,
    companyId,
    driverStatus,
    appAccess: driverRow.app_access === true,
    driverType: typeof driverRow.driver_type === 'string' ? driverRow.driver_type : null,
    canCommercialBid: driverRow.can_commercial_bid === true,
    companyStatus,
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
  'pickup_postcode',
  'delivery_location',
  'delivery_postcode',
  'pickup_datetime',
  'delivery_datetime',
  'distance_miles',
  'job_distance_miles',
  'vehicle_type',
  'requested_vehicle_type',
  'requested_vehicle_label',
  'cargo_type',
  'requested_cargo_label',
  'agreed_rate',
  'agreed_rate_gbp',
  'collection_contact_name',
  'collection_contact_phone',
  'delivery_contact_name',
  'delivery_contact_phone',
  'client_name',
  'client_phone',
  'load_details',
  'special_requirements',
  'access_restrictions',
  'pod_required',
  'pod_generated',
  'collection_photo_url',
  'delivery_photos',
  'pod_photos',
  'delivery_signature_data',
  'client_signature_name',
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

export function hasPod(job: Pick<MobileJobRow, 'delivery_photos' | 'pod_photos' | 'delivery_signature_data' | 'pod_generated'>) {
  return Boolean(job.pod_generated) || safeArray(job.delivery_photos).length > 0 || safeArray(job.pod_photos).length > 0 || Boolean(job.delivery_signature_data);
}

export function toMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Price TBC';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
}

export function mobileStatus(job: Pick<MobileJobRow, 'status' | 'current_status'>) {
  const current = String(job.current_status || job.status || 'awarded').toLowerCase();
  if (current === 'on_my_way') return 'on_my_way_pickup';
  if (current === 'on_site_pickup') return 'arrived_pickup';
  if (current === 'on_site_delivery') return 'arrived_delivery';
  if (current === 'in_transit') return 'on_my_way_delivery';
  if (current === 'allocated') return 'awarded';
  return current;
}

export function mapJob(row: MobileJobRow) {
  const contactName = row.delivery_contact_name || row.collection_contact_name || row.client_name || undefined;
  const contactPhone = row.delivery_contact_phone || row.collection_contact_phone || row.client_phone || undefined;
  const distance = Number(row.distance_miles ?? row.job_distance_miles ?? 0);
  const agreedRateAmount = Number(row.agreed_rate_gbp ?? row.agreed_rate ?? 0) || null;
  return {
    id: row.id,
    reference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    status: mobileStatus(row),
    lifecycleStatus: row.status,
    currentStatus: row.current_status,
    pickupLocation: row.pickup_location || 'Pickup TBC',
    pickupPostcode: row.pickup_postcode || '',
    deliveryLocation: row.delivery_location || 'Delivery TBC',
    deliveryPostcode: row.delivery_postcode || '',
    pickupTime: row.pickup_datetime || 'Pickup time TBC',
    deliveryTime: row.delivery_datetime || 'Delivery time TBC',
    cargoType: row.requested_cargo_label || row.cargo_type || 'Cargo TBC',
    vehicleRequirement: row.requested_vehicle_label || row.requested_vehicle_type || row.vehicle_type || 'Vehicle TBC',
    vehicleType: row.vehicle_type,
    price: toMoney(agreedRateAmount),
    agreedRateAmount,
    budgetAmount: agreedRateAmount,
    distanceMiles: Number.isFinite(distance) && distance > 0 ? distance : null,
    priority: ['delayed', 'disputed', 'failed'].includes(String(row.status ?? '').toLowerCase()) ? 'high' : 'normal',
    podRequired: row.pod_required !== false,
    podGenerated: hasPod(row),
    deliveryPhotos: safeArray(row.delivery_photos).filter((value): value is string => typeof value === 'string'),
    podPhotos: safeArray(row.pod_photos).filter((value): value is string => typeof value === 'string'),
    collectionPhotoUrl: row.collection_photo_url,
    deliverySignatureData: row.delivery_signature_data,
    clientSignatureName: row.client_signature_name || '',
    contactAllowed: Boolean(contactPhone),
    contactName,
    contactPhone,
    clientName: row.client_name || '',
    clientPhone: row.client_phone || contactPhone || '',
    loadDetails: row.load_details || '',
    requirements: [row.load_details, row.special_requirements, row.access_restrictions].filter(Boolean).join('\n'),
    updatedAt: row.updated_at,
  };
}

export async function insertTrackingEvent(jobId: string, userId: string, eventType: string, message: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    created_by: userId,
    user_id: userId,
    event_type: eventType,
    event_time: new Date().toISOString(),
    message,
    meta: { source: 'driver_mobile' },
  });
}
