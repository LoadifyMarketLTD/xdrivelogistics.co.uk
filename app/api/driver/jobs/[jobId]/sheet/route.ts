import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { operationalError } from '../../../../_lib/operationalError';
import { isDriverContext, requireDriver, respond } from '../../../mobile/_lib';

function text(value: unknown) {
  return typeof value === 'string' ? value : value == null ? null : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : null;
}

function boolValue(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function parseLoadDetails(value: unknown) {
  const raw = text(value)?.trim();
  if (!raw) return { publicQuoteNotes: null, executionInstructions: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { publicQuoteNotes: null, executionInstructions: raw };
    }
    const object = parsed as Record<string, unknown>;
    return {
      publicQuoteNotes: text(object.publicQuoteNotes),
      executionInstructions: text(object.executionInstructions) ?? text(object.notes),
    };
  } catch {
    return { publicQuoteNotes: null, executionInstructions: raw };
  }
}

function requirementFlags(job: Record<string, unknown>, vehicle: Record<string, unknown>) {
  const rows: string[] = [];
  const push = (condition: boolean, label: string) => { if (condition && !rows.includes(label)) rows.push(label); };
  push(job.collection_tail_lift_required === true || job.delivery_tail_lift_required === true, 'Tail lift required');
  push(job.collection_forklift_available === true || job.delivery_forklift_available === true, 'Forklift available / required');
  push(job.collection_handball_required === true || job.delivery_handball_required === true, 'Handball required');
  push(job.direct_delivery_required === true, 'Direct delivery');
  push(vehicle.has_tail_lift === true, 'Vehicle has tail lift');
  const special = text(job.special_requirements);
  if (special) rows.push(special);
  const access = text(job.access_restrictions);
  if (access) rows.push(`Access: ${access}`);
  return rows;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'The job sheet is temporarily unavailable.',
      context: 'driver.job-sheet.config',
      retryable: true,
    });
  }
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { jobId } = await params;
  const { data: rawJob, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) {
    return operationalError({
      message: 'The job sheet could not be loaded. Please retry.',
      context: `driver.job-sheet.job:${jobId}`,
      cause: jobError,
    });
  }
  if (!rawJob) return respond(404, { error: 'This job is not assigned to your driver account.' });

  const job = rawJob as Record<string, unknown>;
  const originCompanyId = text(job.company_id);
  const vehicleId = text(job.vehicle_id);

  const acceptedBidPromise = driver.companyId
    ? supabaseAdmin.from('job_bids').select('*').eq('job_id', jobId).eq('company_id', driver.companyId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(1).maybeSingle()
    : supabaseAdmin.from('job_bids').select('*').eq('job_id', jobId).eq('bidder_driver_id', driver.driverId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const invoicePromise = driver.companyId
    ? supabaseAdmin.from('invoices').select('*').eq('job_id', jobId).eq('company_id', driver.companyId).order('created_at', { ascending: false }).limit(5)
    : Promise.resolve({ data: [], error: null });

  const [companyResult, bidResult, agreementResult, trackingResult, invoiceResult, documentsResult, vehicleResult, driverResult] = await Promise.all([
    originCompanyId ? supabaseAdmin.from('companies').select('*').eq('id', originCompanyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    acceptedBidPromise,
    supabaseAdmin.from('job_commercial_agreements').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('job_tracking_events').select('*').eq('job_id', jobId).order('created_at', { ascending: true }).limit(250),
    invoicePromise,
    supabaseAdmin.from('job_documents').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(100),
    vehicleId
      ? supabaseAdmin.from('vehicles').select('*').eq('id', vehicleId).maybeSingle()
      : supabaseAdmin.from('vehicles').select('*').eq('assigned_driver_id', driver.driverId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('drivers').select('*').eq('id', driver.driverId).maybeSingle(),
  ]);

  const company = (companyResult.data ?? {}) as Record<string, unknown>;
  const acceptedBid = (bidResult.data ?? {}) as Record<string, unknown>;
  const agreement = (agreementResult.data ?? {}) as Record<string, unknown>;
  const vehicle = (vehicleResult.data ?? {}) as Record<string, unknown>;
  const driverRow = (driverResult.data ?? {}) as Record<string, unknown>;
  const loadDetails = parseLoadDetails(job.load_details);

  const acceptedRate = numberValue(agreement.agreed_amount)
    ?? numberValue(job.agreed_rate_gbp)
    ?? numberValue(job.agreed_rate)
    ?? numberValue(acceptedBid.bid_price_gbp)
    ?? numberValue(acceptedBid.amount)
    ?? null;
  const acceptedGross = numberValue(agreement.agreed_gross_amount);
  const paymentTerms = text(agreement.payment_terms)
    ?? text(job.payment_terms)
    ?? null;
  const podRequired = boolValue(agreement.pod_required)
    ?? boolValue(job.pod_required)
    ?? true;
  const acceptedAt = text(agreement.accepted_at)
    ?? text(agreement.agreed_at)
    ?? text(acceptedBid.updated_at)
    ?? text(acceptedBid.created_at)
    ?? null;

  const timeline = trackingResult.error ? [] : (trackingResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    eventType: text(entry.event_type) ?? 'update',
    message: text(entry.message) ?? text(entry.note),
    meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : null,
    createdAt: text(entry.created_at) ?? text(entry.event_time),
  }));
  const documents = documentsResult.error ? [] : (documentsResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    type: text(entry.doc_type) ?? text(entry.file_type) ?? 'Document',
    fileName: text(entry.file_name),
    filePath: text(entry.file_path) ?? text(entry.file_url),
    createdAt: text(entry.created_at) ?? text(entry.uploaded_at),
  }));
  const invoices = invoiceResult.error ? [] : (invoiceResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    number: text(entry.invoice_number),
    status: text(entry.status),
    paymentStatus: text(entry.payment_status),
    amount: numberValue(entry.amount) ?? numberValue(entry.total),
    currency: text(entry.currency) ?? 'GBP',
    dueDate: text(entry.due_date),
  }));

  const allocatedVehicleRef = text(vehicle.reg_plate) ?? text(job.vehicle_ref);
  const allocatedVehicleType = text(vehicle.type) ?? (vehicleId ? text(job.vehicle_type) : null);
  const requestedVehicle = text(job.requested_vehicle_label)
    ?? text(job.requested_vehicle_type)
    ?? text(job.vehicle_type);
  const requestedCargo = text(job.requested_cargo_label) ?? text(job.cargo_type);
  const requirements = requirementFlags(job, vehicle);
  const hardCopyPod = text(job.hard_copy_pod)
    ?? (podRequired ? 'POD required; hard-copy requirement not separately supplied' : 'Not required');
  const deliveryPhotos = Array.isArray(job.delivery_photos) ? job.delivery_photos : [];
  const podPhotos = Array.isArray(job.pod_photos) ? job.pod_photos : [];

  return respond(200, {
    sheet: {
      reference: text(job.booking_reference) || `XDL-${jobId.slice(0, 8).toUpperCase()}`,
      loadId: jobId,
      status: text(job.current_status) || text(job.status) || 'allocated',
      bookedAt: acceptedAt,
      postingCompanyId: originCompanyId,
      bookedBy: text(company.name) || 'Marketplace member',
      memberCode: text(company.company_number),
      memberPhone: text(company.phone),
      executingCompanyId: text(agreement.supplier_company_id) ?? text(job.awarded_carrier_company_id) ?? driver.companyId,
      driverId: driver.driverId,
      driverName: text(driverRow.display_name),
      agreedRate: acceptedRate,
      agreedGross: acceptedGross,
      vatRate: numberValue(agreement.vat_rate),
      vatAmount: numberValue(agreement.vat_amount),
      currency: text(agreement.currency) ?? text(job.currency) ?? text(acceptedBid.currency) ?? 'GBP',
      paymentTerms,
      paymentDueDays: numberValue(agreement.payment_due_days),
      commercialSnapshotAvailable: Boolean(agreementResult.data && !agreementResult.error),
      customerName: text(job.client_name),
      customerReference: text(job.customer_reference),
      purchaseOrderNumber: text(job.purchase_order_number),
      bookingReference: text(job.booking_reference),
      distanceMiles: numberValue(job.job_distance_miles) ?? numberValue(job.distance_miles),
      requestedVehicle,
      allocatedVehicle: {
        id: text(vehicle.id),
        ref: allocatedVehicleRef,
        type: allocatedVehicleType,
        bodyType: text(vehicle.body_type),
        make: text(vehicle.make),
        model: text(vehicle.model),
        payloadKg: numberValue(vehicle.payload_kg),
        palletsCapacity: numberValue(vehicle.pallets_capacity),
        hasTailLift: boolValue(vehicle.has_tail_lift),
        source: vehicleId ? 'job' : vehicleResult.data ? 'driver_current' : 'none',
      },
      cargo: {
        type: requestedCargo,
        weightKg: numberValue(job.weight_kg),
        pallets: numberValue(job.pallets),
        lengthCm: numberValue(job.length_cm),
        widthCm: numberValue(job.width_cm),
        heightCm: numberValue(job.height_cm),
        cargoValueGbp: numberValue(job.cargo_value_gbp),
        palletType: text(job.pallet_type),
        stackable: boolValue(job.pallet_stackable),
      },
      requirements,
      hardCopyPod,
      podRequired,
      pickup: {
        address: text(job.pickup_location),
        postcode: text(job.pickup_postcode),
        dateTime: text(job.pickup_datetime) ?? text(job.collection_window_start),
        slot: text(job.pickup_time_slot),
        contactName: text(job.collection_contact_name),
        contactPhone: text(job.collection_contact_phone),
        notes: text(job.collection_notes),
      },
      delivery: {
        address: text(job.delivery_location),
        postcode: text(job.delivery_postcode),
        dateTime: text(job.delivery_datetime) ?? text(job.delivery_window_start),
        slot: text(job.delivery_time_slot),
        contactName: text(job.delivery_contact_name),
        contactPhone: text(job.delivery_contact_phone),
        notes: text(job.delivery_notes),
        receiverName: text(job.client_signature_name),
        signatureRecorded: Boolean(text(job.delivery_signature_data) ?? text(job.pod_signature_url)),
      },
      pod: {
        generated: boolValue(job.pod_generated),
        generatedAt: text(job.pod_generated_at),
        photoCount: Math.max(deliveryPhotos.length, podPhotos.length),
        collectionPhotoRecorded: Boolean(text(job.collection_photo_url)),
        receiverName: text(job.client_signature_name),
        signatureRecorded: Boolean(text(job.delivery_signature_data) ?? text(job.pod_signature_url)),
      },
      publicQuoteNotes: loadDetails.publicQuoteNotes,
      executionInstructions: loadDetails.executionInstructions ?? text(job.load_notes),
      driverNotes: text(job.driver_notes),
      documentChecklist: Array.isArray(job.document_checklist) ? job.document_checklist : [],
      timeline,
      documents,
      invoices,
      partial: Boolean(
        companyResult.error
        || bidResult.error
        || agreementResult.error
        || trackingResult.error
        || invoiceResult.error
        || documentsResult.error
        || vehicleResult.error
        || driverResult.error
      ),
      unavailable: {
        bodyType: text(vehicle.body_type) ? null : 'No verified body-type value is available for this allocated/current vehicle.',
        extras: 'No immutable waiting/loading/cancellation extras snapshot is exposed by the current verified data contract.',
        bookingFooter: 'No historical booking-footer snapshot is exposed by the current verified data contract.',
      },
    },
  });
}
