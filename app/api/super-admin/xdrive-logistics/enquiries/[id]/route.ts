import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { labelToCargoType, labelToVehicleType } from '../../../../../../lib/vehicleTypes';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const INTAKE_COMPANY_ID =
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_price'), amount: z.number().finite().positive() }),
  z.object({ action: z.literal('quote_sent') }),
  z.object({ action: z.literal('accepted') }),
  z.object({
    action: z.literal('convert_to_job'),
    executionMode: z.enum(['own_fleet', 'direct_carrier', 'marketplace']),
  }),
]);

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role,status')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;
  if (profile.role !== 'owner' || String(profile.status ?? '').toLowerCase() !== 'active') return null;
  return authData.user;
};

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });
  if (!INTAKE_COMPANY_ID) return respond(503, { error: 'XDrive intake company is not configured.' });

  const { id } = await context.params;
  const { data, error } = await loadEnquiry(id);
  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'XDrive enquiry not found.' });
  return respond(200, { enquiry: data });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });
  if (!INTAKE_COMPANY_ID) return respond(503, { error: 'XDrive intake company is not configured.' });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid enquiry action.', fields: parsed.error.flatten().fieldErrors });

  const { id } = await context.params;
  const currentResult = await loadEnquiry(id);
  if (currentResult.error) return respond(500, { error: currentResult.error.message });
  const enquiry = currentResult.data;
  if (!enquiry) return respond(404, { error: 'XDrive enquiry not found.' });

  const now = new Date().toISOString();
  const action = parsed.data;

  if (action.action === 'set_price') {
    if (enquiry.converted_job_id) return respond(409, { error: 'This enquiry has already been converted to a job.' });
    const { data, error } = await supabaseAdmin
      .from('quotes')
      .update({ amount: action.amount, currency: 'GBP', status: 'priced', updated_at: now })
      .eq('id', id)
      .eq('company_id', INTAKE_COMPANY_ID)
      .select('id,amount,currency,status,updated_at')
      .single();
    if (error) return respond(500, { error: error.message });
    return respond(200, { enquiry: data });
  }

  if (action.action === 'quote_sent') {
    if (typeof enquiry.amount !== 'number' || enquiry.amount <= 0) return respond(409, { error: 'Set the customer price before marking the quote as sent.' });
    if (enquiry.converted_job_id) return respond(409, { error: 'This enquiry has already been converted to a job.' });
    const { data, error } = await supabaseAdmin
      .from('quotes')
      .update({ status: 'quote_sent', quote_sent_at: now, updated_at: now })
      .eq('id', id)
      .eq('company_id', INTAKE_COMPANY_ID)
      .select('id,amount,currency,status,quote_sent_at,updated_at')
      .single();
    if (error) return respond(500, { error: error.message });
    return respond(200, { enquiry: data });
  }

  if (action.action === 'accepted') {
    if (String(enquiry.status ?? '').toLowerCase() !== 'quote_sent') return respond(409, { error: 'The quote must be marked as sent before it can be accepted.' });
    const { data, error } = await supabaseAdmin
      .from('quotes')
      .update({ status: 'accepted', accepted_at: now, updated_at: now })
      .eq('id', id)
      .eq('company_id', INTAKE_COMPANY_ID)
      .select('id,amount,currency,status,accepted_at,updated_at')
      .single();
    if (error) return respond(500, { error: error.message });
    return respond(200, { enquiry: data });
  }

  if (enquiry.converted_job_id) {
    return respond(200, { job: { id: enquiry.converted_job_id }, replayed: true });
  }
  if (String(enquiry.status ?? '').toLowerCase() !== 'accepted') {
    return respond(409, { error: 'The customer quote must be accepted before conversion to a job.' });
  }

  const notes = enquiry.notes ?? null;
  const pickupPostcode = String(enquiry.pickup_location ?? '').trim().toUpperCase();
  const deliveryPostcode = String(enquiry.delivery_location ?? '').trim().toUpperCase();
  if (!pickupPostcode || !deliveryPostcode) return respond(409, { error: 'Collection and delivery locations are required before conversion.' });

  const vehicleLabel = enquiry.vehicle_type || fieldFromNotes(notes, 'Vehicle requested') || 'Not sure / advise me';
  const cargoLabel = enquiry.cargo_type || fieldFromNotes(notes, 'Cargo') || 'Mixed Freight';
  const pickupSlot = fieldFromNotes(notes, 'Collection time') || 'Not specified';
  const deliverySlot = fieldFromNotes(notes, 'Delivery time') || 'Not specified';
  const publish = action.executionMode === 'marketplace';
  const loadDetails = {
    source: 'xdrive_public_enquiry',
    enquiryId: enquiry.id,
    executionMode: action.executionMode,
    sourceNotes: notes,
  };

  const jobRow: Record<string, unknown> = {
    company_id: INTAKE_COMPANY_ID,
    created_by: owner.id,
    creation_idempotency_key: enquiry.id,
    status: publish ? 'posted' : 'draft',
    current_status: publish ? 'posted' : 'draft',
    pickup_location: pickupPostcode,
    pickup_postcode: pickupPostcode,
    pickup_datetime: dateTimeFromNotes(notes, 'Collection date', 'Collection time'),
    pickup_time_slot: pickupSlot,
    delivery_location: deliveryPostcode,
    delivery_postcode: deliveryPostcode,
    delivery_datetime: dateTimeFromNotes(notes, 'Delivery date', 'Delivery time'),
    delivery_time_slot: deliverySlot,
    client_name: enquiry.customer_name,
    client_email: enquiry.customer_email,
    client_phone: enquiry.customer_phone,
    vehicle_type: labelToVehicleType(vehicleLabel),
    requested_vehicle_label: vehicleLabel,
    cargo_type: labelToCargoType(cargoLabel),
    requested_cargo_label: cargoLabel,
    weight_kg: numberFromNotes(notes, 'Weight'),
    pallets: numberFromNotes(notes, 'Pallets'),
    budget_amount: enquiry.amount,
    collection_tail_lift_required: booleanFromNotes(notes, 'Tail lift required'),
    load_details: loadDetails,
    exchange_visibility: publish ? 'exchange' : 'private',
    exchange_posted_at: publish ? now : null,
    exchange_expires_at: publish ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() : null,
    updated_at: now,
  };

  const existingJob = await supabaseAdmin
    .from('jobs')
    .select('id,status,current_status')
    .eq('company_id', INTAKE_COMPANY_ID)
    .eq('creation_idempotency_key', enquiry.id)
    .maybeSingle();
  if (existingJob.error && !String(existingJob.error.message ?? '').toLowerCase().includes('creation_idempotency_key')) {
    return respond(500, { error: existingJob.error.message });
  }

  let job = existingJob.data;
  if (!job) {
    let insert = await supabaseAdmin.from('jobs').insert(jobRow).select('id,status,current_status').single();
    if (insert.error && String(insert.error.message ?? '').toLowerCase().includes('creation_idempotency_key')) {
      delete jobRow.creation_idempotency_key;
      insert = await supabaseAdmin.from('jobs').insert(jobRow).select('id,status,current_status').single();
    }
    if (insert.error || !insert.data) return respond(500, { error: insert.error?.message ?? 'Job conversion failed.' });
    job = insert.data;
  }

  const { error: quoteUpdateError } = await supabaseAdmin
    .from('quotes')
    .update({
      status: 'converted',
      converted_at: now,
      converted_job_id: job.id,
      execution_mode: action.executionMode,
      updated_at: now,
    })
    .eq('id', id)
    .eq('company_id', INTAKE_COMPANY_ID);
  if (quoteUpdateError) return respond(500, { error: quoteUpdateError.message, job });

  return respond(201, { job, replayed: Boolean(existingJob.data), executionMode: action.executionMode });
}
