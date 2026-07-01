import { NextRequest, NextResponse } from 'next/server';
import { resolveActorContext } from '../_lib/actorContext';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

const ALLOWED_ROLES = new Set(['owner', 'broker', 'company_admin', 'company_staff', 'customer']);

const ALLOWED_JOB_FIELDS = new Set([
  'status',
  'pickup_location',
  'pickup_postcode',
  'pickup_datetime',
  'pickup_time_slot',
  'delivery_location',
  'delivery_postcode',
  'delivery_datetime',
  'delivery_time_slot',
  'vehicle_type',
  'cargo_type',
  'items',
  'pallets',
  'weight_kg',
  'length_cm',
  'width_cm',
  'height_cm',
  'load_details',
  'special_requirements',
  'access_restrictions',
  'client_name',
  'client_email',
  'client_phone',
  'collection_contact_name',
  'collection_contact_phone',
  'delivery_contact_name',
  'delivery_contact_phone',
  'customer_reference',
  'purchase_order_number',
  'booking_reference',
  'requested_vehicle_label',
  'requested_cargo_label',
  'cargo_value_gbp',
  'pallet_type',
  'pallet_stackable',
  'collection_forklift_available',
  'collection_tail_lift_required',
  'collection_handball_required',
  'delivery_forklift_available',
  'delivery_tail_lift_required',
  'delivery_handball_required',
  'document_checklist',
  'exchange_visibility',
  'exchange_posted_at',
  'budget_amount',
  'is_fixed_price',
  'currency',
]);

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return json(503, { error: 'Service not available — admin client not configured.' });
  }

  const actor = await resolveActorContext(request);
  if ('error' in actor) return json(actor.status, { error: actor.error });
  if (!actor.role || !ALLOWED_ROLES.has(actor.role)) return json(403, { error: 'Forbidden.' });
  if (!actor.companyId) return json(403, { error: 'Forbidden — company context not found.' });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json(400, { error: 'Invalid JSON payload.' });

  const payload: Record<string, unknown> = {
    company_id: actor.companyId,
    created_by: actor.user.id,
  };

  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_JOB_FIELDS.has(key)) {
      payload[key] = value;
    }
  }

  if (!payload.status) payload.status = 'draft';
  if (!payload.currency) payload.currency = 'GBP';

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .insert(payload)
    .select('id, company_id, status')
    .single();

  if (error) return json(400, { error: `Failed to create job: ${error.message}` });

  return json(201, { success: true, job: data });
}
