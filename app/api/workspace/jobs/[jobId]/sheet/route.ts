import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { operationalError } from '../../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? null : String(value);
const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : null;
};
const boolValue = (value: unknown) => typeof value === 'boolean' ? value : null;

function parseLoadDetails(value: unknown) {
  const raw = text(value)?.trim();
  if (!raw) return { publicQuoteNotes: null, executionInstructions: null, targetCarrierCost: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { publicQuoteNotes: null, executionInstructions: raw, targetCarrierCost: null };
    }
    const object = parsed as Record<string, unknown>;
    return {
      publicQuoteNotes: text(object.publicQuoteNotes),
      executionInstructions: text(object.executionInstructions) ?? text(object.notes),
      targetCarrierCost: numberValue(object.targetCarrierCost),
    };
  } catch {
    return { publicQuoteNotes: null, executionInstructions: raw, targetCarrierCost: null };
  }
}

function requirements(job: Record<string, unknown>) {
  const rows: string[] = [];
  const push = (condition: boolean, label: string) => { if (condition && !rows.includes(label)) rows.push(label); };
  push(job.collection_tail_lift_required === true || job.delivery_tail_lift_required === true, 'Tail lift');
  push(job.collection_forklift_available === true || job.delivery_forklift_available === true, 'Forklift');
  push(job.collection_handball_required === true || job.delivery_handball_required === true, 'Handball');
  push(job.direct_delivery_required === true, 'Direct delivery');
  const special = text(job.special_requirements); if (special) rows.push(special);
  const access = text(job.access_restrictions); if (access) rows.push(`Access: ${access}`);
  return rows;
}

function invoiceVisibleToCompany(
  invoice: Record<string, unknown>,
  viewerCompanyId: string,
  ownerCompanyId: string,
) {
  const ids = [invoice.company_id, invoice.customer_company_id, invoice.bill_to_company_id, invoice.buyer_company_id, invoice.supplier_company_id]
    .map(text)
    .filter((value): value is string => Boolean(value));
  // Legacy job-linked invoices without explicit party columns remain visible to
  // the job owner only. Awarded carriers must have an explicit invoice party.
  return ids.length === 0 ? viewerCompanyId === ownerCompanyId : ids.includes(viewerCompanyId);
}

