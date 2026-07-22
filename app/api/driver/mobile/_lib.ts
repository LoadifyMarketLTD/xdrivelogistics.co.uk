import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export type DriverContext = {
  userId: string;
  driverId: string;
  companyId: string;
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
      .select('id, company_id, user_id, app_access, status')
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

  if (String(profileRow.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(403, { error: 'Driver profile is not active.' });
  }

  if (!driverRow) return respond(403, { error: 'Driver record not found.' });
  if (driverRow.app_access !== true) {
    return respond(403, { error: 'Driver app access has not been approved.' });
  }
  if (String(driverRow.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(403, { error: 'Driver account is not active.' });
  }

  const driverId = String(driverRow.id);
  const companyId = typeof driverRow.company_id === 'string' ? driverRow.company_id.trim() : '';
  if (!companyId) {
    return respond(403, { error: 'Driver is not linked to an active company workspace.' });
  }

  const [companyResult, ownerApplicationResult, fleetInvitationResult] = await Promise.all([
    supabaseAdmin.from('companies').select('status').eq('id', companyId).maybeSingle(),
    supabaseAdmin
      .from('onboarding_applications')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('account_type', 'owner_driver')
      .maybeSingle(),
    supabaseAdmin
      .from('fleet_driver_invitations')
      .select('id')
      .eq('driver_id', driverId)
      .maybeSingle(),
  ]);

  if (companyResult.error) return respond(500, { error: companyResult.error.message });
  if (ownerApplicationResult.error) return respond(500, { error: ownerApplicationResult.error.message });
  if (fleetInvitationResult.error) return respond(500, { error: fleetInvitationResult.error.message });

  if (!companyResult.data || String(companyResult.data.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(403, { error: 'Driver company workspace is not active.' });
  }

  if (ownerApplicationResult.data) {
    const { data: ownerCompliant, error: ownerComplianceError } = await supabaseAdmin.rpc(
      'owner_driver_compliance_current',
      { p_user_id: authData.user.id }
    );
    if (ownerComplianceError) return respond(500, { error: ownerComplianceError.message });
    if (ownerCompliant !== true) {
      return respond(403, { error: 'Owner-driver compliance is missing, unverified or expired.' });
    }
  }

  if (fleetInvitationResult.data) {
    const { data: fleetCompliant, error: fleetComplianceError } = await supabaseAdmin.rpc(
      'fleet_driver_compliance_current',
      { p_driver_id: driverId }
    );
    if (fleetComplianceError) return respond(500, { error: fleetComplianceError.message });
    if (fleetCompliant !== true) {
      return respond(403, { error: 'Fleet-driver compliance is missing, unverified or expired.' });
    }
  }

  return {
    userId: authData.user.id,
    driverId,
    companyId,
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

export function hasPod(job: Pick<MobileJobRow, 'delivery_photos' | 'pod_photos' | 'delivery_signature_data' | 'pod_generated'>) {
  return Boolean(job.pod_generated)
    || safeArray(job.delivery_photos).length > 0
    || safeArray(job.pod_photos).length > 0
    || Boolean(job.delivery_signature_data);
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
    vehicleRequirement: row.requested_vehicle_label || row.vehicle_type || 'Vehicle TBC',
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

export async function insertTrackingEvent(jobId: string, userId: string, eventType: string, message: string) {
  if (!supabaseAdmin) throw new Error('Server auth is not configured.');

  const { error } = await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    user_id: userId,
    created_by: userId,
    event_type: eventType,
    message,
    meta: { source: 'driver_mobile' },
  });

  if (error) throw new Error(`Failed to record tracking event: ${error.message}`);
}
