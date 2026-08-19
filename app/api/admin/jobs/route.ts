import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import {
  getFeatureFlags,
  getGlobalSettingBoolean,
  getGlobalSettingNumber,
} from '../../_lib/platformFlags';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalNumber = z.number().finite().nonnegative().optional().nullable();

const bodySchema = z.object({
  idempotencyKey: z.string().uuid(),
  companyId: z.string().uuid(),
  status: z.enum(['draft', 'posted']),
  exchangeVisibility: z.enum(['private', 'exchange']),
  clientName: z.string().trim().min(1).max(500),
  clientEmail: z.string().trim().email(),
  clientPhone: z.string().trim().min(1).max(100),
  pickupAddress: z.string().trim().min(3).max(1000),
  pickupPostcode: z.string().trim().min(2).max(20),
  pickupDateTime: optionalText,
  pickupTimeSlot: z.string().trim().min(1).max(50),
  deliveryAddress: z.string().trim().min(3).max(1000),
  deliveryPostcode: z.string().trim().min(2).max(20),
  deliveryDateTime: optionalText,
  deliveryTimeSlot: z.string().trim().min(1).max(50),
  collectionContactName: z.string().trim().min(1).max(500),
  collectionContactPhone: z.string().trim().min(1).max(100),
  deliveryContactName: z.string().trim().min(1).max(500),
  deliveryContactPhone: z.string().trim().min(1).max(100),
  customerReference: optionalText,
  purchaseOrderNumber: optionalText,
  bookingReference: optionalText,
  vehicleType: z.string().trim().min(1).max(100),
  vehicleLabel: z.string().trim().min(1).max(100),
  cargoType: z.string().trim().min(1).max(100),
  cargoLabel: z.string().trim().min(1).max(100),
  quantity: z.number().int().positive(),
  pallets: z.number().int().positive().optional().nullable(),
  weightKg: optionalNumber,
  lengthCm: optionalNumber,
  widthCm: optionalNumber,
  heightCm: optionalNumber,
  cargoValueGbp: optionalNumber,
  palletType: optionalText,
  palletStackable: z.boolean().optional().nullable(),
  collectionForkliftAvailable: z.boolean(),
  collectionTailLiftRequired: z.boolean(),
  collectionHandballRequired: z.boolean(),
  deliveryForkliftAvailable: z.boolean(),
  deliveryTailLiftRequired: z.boolean(),
  deliveryHandballRequired: z.boolean(),
  collectionAccessRestrictions: z.array(z.string().trim().min(1).max(200)).max(20),
  deliveryAccessRestrictions: z.array(z.string().trim().min(1).max(200)).max(20),
  specialRequirements: z.array(z.string().trim().min(1).max(200)).max(20),
  documentChecklist: z.array(z.string().trim().min(1).max(200)).max(30),
  proposedPriceGbp: optionalNumber,
  proposePriceToDrivers: z.boolean(),
  cargoNotes: optionalText,
});

type CompanyJoin = { status?: unknown } | Array<{ status?: unknown }> | null;

const joinedCompanyStatus = (value: CompanyJoin) => {
  if (Array.isArray(value)) return String(value[0]?.status ?? '').trim().toLowerCase();
  return String(value?.status ?? '').trim().toLowerCase();
};

