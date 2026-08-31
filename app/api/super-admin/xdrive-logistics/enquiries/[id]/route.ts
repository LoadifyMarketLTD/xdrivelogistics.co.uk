import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { labelToCargoType, labelToVehicleType } from '../../../../../../lib/vehicleTypes';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const INTAKE_COMPANY_ID =
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

const reason = z.string().trim().min(3).max(5000);
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_price'), amount: z.number().finite().positive().max(1_000_000), reason }),
  z.object({ action: z.literal('quote_sent'), reason }),
  z.object({ action: z.literal('accepted'), reason }),
  z.object({
    action: z.literal('convert_to_job'),
    executionMode: z.enum(['own_fleet', 'direct_carrier', 'marketplace']),
    reason,
  }),
]);

const fieldFromNotes = (notes: string | null, label: string) => {
  if (!notes) return null;
  const prefix = `${label}:`;
  const part = notes.split('|').map((value) => value.trim()).find((value) => value.toLowerCase().startsWith(prefix.toLowerCase()));
  return part ? part.slice(prefix.length).trim() || null : null;
};

const numberFromNotes = (notes: string | null, label: string) => {
  const value = fieldFromNotes(notes, label);
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanFromNotes = (notes: string | null, label: string) => {
  const value = fieldFromNotes(notes, label)?.toLowerCase();
  return value === 'yes' || value === 'true' || value === 'required';
};

const timeForSlot = (slot: string | null) => {
  const value = (slot ?? '').toLowerCase();
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  if (value.includes('morning')) return '09:00';
  if (value.includes('afternoon')) return '14:00';
  if (value.includes('evening')) return '18:00';
  return '12:00';
};

const dateTimeFromNotes = (notes: string | null, dateLabel: string, timeLabel: string) => {
  const date = fieldFromNotes(notes, dateLabel);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const slot = fieldFromNotes(notes, timeLabel);
  return `${date}T${timeForSlot(slot)}:00.000Z`;
};

const loadEnquiry = async (id: string) => {
  if (!supabaseAdmin || !INTAKE_COMPANY_ID) return { data: null, error: null };
  return supabaseAdmin
    .from('quotes')
    .select('id,company_id,customer_name,customer_email,customer_phone,pickup_location,delivery_location,vehicle_type,cargo_type,amount,currency,status,notes,created_at,updated_at,quote_sent_at,accepted_at,converted_at,converted_job_id,execution_mode')
    .eq('id', id)
    .eq('company_id', INTAKE_COMPANY_ID)
    .ilike('notes', '%SOURCE: app.xdrivelogistics.co.uk%')
    .maybeSingle();
};

const governanceErrorResponse = (error: { code?: string; message?: string }) => {
  if (error.code === '42501') return respond(403, { error: 'Platform Owner authority required.' });
  if (error.code === 'P0002') return respond(404, { error: error.message ?? 'XDrive enquiry not found.' });
  if (error.code === '22023' || error.code === '22P02') return respond(400, { error: error.message ?? 'Invalid enquiry action.' });
  if (error.code === '23514' || error.code === '23502' || error.code === '40001') {
    return respond(409, { error: error.message ?? 'XDrive enquiry transition is not allowed.' });
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return respond(503, {
      error: 'Canonical XDrive enquiry governance is not available in this environment.',
      migrationRequired: true,
    });
  }
  return respond(500, { error: error.message ?? 'XDrive enquiry action failed.' });
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  if (!INTAKE_COMPANY_ID) return respond(503, { error: 'XDrive intake company is not configured.' });

  const { id } = await context.params;
  const { data, error } = await loadEnquiry(id);
  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'XDrive enquiry not found.' });
  return respond(200, { enquiry: data });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  if (!INTAKE_COMPANY_ID) return respond(503, { error: 'XDrive intake company is not configured.' });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid enquiry action.', fields: parsed.error.flatten().fieldErrors });

  const { id } = await context.params;
  const currentResult = await loadEnquiry(id);
  if (currentResult.error) return respond(500, { error: currentResult.error.message });
  const enquiry = currentResult.data;
  if (!enquiry) return respond(404, { error: 'XDrive enquiry not found.' });

  const action = parsed.data;
  let vehicleType: string | null = null;
  let requestedVehicleLabel: string | null = null;
  let cargoType: string | null = null;
  let requestedCargoLabel: string | null = null;
  let weightKg: number | null = null;
  let pallets: number | null = null;
  let tailLiftRequired = false;
  let pickupDatetime: string | null = null;
  let pickupTimeSlot: string | null = null;
  let deliveryDatetime: string | null = null;
  let deliveryTimeSlot: string | null = null;

  if (action.action === 'convert_to_job') {
    const notes = enquiry.notes ?? null;
    const vehicleLabel = enquiry.vehicle_type || fieldFromNotes(notes, 'Vehicle requested') || 'Not sure / advise me';
    const cargoLabel = enquiry.cargo_type || fieldFromNotes(notes, 'Cargo') || 'Mixed Freight';
    requestedVehicleLabel = vehicleLabel;
    requestedCargoLabel = cargoLabel;
    // Pass the modern canonical slug. The governance RPC resolves it against the
    // actual jobs.vehicle_type enum so legacy Production and clean-replay schemas agree.
    vehicleType = labelToVehicleType(vehicleLabel);
    cargoType = labelToCargoType(cargoLabel);
    weightKg = numberFromNotes(notes, 'Weight');
    const rawPallets = numberFromNotes(notes, 'Pallets');
    pallets = rawPallets === null ? null : Math.max(0, Math.trunc(rawPallets));
    tailLiftRequired = booleanFromNotes(notes, 'Tail lift required');
    pickupDatetime = dateTimeFromNotes(notes, 'Collection date', 'Collection time');
    deliveryDatetime = dateTimeFromNotes(notes, 'Delivery date', 'Delivery time');
    pickupTimeSlot = fieldFromNotes(notes, 'Collection time') || 'Not specified';
    deliveryTimeSlot = fieldFromNotes(notes, 'Delivery time') || 'Not specified';

    if (!pickupDatetime) {
      return respond(409, { error: 'Collection date/time is required before conversion.' });
    }
  }

  const { data, error } = await supabaseAdmin.rpc('owner_manage_xdrive_enquiry', {
    p_actor_user_id: owner.id,
    p_company_id: INTAKE_COMPANY_ID,
    p_enquiry_id: id,
    p_action: action.action,
    p_reason: action.reason,
    p_amount: action.action === 'set_price' ? action.amount : null,
    p_execution_mode: action.action === 'convert_to_job' ? action.executionMode : null,
    p_vehicle_type: vehicleType,
    p_requested_vehicle_label: requestedVehicleLabel,
    p_cargo_type: cargoType,
    p_requested_cargo_label: requestedCargoLabel,
    p_weight_kg: weightKg,
    p_pallets: pallets,
    p_collection_tail_lift_required: tailLiftRequired,
    p_pickup_datetime: pickupDatetime,
    p_pickup_time_slot: pickupTimeSlot,
    p_delivery_datetime: deliveryDatetime,
    p_delivery_time_slot: deliveryTimeSlot,
    p_expected_updated_at: enquiry.updated_at ?? null,
  });

  if (error) return governanceErrorResponse(error);
  const result = (Array.isArray(data) ? data[0] ?? null : data) as Record<string, unknown> | null;
  if (!result) return respond(500, { error: 'XDrive enquiry governance returned no authoritative result.' });

  const created = action.action === 'convert_to_job' && !result.replayed;
  return respond(created ? 201 : 200, result);
}
