import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import {
  hasPod,
  isDriverContext,
  mapJob,
  MobileJobRow,
  requireDriver,
  respond,
} from '../../_lib';

type AnyRow = Record<string, any>;

type JobStopRow = {
  id: string;
  sequence: number;
  stop_type: string | null;
  address: string | null;
  postcode: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  window_start: string | null;
  window_end: string | null;
  instructions: string | null;
  status: string | null;
};

function text(value: unknown) {
  if (value === null || value === undefined) return null;
  const rendered = String(value).trim();
  return rendered || null;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolValue(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function record(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function parseLoadDetails(raw: unknown) {
  const source = text(raw);
  if (!source) return { parsed: null as Record<string, any> | null, rawText: null as string | null };
  try {
    const parsed = JSON.parse(source) as unknown;
    return { parsed: record(parsed), rawText: null as string | null };
  } catch {
    return { parsed: null as Record<string, any> | null, rawText: source };
  }
}

function mapStop(stop: JobStopRow) {
  return {
    id: stop.id,
    sequence: Number(stop.sequence),
    type: stop.stop_type || undefined,
    address: [stop.address, stop.postcode].filter(Boolean).join(', ') || 'Stop address TBC',
    postcode: stop.postcode || undefined,
    company: stop.company_name || undefined,
    contactPerson: stop.contact_name || undefined,
    telephone: stop.contact_phone || undefined,
    timeWindowFrom: stop.window_start || undefined,
    timeWindowTo: stop.window_end || undefined,
    status: stop.status || 'pending',
    notes: stop.instructions || undefined,
  };
}

function requirementFlags(job: AnyRow, parsed: Record<string, any> | null, vehicle: AnyRow) {
  const rows: string[] = [];
  const collection = record(parsed?.collection);
  const delivery = record(parsed?.delivery);
  const add = (enabled: boolean, label: string) => {
    if (enabled && !rows.includes(label)) rows.push(label);
  };

  add(job.collection_tail_lift_required === true || collection?.tailLiftRequired === true, 'Collection tail lift required');
  add(job.delivery_tail_lift_required === true || delivery?.tailLiftRequired === true, 'Delivery tail lift required');
  add(job.collection_forklift_available === true || collection?.forkliftAvailable === true, 'Collection forklift available');
  add(job.delivery_forklift_available === true || delivery?.forkliftAvailable === true, 'Delivery forklift available');
  add(job.collection_handball_required === true || collection?.handballRequired === true, 'Collection handball required');
  add(job.delivery_handball_required === true || delivery?.handballRequired === true, 'Delivery handball required');
  add(job.direct_delivery_required === true, 'Direct delivery');
  add(vehicle.has_tail_lift === true, 'Allocated vehicle has tail lift');

  const special = text(job.special_requirements);
  if (special && !rows.includes(special)) rows.push(special);
  const access = text(job.access_restrictions);
  if (access && !rows.includes(`Access: ${access}`)) rows.push(`Access: ${access}`);
  return rows;
}

function normalizeHistory(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry, index) => ({
      id: `status-history-${index}`,
      eventType: text(entry.status) || 'update',
      message: text(entry.notes ?? entry.note ?? entry.message),
      createdAt: text(entry.timestamp ?? entry.created_at ?? entry.event_time),
      source: text(entry.source),
    }))
    .filter((entry) => entry.createdAt);
}

function legacyStops(job: AnyRow, mapped: ReturnType<typeof mapJob>, parsed: Record<string, any> | null) {
  const collection = record(parsed?.collection);
  const delivery = record(parsed?.delivery);
  const collectionContactName = text(job.collection_contact_name) ?? text(collection?.contactName);
  const collectionContactPhone = text(job.collection_contact_phone) ?? text(collection?.contactPhone);
  const deliveryContactName = text(job.delivery_contact_name) ?? text(delivery?.contactName);
  const deliveryContactPhone = text(job.delivery_contact_phone) ?? text(delivery?.contactPhone);

  return [
    {
      sequence: 1,
      type: 'collection',
      address: [text(job.pickup_location), text(job.pickup_postcode)].filter(Boolean).join(', ') || mapped.pickupLocation,
      postcode: text(job.pickup_postcode) || undefined,
      contactPerson: collectionContactName || undefined,
      telephone: collectionContactPhone || undefined,
      timeWindowFrom: text(job.pickup_datetime) ?? text(job.collection_window_start) ?? mapped.pickupTime,
      timeWindowTo: text(job.collection_window_end) || undefined,
      notes: text(job.collection_notes) ?? text(collection?.instructions) ?? undefined,
      status: 'pending',
    },
    {
      sequence: 2,
      type: 'delivery',
      address: [text(job.delivery_location), text(job.delivery_postcode)].filter(Boolean).join(', ') || mapped.deliveryLocation,
      postcode: text(job.delivery_postcode) || undefined,
      contactPerson: deliveryContactName || undefined,
      telephone: deliveryContactPhone || undefined,
      timeWindowFrom: text(job.delivery_datetime) ?? text(job.delivery_window_start) ?? mapped.deliveryTime,
      timeWindowTo: text(job.delivery_window_end) || undefined,
      notes: text(job.delivery_notes) ?? text(delivery?.instructions) ?? undefined,
      status: 'pending',
    },
  ];
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  const job = data as AnyRow;
  const row = data as unknown as MobileJobRow;
  const mapped = mapJob(row);
  const { parsed, rawText } = parseLoadDetails(job.load_details);
  const references = record(parsed?.references);
  const collection = record(parsed?.collection);
  const delivery = record(parsed?.delivery);
  const dimensions = record(parsed?.dimensionsCm);
  const palletDetails = record(parsed?.palletDetails);
  const originCompanyId = text(job.company_id);
  const vehicleId = text(job.vehicle_id);

  const [companyResult, bidResult, agreementResult, trackingResult, documentsResult, vehicleResult, stopsResult] = await Promise.all([
    originCompanyId
      ? supabaseAdmin.from('companies').select('*').eq('id', originCompanyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from('job_bids')
      .select('*')
      .eq('job_id', id)
      .eq('company_id', driver.companyId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('job_commercial_agreements')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('job_tracking_events')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: true })
      .limit(250),
    supabaseAdmin
      .from('job_documents')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    vehicleId
      ? supabaseAdmin.from('vehicles').select('*').eq('id', vehicleId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from('job_stops')
      .select('id,sequence,stop_type,address,postcode,company_name,contact_name,contact_phone,window_start,window_end,instructions,status')
      .eq('job_id', id)
      .order('sequence', { ascending: true }),
  ]);

  const company = (companyResult.data ?? {}) as AnyRow;
  const acceptedBid = (bidResult.data ?? {}) as AnyRow;
  const agreement = (agreementResult.data ?? {}) as AnyRow;
  const vehicle = (vehicleResult.data ?? {}) as AnyRow;

  const persistentStops = stopsResult.error
    ? []
    : ((stopsResult.data ?? []) as unknown as JobStopRow[]).map(mapStop);
  const stops = persistentStops.length > 0 ? persistentStops : legacyStops(job, mapped, parsed);

  const acceptedRate = numberValue(agreement.agreed_amount)
    ?? numberValue(job.agreed_rate_gbp)
    ?? numberValue(job.agreed_rate)
    ?? numberValue(acceptedBid.bid_price_gbp)
    ?? numberValue(acceptedBid.amount)
    ?? null;
  const currency = text(agreement.currency) ?? text(job.currency) ?? text(acceptedBid.currency) ?? 'GBP';
  const paymentTerms = text(agreement.payment_terms) ?? text(job.payment_terms);
  const paymentDueDays = numberValue(agreement.payment_due_days);
  const bookedAt = text(agreement.accepted_at)
    ?? text(agreement.agreed_at)
    ?? text(acceptedBid.updated_at)
    ?? text(acceptedBid.created_at);

  const postingCompanyName = text(company.name) ?? text(job.booked_by_company_name) ?? 'Marketplace member';
  const postingCompanyMemberCode = text(company.company_number);
  const postingCompanyPhone = text(company.phone);

  const customerReference = text(job.customer_reference) ?? text(references?.customerReference);
  const purchaseOrderNumber = text(job.purchase_order_number) ?? text(references?.purchaseOrderNumber);
  const bookingReference = text(job.booking_reference) ?? text(references?.bookingReference);

  const cargo = {
    type: text(job.requested_cargo_label) ?? text(parsed?.requestedCargo) ?? text(job.cargo_type),
    weightKg: numberValue(job.weight_kg),
    pallets: numberValue(job.pallets) ?? numberValue(palletDetails?.count),
    palletType: text(job.pallet_type) ?? text(palletDetails?.type),
    stackable: boolValue(job.pallet_stackable) ?? boolValue(palletDetails?.stackable),
    lengthCm: numberValue(job.length_cm) ?? numberValue(dimensions?.length),
    widthCm: numberValue(job.width_cm) ?? numberValue(dimensions?.width),
    heightCm: numberValue(job.height_cm) ?? numberValue(dimensions?.height),
    cargoValueGbp: numberValue(job.cargo_value_gbp) ?? numberValue(parsed?.cargoValueGbp),
  };

  const requestedVehicle = text(job.requested_vehicle_label) ?? text(parsed?.requestedVehicle) ?? text(job.requested_vehicle_type) ?? text(job.vehicle_type);
  const allocatedVehicle = {
    id: vehicleId,
    registration: vehicleId ? text(vehicle.reg_plate) ?? text(job.vehicle_ref) : null,
    type: vehicleId ? text(vehicle.type) ?? text(job.vehicle_type) : null,
    bodyType: vehicleId ? text(vehicle.body_type) : null,
    make: vehicleId ? text(vehicle.make) : null,
    model: vehicleId ? text(vehicle.model) : null,
    payloadKg: vehicleId ? numberValue(vehicle.payload_kg) : null,
    palletsCapacity: vehicleId ? numberValue(vehicle.pallets_capacity) : null,
    hasTailLift: vehicleId ? boolValue(vehicle.has_tail_lift) : null,
  };

  const requirements = requirementFlags(job, parsed, vehicle);
  const documentChecklist = Array.isArray(job.document_checklist)
    ? job.document_checklist.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : Array.isArray(parsed?.documentChecklist)
      ? parsed.documentChecklist.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

  const executionInstructions = text(parsed?.executionInstructions)
    ?? text(parsed?.notes)
    ?? rawText
    ?? text(job.load_notes);
  const specialInstructions = [
    executionInstructions,
    text(job.special_requirements),
    text(job.access_restrictions),
  ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join('\n\n');

  const documents = documentsResult.error ? [] : (documentsResult.data ?? []).map((entry: AnyRow) => ({
    id: text(entry.id),
    type: text(entry.doc_type) ?? text(entry.file_type) ?? 'Document',
    fileName: text(entry.file_name) ?? text(entry.name),
    filePath: text(entry.file_path) ?? text(entry.file_url),
    createdAt: text(entry.created_at) ?? text(entry.uploaded_at),
  }));

  const trackingTimeline = trackingResult.error ? [] : (trackingResult.data ?? []).map((entry: AnyRow) => ({
    id: text(entry.id),
    eventType: text(entry.event_type) ?? 'update',
    message: text(entry.message) ?? text(entry.note),
    createdAt: text(entry.created_at) ?? text(entry.event_time),
    source: 'server',
  }));
  const auditTrail = trackingTimeline.length > 0 ? trackingTimeline : normalizeHistory(job.status_history);

  const deliveryPhotos = Array.isArray(job.delivery_photos) ? job.delivery_photos : [];
  const podPhotos = Array.isArray(job.pod_photos) ? job.pod_photos : [];
  const podCompleted = hasPod(row);
  const pod = {
    completed: podCompleted,
    generated: boolValue(job.pod_generated),
    generatedAt: text(job.pod_generated_at),
    collectionPhotoRecorded: Boolean(text(job.collection_photo_url)),
    deliveryPhotoCount: Math.max(deliveryPhotos.length, podPhotos.length),
    receiverName: text(job.client_signature_name),
    signatureRecorded: Boolean(job.delivery_signature_data || text(job.pod_signature_url)),
  };

  const partial = Boolean(
    companyResult.error
    || bidResult.error
    || agreementResult.error
    || trackingResult.error
    || documentsResult.error
    || vehicleResult.error
    || stopsResult.error
  );

  return respond(200, {
    job: {
      ...mapped,
      reference: bookingReference || mapped.reference,
      postingCompanyName,
      postingCompanyMemberCode: postingCompanyMemberCode || undefined,
      postingCompanyPhone: postingCompanyPhone || undefined,
      customerName: text(job.client_name) || undefined,
      customerReference: customerReference || undefined,
      purchaseOrderNumber: purchaseOrderNumber || undefined,
      bookingReference: bookingReference || undefined,
      privateDetailsRevealed: true,
      fullWorkOrder: true,
      stops,
      requestedVehicle: requestedVehicle || undefined,
      allocatedVehicle,
      cargo,
      requirements,
      documentChecklist,
      commercial: {
        bookedAt,
        agreedRate: acceptedRate,
        currency,
        paymentTerms,
        paymentDueDays,
        snapshotAvailable: Boolean(agreementResult.data && !agreementResult.error),
      },
      notes: {
        publicQuoteNotes: text(parsed?.publicQuoteNotes),
        executionInstructions,
        collectionNotes: text(job.collection_notes) ?? text(collection?.instructions),
        deliveryNotes: text(job.delivery_notes) ?? text(delivery?.instructions),
        driverNotes: text(job.driver_notes),
      },
      specialInstructions: specialInstructions || undefined,
      attachments: documents,
      documents,
      auditTrail,
      pod,
      podCompleted,
      distanceMiles: numberValue(job.job_distance_miles) ?? numberValue(job.distance_miles),
      etaMinutes: numberValue(job.job_distance_minutes),
      partial,
    },
    multiDropPartial: Boolean(stopsResult.error),
    enrichmentPartial: partial,
  });
}