const missingIdempotencyColumn = (error: { code?: string | null; message?: string | null } | null | undefined) => {
  if (!error) return false;
  const code = String(error.code ?? '');
  const message = String(error.message ?? '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || message.includes('creation_idempotency_key');
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Job creation is temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respond(400, {
      error: 'Job details are incomplete or invalid.',
      fields: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status, companies!inner(status)')
      .eq('company_id', input.companyId)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (membershipError) return respond(500, { error: membershipError.message });
  if (profileError) return respond(500, { error: profileError.message });

  const role = String(membership?.role_in_company ?? '').trim().toLowerCase();
  const profileRole = String(profile?.role ?? '').trim().toLowerCase();
  const companyActive = joinedCompanyStatus(membership?.companies as CompanyJoin) === 'active';
  const operator = Boolean(membership) && companyActive && profileRole !== 'driver' && ['owner', 'admin', 'dispatcher', 'member'].includes(role);
  if (!operator) return respond(403, { error: 'Active company operator access is required to create jobs.' });

  const publishToExchange = input.status === 'posted' && input.exchangeVisibility === 'exchange';
  if (publishToExchange && !['owner', 'admin'].includes(role)) {
    return respond(403, { error: 'Company Owner or Admin access is required to publish a load to the exchange.' });
  }

  let exchangeAutoExpireHours = 72;
  if (publishToExchange) {
    const flags = await getFeatureFlags(supabaseAdmin, ['exchange_marketplace']);
    if (!flags.get('exchange_marketplace')) {
      return respond(503, { error: 'The exchange marketplace is currently disabled. Save the job privately instead.' });
    }
    exchangeAutoExpireHours = await getGlobalSettingNumber(supabaseAdmin, 'exchange_auto_expire_hours');
  }

  const complianceBlockPosting = await getGlobalSettingBoolean(supabaseAdmin, 'compliance_block_posting');
  if (complianceBlockPosting) {
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('status')
      .eq('id', input.companyId)
      .maybeSingle();
    if (companyError) return respond(503, { error: 'Company compliance status could not be verified.' });
    const companyStatus = String(company?.status ?? '').trim().toLowerCase();
    if (!['active', 'fully_active', 'active_with_warnings'].includes(companyStatus)) {
      return respond(403, { error: 'Company compliance status does not allow new job creation.' });
    }
  }

  const existing = await supabaseAdmin
    .from('jobs')
    .select('id, status, current_status, exchange_visibility')
    .eq('company_id', input.companyId)
    .eq('creation_idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existing.error) {
    if (missingIdempotencyColumn(existing.error)) {
      return respond(503, { error: 'Job creation idempotency is not available in the current database schema.' });
    }
    return respond(500, { error: 'Job submission safety check failed. Please retry.' });
  }
  if (existing.data) {
    return respond(200, { success: true, replayed: true, job: existing.data });
  }

  const now = new Date().toISOString();
  const specialRequirements = [
    ...input.specialRequirements,
    input.collectionTailLiftRequired ? 'Tail lift required' : null,
    input.collectionForkliftAvailable ? 'Forklift available at collection' : null,
    input.collectionHandballRequired ? 'Handball required' : null,
  ].filter((value): value is string => Boolean(value));
  const accessRestrictions = [
    ...input.collectionAccessRestrictions.map((value) => `Collection: ${value}`),
    ...input.deliveryAccessRestrictions.map((value) => `Delivery: ${value}`),
  ];

  const loadDetails = JSON.stringify({
    schema: 'xdrive_load_details_v2',
    source: 'admin_jobs',
    references: {
      customerReference: input.customerReference || null,
      purchaseOrderNumber: input.purchaseOrderNumber || null,
      bookingReference: input.bookingReference || null,
    },
    dimensionsCm: {
      length: input.lengthCm ?? null,
      width: input.widthCm ?? null,
      height: input.heightCm ?? null,
    },
    palletDetails: input.pallets
      ? { count: input.pallets, type: input.palletType || null, stackable: input.palletStackable ?? null }
      : null,
    publicQuoteNotes: null,
    notes: input.cargoNotes || null,
    executionInstructions: input.cargoNotes || null,
  });

  const row: Record<string, unknown> = {
    company_id: input.companyId,
    created_by: authData.user.id,
    creation_idempotency_key: input.idempotencyKey,
    status: input.status,
    current_status: input.status,
    client_name: input.clientName,
    client_email: input.clientEmail,
    client_phone: input.clientPhone,
    pickup_location: `${input.pickupAddress}, ${input.pickupPostcode.toUpperCase()}`,
    pickup_postcode: input.pickupPostcode.toUpperCase(),
    pickup_datetime: input.pickupDateTime || null,
    pickup_time_slot: input.pickupTimeSlot,
    delivery_location: `${input.deliveryAddress}, ${input.deliveryPostcode.toUpperCase()}`,
    delivery_postcode: input.deliveryPostcode.toUpperCase(),
    delivery_datetime: input.deliveryDateTime || null,
    delivery_time_slot: input.deliveryTimeSlot,
    collection_contact_name: input.collectionContactName,
    collection_contact_phone: input.collectionContactPhone,
    delivery_contact_name: input.deliveryContactName,
    delivery_contact_phone: input.deliveryContactPhone,
    customer_reference: input.customerReference || null,
    purchase_order_number: input.purchaseOrderNumber || null,
    booking_reference: input.bookingReference || null,
    vehicle_type: input.vehicleType,
    requested_vehicle_label: input.vehicleLabel,
    cargo_type: input.cargoType,
    requested_cargo_label: input.cargoLabel,
    items: input.quantity,
    pallets: input.pallets ?? null,
    weight_kg: input.weightKg ?? null,
    length_cm: input.lengthCm ?? null,
    width_cm: input.widthCm ?? null,
    height_cm: input.heightCm ?? null,
    cargo_value_gbp: input.cargoValueGbp ?? null,
    pallet_type: input.palletType || null,
    pallet_stackable: input.palletStackable ?? null,
    collection_forklift_available: input.collectionForkliftAvailable,
    collection_tail_lift_required: input.collectionTailLiftRequired,
    collection_handball_required: input.collectionHandballRequired,
    delivery_forklift_available: input.deliveryForkliftAvailable,
    delivery_tail_lift_required: input.deliveryTailLiftRequired,
    delivery_handball_required: input.deliveryHandballRequired,
    document_checklist: input.documentChecklist,
    load_details: loadDetails,
    special_requirements: specialRequirements.join(', ') || null,
    access_restrictions: accessRestrictions.join(', ') || null,
    budget_amount: input.proposePriceToDrivers ? input.proposedPriceGbp ?? null : null,
    is_fixed_price: input.proposePriceToDrivers,
    currency: 'GBP',
    exchange_visibility: publishToExchange ? 'exchange' : 'private',
    exchange_posted_at: publishToExchange ? now : null,
    exchange_expires_at: publishToExchange
      ? new Date(Date.now() + exchangeAutoExpireHours * 60 * 60 * 1000).toISOString()
      : null,
    updated_at: now,
  };

  const inserted = await supabaseAdmin
    .from('jobs')
    .insert(row)
    .select('id, status, current_status, exchange_visibility')
    .single();

  if (inserted.error?.code === '23505') {
    const replay = await supabaseAdmin
      .from('jobs')
      .select('id, status, current_status, exchange_visibility')
      .eq('company_id', input.companyId)
      .eq('creation_idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (replay.data) return respond(200, { success: true, replayed: true, job: replay.data });
  }
  if (inserted.error) return respond(500, { error: inserted.error.message });

  return respond(201, { success: true, replayed: false, job: inserted.data });
}
