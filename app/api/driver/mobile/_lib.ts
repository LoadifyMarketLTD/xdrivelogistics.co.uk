import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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
  delivery_location: string | null;
  pickup_postcode: string | null;
  delivery_postcode: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
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
  pallets: number | null;
  boxes: number | null;
  bags: number | null;
  items: number | null;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  job_distance_miles: number | null;
  job_distance_minutes: number | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
  pod_submission_idempotency_key: string | null;
  on_my_way_at: string | null;
  on_site_pickup_at: string | null;
  loaded_at: string | null;
  on_site_delivery_at: string | null;
  delivered_at: string | null;
  delivery_photos: string[] | null;
  pod_photos: string[] | null;
  delivery_signature_data: unknown;
  status_history: unknown;
  updated_at: string | null;
  created_at: string | null;
};

export async function requireDriver(request: NextRequest): Promise<DriverContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
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

  const profileStatus = String(profileRow.status ?? '').trim().toLowerCase();
  if (profileStatus !== 'active') {
    return respond(403, { error: 'Driver profile is not active.' });
  }

  if (!driverRow) return respond(403, { error: 'Driver record not found.' });
  if (driverRow.app_access !== true) {
    return respond(403, { error: 'Driver app access has not been approved.' });
  }

  const driverStatus = String(driverRow.status ?? '').trim().toLowerCase();
  if (driverStatus !== 'active') {
    return respond(403, { error: 'Driver account is not active.' });
  }

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
    driverId: String(driverRow.id),
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
  'delivery_location',
  'pickup_postcode',
  'delivery_postcode',
  'pickup_lat',
  'pickup_lng',
  'delivery_lat',
  'delivery_lng',
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
  'pallets',
  'boxes',
  'bags',
  'items',
  'weight_kg',
  'length_cm',
  'width_cm',
  'height_cm',
  'job_distance_miles',
  'job_distance_minutes',
  'pod_required',
  'pod_generated',
  'pod_submission_idempotency_key',
  'on_my_way_at',
  'on_site_pickup_at',
  'loaded_at',
  'on_site_delivery_at',
  'delivered_at',
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

/**
 * Returns true when the job has POD evidence that meets the same completeness
 * standard enforced by the admin panel's hasCompletePod check:
 *   - pod_generated flag (set by a successful savePod call), OR
 *   - at least one photo/document AND a signature AND a recipient name.
 *
 * NOTE: do not loosen this gate — the admin transition route requires the same
 * standard before accepting a "delivered" transition.
 */
export function hasPod(job: Pick<MobileJobRow, 'delivery_photos' | 'pod_photos' | 'delivery_signature_data' | 'pod_generated' | 'client_signature_name'>) {
  if (job.pod_generated) return true;
  const hasPhotoOrDoc = safeArray(job.delivery_photos).length > 0 || safeArray(job.pod_photos).length > 0;
  const hasSignature = Boolean(job.delivery_signature_data);
  const hasRecipient = typeof job.client_signature_name === 'string' && job.client_signature_name.trim().length > 0;
  return hasPhotoOrDoc && hasSignature && hasRecipient;
}

export function publicArea(postcode: unknown) {
  const value = String(postcode ?? '').trim().toUpperCase();
  return value ? `Approx. area · ${value.split(/\s+/)[0]}` : 'Area disclosed after allocation';
}

export function toMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Price TBC';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Returns the canonical job status for the mobile client.
 * Prefers current_status (the driver workflow step) over the lifecycle status.
 * Legacy DB values written before the canonical rename are normalised here so
 * the client always receives the current canonical string:
 *   on_my_way   → on_my_way_to_pickup
 *   in_transit  → on_my_way_to_delivery
 */
export function mobileStatus(job: Pick<MobileJobRow, 'status' | 'current_status'>) {
  const raw = String(job.current_status || '').toLowerCase().trim();
  const current = raw === 'on_my_way' ? 'on_my_way_to_pickup'
    : raw === 'in_transit' ? 'on_my_way_to_delivery'
    : raw;
  if (current) return current;
  const fallback = String(job.status || 'awarded').toLowerCase().trim();
  return fallback === 'on_my_way' ? 'on_my_way_to_pickup'
    : fallback === 'in_transit' ? 'on_my_way_to_delivery'
    : fallback;
}

export function mapJob(row: MobileJobRow) {
  const contactName = row.delivery_contact_name || row.collection_contact_name || row.client_name || undefined;
  const contactPhone = row.delivery_contact_phone || row.collection_contact_phone || row.client_phone || undefined;
  const toOptionalNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    id: row.id,
    reference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    status: mobileStatus(row),
    lifecycleStatus: row.status,
    pickupLocation: row.pickup_location || 'Pickup TBC',
    deliveryLocation: row.delivery_location || 'Delivery TBC',
    pickupPostcode: row.pickup_postcode || null,
    deliveryPostcode: row.delivery_postcode || null,
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
    pickupContactName: row.collection_contact_name || null,
    pickupContactPhone: row.collection_contact_phone || null,
    deliveryContactName: row.delivery_contact_name || null,
    deliveryContactPhone: row.delivery_contact_phone || null,
    loadDetails: row.load_details || null,
    specialRequirements: row.special_requirements || null,
    accessRestrictions: row.access_restrictions || null,
    requirements: [row.load_details, row.special_requirements, row.access_restrictions].filter(Boolean).join('\n'),
    pallets: toOptionalNumber(row.pallets),
    boxes: toOptionalNumber(row.boxes),
    bags: toOptionalNumber(row.bags),
    items: toOptionalNumber(row.items),
    weightKg: toOptionalNumber(row.weight_kg),
    lengthCm: toOptionalNumber(row.length_cm),
    widthCm: toOptionalNumber(row.width_cm),
    heightCm: toOptionalNumber(row.height_cm),
    distanceMiles: toOptionalNumber(row.job_distance_miles),
    distanceMinutes: toOptionalNumber(row.job_distance_minutes),
    pickupLat: toOptionalNumber(row.pickup_lat),
    pickupLng: toOptionalNumber(row.pickup_lng),
    deliveryLat: toOptionalNumber(row.delivery_lat),
    deliveryLng: toOptionalNumber(row.delivery_lng),
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