function workspaceKind(companyType: unknown) {
  const type = String(companyType ?? '').trim().toLowerCase();
  if (type === 'broker') return 'broker' as const;
  if (['customer', 'shipper'].includes(type)) return 'customer' as const;
  return 'carrier' as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'The job sheet is temporarily unavailable.',
      context: 'workspace.job-sheet.config',
      retryable: true,
    });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { jobId } = await params;
  const { data: rawJob, error: jobError } = await supabaseAdmin.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (jobError) {
    return operationalError({
      status: 500,
      message: 'The job sheet could not be loaded.',
      context: `workspace.job-sheet.job:${jobId}`,
      cause: jobError,
      retryable: true,
    });
  }
  if (!rawJob) return respond(404, { error: 'Job not found.' });

  const job = rawJob as Record<string, unknown>;
  const ownerCompanyId = text(job.company_id);
  if (!ownerCompanyId) return respond(404, { error: 'Job company is unavailable.' });

  const awardedCompanyId = text(job.awarded_carrier_company_id) ?? text(job.assigned_company_id);
  const allowedCompanyIds = [...new Set([ownerCompanyId, awardedCompanyId].filter((value): value is string => Boolean(value)))];

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('company_id', allowedCompanyIds);

  if (membershipError) {
    return operationalError({
      status: 500,
      message: 'Your company access could not be verified.',
      context: `workspace.job-sheet.membership:${jobId}`,
      cause: membershipError,
      retryable: true,
    });
  }
  if (!memberships?.length) return respond(403, { error: 'You do not have access to this job sheet.' });

  // Prefer the job-owner context when a user genuinely belongs to both sides;
  // otherwise use the awarded carrier membership. This prevents a carrier-only
  // viewer from receiving owner/broker commercial fields.
  const ownerMembership = memberships.find((membership) => String(membership.company_id) === ownerCompanyId);
  const viewerCompanyId = ownerMembership
    ? ownerCompanyId
    : String(memberships[0]?.company_id ?? '');
  if (!viewerCompanyId) return respond(403, { error: 'You do not have access to this job sheet.' });

  const viewerIsAwardedCarrier = Boolean(awardedCompanyId && viewerCompanyId === awardedCompanyId && viewerCompanyId !== ownerCompanyId);
  const assignedDriverId = text(job.assigned_driver_id);
  const assignedVehicleId = text(job.vehicle_id);

  const [
    ownerCompanyResult,
    carrierCompanyResult,
    viewerCompanyResult,
    bidResult,
    agreementResult,
    driverResult,
    vehicleResult,
    trackingResult,
    documentsResult,
    invoicesResult,
    carrierMembersResult,
  ] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name, company_number, phone, company_type').eq('id', ownerCompanyId).maybeSingle(),
    awardedCompanyId ? supabaseAdmin.from('companies').select('id, name, company_number, phone, company_type').eq('id', awardedCompanyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('companies').select('id, name, company_number, phone, company_type').eq('id', viewerCompanyId).maybeSingle(),
    supabaseAdmin.from('job_bids').select('*').eq('job_id', jobId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('job_commercial_agreements').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    assignedDriverId ? supabaseAdmin.from('drivers').select('id, display_name, user_id').eq('id', assignedDriverId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    assignedVehicleId ? supabaseAdmin.from('vehicles').select('id, reg_plate, type, make, model, body_type, payload_kg, pallets_capacity, has_tail_lift').eq('id', assignedVehicleId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('job_tracking_events').select('*').eq('job_id', jobId).order('created_at', { ascending: true }).limit(250),
    supabaseAdmin.from('job_documents').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('invoices').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(20),
    viewerIsAwardedCarrier
      ? supabaseAdmin.from('company_memberships').select('user_id').eq('company_id', viewerCompanyId).eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
  ]);

  const ownerCompany = (ownerCompanyResult.data ?? {}) as Record<string, unknown>;
  const carrierCompany = (carrierCompanyResult.data ?? {}) as Record<string, unknown>;
  const viewerCompany = (viewerCompanyResult.data ?? {}) as Record<string, unknown>;
  const acceptedBid = (bidResult.data ?? {}) as Record<string, unknown>;
  const agreement = (agreementResult.data ?? {}) as Record<string, unknown>;
  const driver = (driverResult.data ?? {}) as Record<string, unknown>;
  const vehicle = (vehicleResult.data ?? {}) as Record<string, unknown>;
  const details = parseLoadDetails(job.load_details);
  const viewerWorkspace = workspaceKind(viewerCompany.company_type);

  const carrierCost = numberValue(agreement.agreed_amount)
    ?? numberValue(job.agreed_rate_gbp)
    ?? numberValue(job.agreed_rate)
    ?? numberValue(acceptedBid.bid_price_gbp)
    ?? numberValue(acceptedBid.amount);
  const rawCustomerPrice = numberValue(job.budget_amount);
  const customerPrice = viewerIsAwardedCarrier ? null : rawCustomerPrice;
  const brokerMargin = rawCustomerPrice != null && carrierCost != null ? rawCustomerPrice - carrierCost : null;
  const paymentTerms = text(agreement.payment_terms) ?? text(job.payment_terms);
  const podRequired = boolValue(agreement.pod_required) ?? boolValue(job.pod_required) ?? true;

  const timeline = trackingResult.error ? [] : (trackingResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    eventType: text(entry.event_type) ?? 'update',
    message: text(entry.message) ?? text(entry.note),
    createdAt: text(entry.created_at) ?? text(entry.event_time),
    userName: text(entry.user_name),
  }));

  const carrierMemberUserIds = new Set(
    ((carrierMembersResult.data ?? []) as Array<Record<string, unknown>>)
      .map((entry) => text(entry.user_id))
      .filter((value): value is string => Boolean(value)),
  );
  const assignedDriverUserId = text(driver.user_id);
  if (assignedDriverUserId) carrierMemberUserIds.add(assignedDriverUserId);

  const rawDocuments = documentsResult.error ? [] : ((documentsResult.data ?? []) as Record<string, unknown>[]);
  const visibleDocuments = viewerIsAwardedCarrier
    ? rawDocuments.filter((entry) => {
        const uploader = text(entry.uploaded_by);
        return Boolean(uploader && carrierMemberUserIds.has(uploader));
      })
    : rawDocuments;
  const documents = visibleDocuments.map((entry) => ({
    id: text(entry.id),
    type: text(entry.doc_type) ?? text(entry.file_type) ?? 'Document',
    fileName: text(entry.file_name),
    filePath: text(entry.file_path) ?? text(entry.file_url),
    createdAt: text(entry.created_at) ?? text(entry.uploaded_at),
  }));

  const invoices = invoicesResult.error ? [] : ((invoicesResult.data ?? []) as Record<string, unknown>[])
    .filter((invoice) => invoiceVisibleToCompany(invoice, viewerCompanyId, ownerCompanyId))
    .map((invoice) => ({
      id: text(invoice.id),
      number: text(invoice.invoice_number),
      status: text(invoice.status),
      paymentStatus: text(invoice.payment_status),
      amount: numberValue(invoice.amount) ?? numberValue(invoice.total),
      currency: text(invoice.currency) ?? 'GBP',
      dueDate: text(invoice.due_date),
    }));

  return respond(200, {
    sheet: {
      jobId,
      viewerWorkspace,
      viewerCompanyId,
      status: text(job.current_status) ?? text(job.status) ?? 'unknown',
      createdAt: text(job.created_at),
      updatedAt: text(job.updated_at),
      acceptedAt: text(agreement.accepted_at) ?? text(agreement.agreed_at) ?? text(acceptedBid.updated_at) ?? text(acceptedBid.created_at),
      ownerCompany: {
        companyId: ownerCompanyId,
        name: text(ownerCompany.name) ?? 'Job owner',
        memberId: text(ownerCompany.company_number),
        phone: text(ownerCompany.phone),
        type: text(ownerCompany.company_type),
      },
      carrier: awardedCompanyId ? {
        companyId: awardedCompanyId,
        name: text(carrierCompany.name) ?? 'Awarded carrier',
        memberId: text(carrierCompany.company_number),
        phone: text(carrierCompany.phone),
        type: text(carrierCompany.company_type),
      } : null,
      driver: assignedDriverId ? { id: assignedDriverId, name: text(driver.display_name), status: null } : null,
      vehicle: assignedVehicleId ? {
        id: assignedVehicleId,
        registration: text(vehicle.reg_plate),
        type: text(vehicle.type),
        make: text(vehicle.make),
        model: text(vehicle.model),
        bodyType: text(vehicle.body_type),
        payloadKg: numberValue(vehicle.payload_kg),
        palletsCapacity: numberValue(vehicle.pallets_capacity),
        hasTailLift: boolValue(vehicle.has_tail_lift),
      } : null,
      customer: { name: text(job.client_name), email: text(job.client_email), phone: text(job.client_phone) },
      references: {
        booking: text(job.booking_reference),
        customer: text(job.customer_reference),
        purchaseOrder: text(job.purchase_order_number),
        xdrive: `XDL-${jobId.slice(0, 8).toUpperCase()}`,
      },
      route: {
        pickup: {
          address: text(job.pickup_location), postcode: text(job.pickup_postcode),
          dateTime: text(job.pickup_datetime) ?? text(job.collection_window_start), slot: text(job.pickup_time_slot),
          contactName: text(job.collection_contact_name), contactPhone: text(job.collection_contact_phone), notes: text(job.collection_notes),
        },
        delivery: {
          address: text(job.delivery_location), postcode: text(job.delivery_postcode),
          dateTime: text(job.delivery_datetime) ?? text(job.delivery_window_start), slot: text(job.delivery_time_slot),
          contactName: text(job.delivery_contact_name), contactPhone: text(job.delivery_contact_phone), notes: text(job.delivery_notes),
        },
        distanceMiles: numberValue(job.job_distance_miles) ?? numberValue(job.distance_miles),
      },
      load: {
        requestedVehicle: text(job.requested_vehicle_label) ?? text(job.requested_vehicle_type) ?? text(job.vehicle_type),
        cargoType: text(job.requested_cargo_label) ?? text(job.cargo_type),
        weightKg: numberValue(job.weight_kg),
        pallets: numberValue(job.pallets),
        lengthCm: numberValue(job.length_cm),
        widthCm: numberValue(job.width_cm),
        heightCm: numberValue(job.height_cm),
        cargoValueGbp: numberValue(job.cargo_value_gbp),
        palletType: text(job.pallet_type),
        stackable: boolValue(job.pallet_stackable),
        requirements: requirements(job),
      },
      commercial: {
        customerPrice,
        carrierCost,
        margin: viewerWorkspace === 'broker' && viewerCompanyId === ownerCompanyId ? brokerMargin : null,
        currency: text(agreement.currency) ?? text(job.currency) ?? text(acceptedBid.currency) ?? 'GBP',
        paymentTerms,
        paymentDueDays: numberValue(agreement.payment_due_days),
        vatRate: numberValue(agreement.vat_rate),
        vatAmount: numberValue(agreement.vat_amount),
        agreedGross: numberValue(agreement.agreed_gross_amount),
        snapshotAvailable: Boolean(agreementResult.data && !agreementResult.error),
        targetCarrierCost: viewerWorkspace === 'broker' && viewerCompanyId === ownerCompanyId ? details.targetCarrierCost : null,
      },
      pod: {
        required: podRequired,
        hardCopy: text(job.hard_copy_pod),
        generated: boolValue(job.pod_generated),
        generatedAt: text(job.pod_generated_at),
        photoCount: Array.isArray(job.pod_photos) ? job.pod_photos.length : Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0,
        reviewStatus: text(job.broker_pod_review_status),
        reviewNote: text(job.broker_pod_review_note),
      },
      notes: {
        publicQuoteNotes: details.publicQuoteNotes,
        executionInstructions: details.executionInstructions ?? text(job.load_notes),
        collection: text(job.collection_notes),
        delivery: text(job.delivery_notes),
        driver: text(job.driver_notes),
        documentChecklist: Array.isArray(job.document_checklist) ? job.document_checklist : [],
      },
      timeline,
      documents,
      invoices,
      partial: Boolean(
        ownerCompanyResult.error
        || carrierCompanyResult.error
        || viewerCompanyResult.error
        || bidResult.error
        || agreementResult.error
        || driverResult.error
        || vehicleResult.error
        || trackingResult.error
        || documentsResult.error
        || invoicesResult.error
        || carrierMembersResult.error
      ),
      unavailable: {
        bodyType: assignedVehicleId && text(vehicle.body_type) ? null : 'No verified allocated vehicle body-type value is available for this job.',
        bookingFooter: 'No immutable historical booking-footer snapshot is exposed by the current verified data contract.',
        extras: 'No immutable waiting/loading/cancellation extras snapshot is exposed by the current verified data contract.',
        documents: viewerIsAwardedCarrier
          ? 'Carrier view exposes only job documents uploaded by the awarded carrier membership or assigned driver; owner-only uploads remain restricted.'
          : null,
      },
    },
  });
}
