import { NextRequest, NextResponse } from 'next/server';

import { CARGO_TYPE_LABELS, VEHICLE_TYPE_LABELS } from '../../../../../../lib/vehicleTypes';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../../_lib/requireCompanyAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CloneAction = 'rebook' | 'repost';
const REBOOK_STATUSES = new Set(['delivered', 'completed', 'cancelled', 'expired']);
const REPOST_STATUSES = new Set(['cancelled', 'expired']);
const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const text = (value: unknown) => typeof value === 'string' ? value.trim() || null : value == null ? null : String(value);
const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : null;
};
const boolValue = (value: unknown) => typeof value === 'boolean' ? value : null;

const stripPostcodeSuffix = (location: unknown, postcode: unknown) => {
  const value = text(location) ?? '';
  const code = text(postcode) ?? '';
  if (!value || !code) return value;
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return value.replace(new RegExp(`,?\\s*${escaped}\\s*$`, 'i'), '').trim();
};

const parseLoadDetails = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return { executionInstructions: value } as Record<string, unknown>;
  }
};

const splitRestrictions = (value: unknown) => {
  const collection: string[] = [];
  const delivery: string[] = [];
  for (const part of String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)) {
    if (/^collection:\s*/i.test(part)) collection.push(part.replace(/^collection:\s*/i, ''));
    else if (/^delivery:\s*/i.test(part)) delivery.push(part.replace(/^delivery:\s*/i, ''));
  }
  return { collection, delivery };
};

