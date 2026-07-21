import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { labelToCargoType, labelToVehicleType } from '../../../../lib/vehicleTypes';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalNumber = z.number().finite().nonnegative().optional().nullable();

const bodySchema = z.object({
  idempotencyKey: z.string().uuid(),
  companyId: z.string().uuid(),
  mode: z.enum(['broker', 'customer']),
  publish: z.boolean(),
  clientName: optionalText,
  clientEmail: z.string().trim().email().optional().nullable().or(z.literal('')),
  clientPhone: optionalText,
  pickupDateTime: z.string().trim().min(1),
  pickupTimeSlot: z.string().trim().max(50),
  pickupAddress: z.string().trim().min(3).max(1000),
  pickupPostcode: z.string().trim().min(2).max(20),
  collectionContact: optionalText,
  collectionPhone: optionalText,
  deliveryDateTime: z.string().trim().optional().nullable(),
  deliveryTimeSlot: z.string().trim().max(50),
  deliveryAddress: z.string().trim().min(3).max(1000),
  deliveryPostcode: z.string().trim().min(2).max(20),
  deliveryContact: optionalText,
  deliveryPhone: optionalText,
  vehicleLabel: z.string().trim().min(1).max(100),
  cargoLabel: z.string().trim().min(1).max(100),
  weightKg: optionalNumber,
  pallets: z.number().int().nonnegative().optional().nullable(),
  lengthCm: optionalNumber,
  widthCm: optionalNumber,
  heightCm: optionalNumber,
  cargoValueGbp: optionalNumber,
  customerReference: optionalText,
  purchaseOrder: optionalText,
  bookingReference: optionalText,
  customerPrice: optionalNumber,
  targetCarrierCost: optionalNumber,
  tailLift: z.boolean(),
  forklift: z.boolean(),
  handball: z.boolean(),
  adr: z.boolean(),
  temperatureControlled: z.boolean(),
  fragile: z.boolean(),
  notes: optionalText,
});

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const isMissingIdempotencyColumn = (error: { code?: string | null; message?: string | null } | null | undefined) => {
  if (!error) return false;
  const code = String(error.code ?? '');
  const message = String(error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (message.includes('creation_idempotency_key') && (message.includes('column') || message.includes('schema cache')))
  );
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server database access is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: 'Load details are incomplete or invalid.',
      fields: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', input.companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });
  if (!membership) return respond(403, { error: 'You cannot post loads for this company workspace.' });

  let idempotencyAvailable = true;
  const existingResult = await supabaseAdmin
    .from('jobs')
    .select('id, status, current_status')
    .eq('company_id', input.companyId)
    .eq('creation_idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existingResult.error) {
    if (isMissingIdempotencyColumn(existingResult.error)) {
      idempotencyAvailable = false;
    } else {
      return respond(500, { error: existingResult.error.message });
    }
  }
  if (existingResult.data) {
    return respond(200, { job: existingResult.data, replayed: true, idempotencyProtected: true });
  }

  const specialRequirements = [
    input.tailLift && 'Tail lift required',
    input.forklift && 'Forklift required',
    input.handball && 'Handball required',
    input.adr && 'ADR required',
    input.temperatureControlled && 'Temperature controlled',
    input.fragile && 'Fragile goods',
  ].filter(Boolean).join(', ');

  const now = new Date().toISOString();
  const status = input.publish ? 'posted' : 'draft';
  const loadDetails = JSON.stringify({
    source: input.mode === 'broker' ? 'broker_workspace_v3' : 'customer_workspace_v3',
    targetCarrierCost: input.targetCarrierCost ?? null,
    dimensionsCm: {
      length: input.lengthCm ?? null,
      width: input.widthCm ?? null,
      height: input.heightCm ?? null,
    },
    notes: input.notes || null,
  });

  const row: Record<string, unknown> = {
    company_id: input.companyId,
    created_by: authData.user.id,
    status,
    current_status: status,
    pickup_location: `${input.pickupAddress}, ${input.pickupPostcode.toUpperCase()}`,
    pickup_postcode: input.pickupPostcode.toUpperCase(),
    pickup_datetime: input.pickupDateTime,
    pickup_time_slot: input.pickupTimeSlot,
    delivery_location: `${input.deliveryAddress}, ${input.deliveryPostcode.toUpperCase()}`,
    delivery_postcode: input.deliveryPostcode.toUpperCase(),
    delivery_datetime: input.deliveryDateTime || null,
    delivery_time_slot: input.deliveryTimeSlot,
    collection_contact_name: input.collectionContact || null,
    collection_contact_phone: input.collectionPhone || null,
    delivery_contact_name: input.deliveryContact || null,
    delivery_contact_phone: input.deliveryPhone || null,
    client_name: input.clientName || null,
    client_email: input.clientEmail || null,
    client_phone: input.clientPhone || null,
    customer_reference: input.customerReference || null,
    purchase_order_number: input.purchaseOrder || null,
    booking_reference: input.bookingReference || null,
    vehicle_type: labelToVehicleType(input.vehicleLabel),
    requested_vehicle_label: input.vehicleLabel,
    cargo_type: labelToCargoType(input.cargoLabel),
    requested_cargo_label: input.cargoLabel,
    weight_kg: input.weightKg ?? null,
    pallets: input.pallets ?? null,
    length_cm: input.lengthCm ?? null,
    width_cm: input.widthCm ?? null,
    height_cm: input.heightCm ?? null,
    cargo_value_gbp: input.cargoValueGbp ?? null,
    budget_amount: input.customerPrice ?? null,
    collection_tail_lift_required: input.tailLift,
    collection_forklift_available: input.forklift,
    collection_handball_required: input.handball,
    special_requirements: specialRequirements || null,
    load_details: loadDetails,
    exchange_visibility: input.publish ? 'exchange' : 'private',
    exchange_posted_at: input.publish ? now : null,
    updated_at: now,
  };
  if (idempotencyAvailable) row.creation_idempotency_key = input.idempotencyKey;

  let insertResult = await supabaseAdmin
    .from('jobs')
    .insert(row)
    .select('id, status, current_status')
    .single();

  // Handles a rollout race where the API observed the new column but PostgREST
  // refreshed to an older schema cache before the insert completed.
  if (insertResult.error && idempotencyAvailable && isMissingIdempotencyColumn(insertResult.error)) {
    idempotencyAvailable = false;
    delete row.creation_idempotency_key;
    insertResult = await supabaseAdmin
      .from('jobs')
      .insert(row)
      .select('id, status, current_status')
      .single();
  }

  if (insertResult.error?.code === '23505' && idempotencyAvailable) {
    const { data: replay, error: replayError } = await supabaseAdmin
      .from('jobs')
      .select('id, status, current_status')
      .eq('company_id', input.companyId)
      .eq('creation_idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (replayError) return respond(500, { error: replayError.message });
    if (replay) return respond(200, { job: replay, replayed: true, idempotencyProtected: true });
  }
  if (insertResult.error) return respond(500, { error: insertResult.error.message });

  return respond(201, {
    job: insertResult.data,
    replayed: false,
    idempotencyProtected: idempotencyAvailable,
  });
}
