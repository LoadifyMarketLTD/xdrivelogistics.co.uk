import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { operationalError } from '../../../../_lib/operationalError';
import { isDriverContext, requireDriver, respond } from '../../../mobile/_lib';

function text(value: unknown) {
  return typeof value === 'string' ? value : value == null ? null : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
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

  const [companyResult, settingsResult, bidResult, trackingResult, invoiceResult, documentsResult, vehicleResult, driverResult] = await Promise.all([
    originCompanyId ? supabaseAdmin.from('companies').select('*').eq('id', originCompanyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    originCompanyId ? supabaseAdmin.from('company_settings').select('*').eq('company_id', originCompanyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('job_bids').select('*').eq('job_id', jobId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('job_tracking_events').select('*').eq('job_id', jobId).order('created_at', { ascending: true }).limit(250),
    supabaseAdmin.from('invoices').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('job_documents').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(100),
    vehicleId
      ? supabaseAdmin.from('vehicles').select('*').eq('id', vehicleId).maybeSingle()
      : supabaseAdmin.from('vehicles').select('*').eq('assigned_driver_id', driver.driverId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('drivers').select('*').eq('id', driver.driverId).maybeSingle(),
  ]);

  const company = (companyResult.data ?? {}) as Record<string, unknown>;
  const settings = (settingsResult.data ?? {}) as Record<string, unknown>;
  const acceptedBid = (bidResult.data ?? {}) as Record<string, unknown>;
  const vehicle = (vehicleResult.data ?? {}) as Record<string, unknown>;
  const driverRow = (driverResult.data ?? {}) as Record<string, unknown>;
  const acceptedRate = numberValue(job.agreed_rate_gbp)
    ?? numberValue(job.agreed_rate)
    ?? numberValue(acceptedBid.bid_price_gbp)
    ?? numberValue(acceptedBid.amount)
    ?? null;

  const timeline = trackingResult.error ? [] : (trackingResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    eventType: text(entry.event_type) ?? 'update',
    message: text(entry.message) ?? text(entry.note),
    meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : null,
    createdAt: text(entry.created_at),
  }));
  const documents = documentsResult.error ? [] : (documentsResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    type: text(entry.doc_type) ?? 'Document',
    fileName: text(entry.file_name),
    filePath: text(entry.file_path),
    createdAt: text(entry.created_at),
  }));
  const invoices = invoiceResult.error ? [] : (invoiceResult.data ?? []).map((entry: Record<string, unknown>) => ({
    id: text(entry.id),
    number: text(entry.invoice_number),
    status: text(entry.status),
    amount: numberValue(entry.amount),
    currency: text(entry.currency) ?? 'GBP',
  }));

  return respond(200, {
    sheet: {
      reference: text(job.booking_reference) || `XDL-${jobId.slice(0, 8).toUpperCase()}`,
      loadId: jobId,
      status: text(job.current_status) || text(job.status) || 'allocated',
      bookedBy: text(company.name) || text(job.client_name) || 'Marketplace member',
      memberCode: text(company.company_number),
      memberPhone: text(company.phone) || text(job.client_phone),
      agreedRate: acceptedRate,
      currency: text(job.currency) || text(acceptedBid.currency) || 'GBP',
      customerReference: text(job.customer_reference),
      purchaseOrderNumber: text(job.purchase_order_number),
      bookingReference: text(job.booking_reference),
      distanceMiles: numberValue(job.job_distance_miles),
      vehicleRequested: text(job.requested_vehicle_label) || text(job.requested_vehicle_type) || text(job.vehicle_type),
      vehicleRef: text(vehicle.reg_plate) || text(driverRow.display_name),
      vehicleType: text(vehicle.type) || text(job.vehicle_type),
      paymentTerms: text(settings.default_payment_terms) || text(job.payment_terms) || 'Not provided',
      hardCopyPod: text(job.hard_copy_pod) || (job.pod_required === false ? 'Not Required' : 'Required / digital accepted'),
      podRequired: job.pod_required !== false,
      pickupSlot: text(job.pickup_time_slot),
      deliverySlot: text(job.delivery_time_slot),
      loadNotes: text(job.load_details),
      driverNotes: text(job.driver_notes),
      timeline,
      documents,
      invoices,
      partial: Boolean(companyResult.error || settingsResult.error || bidResult.error || trackingResult.error || invoiceResult.error || documentsResult.error || vehicleResult.error || driverResult.error),
    },
  });
}