const specialFlag = (requirements: string, phrase: RegExp) => phrase.test(requirements);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Booking prefill is temporarily unavailable.' });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get('companyId')?.trim() ?? '';
  const action = url.searchParams.get('action')?.trim().toLowerCase() as CloneAction;
  if (!['rebook', 'repost'].includes(action)) return respond(400, { error: 'A valid clone action is required.' });

  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;
  const { id } = await params;

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,company_id,status,current_status,client_name,client_email,client_phone,pickup_location,pickup_postcode,collection_contact_name,collection_contact_phone,delivery_location,delivery_postcode,delivery_contact_name,delivery_contact_phone,requested_vehicle_label,vehicle_type,requested_cargo_label,cargo_type,weight_kg,pallets,items,pallet_type,pallet_stackable,length_cm,width_cm,height_cm,cargo_value_gbp,collection_tail_lift_required,collection_forklift_available,collection_handball_required,delivery_tail_lift_required,delivery_forklift_available,delivery_handball_required,document_checklist,access_restrictions,special_requirements,load_details,is_fixed_price')
    .eq('id', id)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'The source booking could not be loaded.' });
  if (!job) return respond(404, { error: 'The source booking was not found.' });
  if (String(job.company_id) !== admin.companyId) {
    return respond(403, { error: 'Only the load-owning company can create a new booking from this record.' });
  }

  const status = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
  const allowed = action === 'rebook' ? REBOOK_STATUSES.has(status) : REPOST_STATUSES.has(status);
  if (!allowed) {
    return respond(409, {
      error: action === 'rebook'
        ? 'Re-book is available for delivered, completed, cancelled or expired bookings.'
        : 'Re-post is available for cancelled or expired bookings.',
    });
  }

  const { data: stops, error: stopsError } = await supabaseAdmin
    .from('job_stops')
    .select('sequence,stop_type,address,postcode,contact_name,contact_phone,instructions')
    .eq('job_id', id)
    .order('sequence', { ascending: true });
  if (stopsError) return respond(500, { error: 'The source route stops could not be loaded.' });

  const details = parseLoadDetails(job.load_details);
  const restrictions = splitRestrictions(job.access_restrictions);
  const requirements = String(job.special_requirements ?? '');
  const vehicleLabel = text(job.requested_vehicle_label)
    ?? VEHICLE_TYPE_LABELS[String(job.vehicle_type ?? '')]
    ?? 'LWB Van';
  const cargoLabel = text(job.requested_cargo_label)
    ?? CARGO_TYPE_LABELS[String(job.cargo_type ?? '') as keyof typeof CARGO_TYPE_LABELS]
    ?? 'Other';
  const stopRows = (stops ?? []).slice(1, -1).map((stop) => ({
    type: stop.stop_type === 'collection' ? 'collection' : 'delivery',
    address: text(stop.address) ?? '',
    postcode: text(stop.postcode) ?? '',
    contact: text(stop.contact_name) ?? '',
    phone: text(stop.contact_phone) ?? '',
    instructions: text(stop.instructions) ?? '',
    date: '',
    time: '',
  }));

  return respond(200, {
    source: { id: String(job.id), action, status },
    notice: action === 'rebook'
      ? 'Operational details were copied from the historical booking. Schedule, references, prices, award, driver, POD and invoice state were reset.'
      : 'Operational details were copied into a new posting. Schedule, references, prices, award, driver, POD and invoice state were reset.',
    prefill: {
      clientName: text(job.client_name) ?? '',
      clientEmail: text(job.client_email) ?? '',
      clientPhone: text(job.client_phone) ?? '',
      pickupAddress: stripPostcodeSuffix(job.pickup_location, job.pickup_postcode),
      pickupPostcode: text(job.pickup_postcode) ?? '',
      collectionContact: text(job.collection_contact_name) ?? '',
      collectionPhone: text(job.collection_contact_phone) ?? '',
      deliveryAddress: stripPostcodeSuffix(job.delivery_location, job.delivery_postcode),
      deliveryPostcode: text(job.delivery_postcode) ?? '',
      deliveryContact: text(job.delivery_contact_name) ?? '',
      deliveryPhone: text(job.delivery_contact_phone) ?? '',
      vehicle: vehicleLabel,
      cargo: cargoLabel,
      weight: numberValue(job.weight_kg)?.toString() ?? '',
      pallets: numberValue(job.pallets)?.toString() ?? '',
      itemCount: numberValue(job.items)?.toString() ?? '',
      palletType: text(job.pallet_type) ?? '',
      palletStackable: boolValue(job.pallet_stackable) === true ? 'yes' : boolValue(job.pallet_stackable) === false ? 'no' : '',
      length: numberValue(job.length_cm)?.toString() ?? '',
      width: numberValue(job.width_cm)?.toString() ?? '',
      height: numberValue(job.height_cm)?.toString() ?? '',
      cargoValue: numberValue(job.cargo_value_gbp)?.toString() ?? '',
      customerReference: '',
      purchaseOrder: '',
      bookingReference: '',
      customerPrice: '',
      targetCarrierCost: '',
      tailLift: boolValue(job.collection_tail_lift_required) ?? specialFlag(requirements, /tail lift required/i),
      forklift: boolValue(job.collection_forklift_available) ?? specialFlag(requirements, /forklift available at collection/i),
      handball: boolValue(job.collection_handball_required) ?? specialFlag(requirements, /handball required/i),
      deliveryTailLift: boolValue(job.delivery_tail_lift_required) ?? false,
      deliveryForklift: boolValue(job.delivery_forklift_available) ?? false,
      deliveryHandball: boolValue(job.delivery_handball_required) ?? false,
      adr: specialFlag(requirements, /adr required/i),
      temperatureControlled: specialFlag(requirements, /temperature controlled/i),
      fragile: specialFlag(requirements, /fragile goods/i),
      pumpTruck: specialFlag(requirements, /pump truck required/i),
      twoPersonCrew: specialFlag(requirements, /two-person crew required/i),
      dedicatedVehicle: specialFlag(requirements, /dedicated vehicle/i),
      isFixedPrice: false,
      collectionAccessRestrictions: restrictions.collection.join('\n'),
      deliveryAccessRestrictions: restrictions.delivery.join('\n'),
      documentChecklist: Array.isArray(job.document_checklist) ? job.document_checklist.filter((value): value is string => typeof value === 'string').join('\n') : '',
      publicQuoteNotes: text(details.publicQuoteNotes) ?? '',
      executionInstructions: text(details.executionInstructions) ?? text(details.notes) ?? '',
      additionalStops: stopRows,
    },
  });
}
