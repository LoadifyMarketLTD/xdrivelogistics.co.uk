import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasOnlyPreExecutionJobStatuses, preferredJobLifecycleStatus } from '../../../../../../lib/jobs/jobLifecycleStatus';
import { labelToCargoType, labelToVehicleType } from '../../../../../../lib/vehicleTypes';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { getGlobalSettingNumber } from '../../../_lib/platformFlags';
import { operationalError } from '../../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? null : String(value);
const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : null;
};
const boolValue = (value: unknown) => typeof value === 'boolean' ? value : false;
const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalNumber = z.number().finite().nonnegative().optional().nullable();
const additionalStopSchema = z.object({
  type: z.enum(['collection', 'delivery']),
  address: z.string().trim().min(3).max(1000),
  postcode: z.string().trim().min(2).max(20),
  contact: optionalText,
  phone: optionalText,
  dateTime: z.string().trim().optional().nullable(),
  instructions: optionalText,
});
const updateSchema = z.object({
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
  additionalStops: z.array(additionalStopSchema).max(8).optional().default([]),
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
  publicQuoteNotes: optionalText,
  executionInstructions: optionalText,
});

type AdminClient = NonNullable<typeof supabaseAdmin>;
type JobRow = Record<string, unknown>;
type StopRow = Record<string, unknown>;

type OwnerContext = {
  job: JobRow;
  stops: StopRow[];
  ownerCompanyId: string;
  capabilities: {
    canEdit: boolean;
    canDelete: boolean;
    editReason: string | null;
    deleteReason: string | null;
    bidCount: number;
  };
};

const parseLoadDetails = (value: unknown) => {
  const raw = text(value)?.trim();
  if (!raw) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {} as Record<string, unknown>;
  }
};

const londonDateTime = (value: unknown) => {
  const raw = text(value);
  if (!raw) return { date: '', time: '' };
  const instant = new Date(raw);
  if (!Number.isFinite(instant.getTime())) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const executionAddress = (location: unknown, postcode: unknown) => {
  const raw = text(location)?.trim() ?? '';
  const code = text(postcode)?.trim() ?? '';
  if (!raw || !code) return raw;
  return raw.replace(new RegExp(`,?\\s*${escapeRegExp(code)}\\s*$`, 'i'), '').trim();
};

const countRows = async (client: AdminClient, table: string, column: string, jobId: string) => {
  const result = await client.from(table).select('id', { count: 'exact', head: true }).eq(column, jobId);
  return { count: result.count ?? 0, error: result.error };
};

async function getOwnerContext(client: AdminClient, userId: string, jobId: string): Promise<{ context?: OwnerContext; response?: NextResponse }> {
  const { data: rawJob, error: jobError } = await client.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (jobError) return { response: operationalError({ status: 500, message: 'The load could not be checked.', context: `workspace.job-owner.job:${jobId}`, cause: jobError, retryable: true }) };
  if (!rawJob) return { response: respond(404, { error: 'Load not found.' }) };

  const job = rawJob as JobRow;
  const ownerCompanyId = text(job.company_id);
  if (!ownerCompanyId) return { response: respond(409, { error: 'The posting company is unavailable for this load.' }) };

  const { data: membership, error: membershipError } = await client
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', ownerCompanyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();
  if (membershipError) return { response: operationalError({ status: 500, message: 'Your company access could not be verified.', context: `workspace.job-owner.membership:${jobId}`, cause: membershipError, retryable: true }) };
  if (!membership) return { response: respond(403, { error: 'Only the posting company can edit or delete this load.' }) };

  const [stopsResult, bids, agreements, pods, invoices, jobDocuments, legacyDocuments, disputes, cancellations, invoiceDisputes, convertedQuotes, reviews] = await Promise.all([
    client.from('job_stops').select('*').eq('job_id', jobId).order('sequence', { ascending: true }),
    countRows(client, 'job_bids', 'job_id', jobId),
    countRows(client, 'job_commercial_agreements', 'job_id', jobId),
    countRows(client, 'proof_of_delivery', 'job_id', jobId),
    countRows(client, 'invoices', 'job_id', jobId),
    countRows(client, 'job_documents', 'job_id', jobId),
    countRows(client, 'documents', 'job_id', jobId),
    countRows(client, 'job_disputes', 'job_id', jobId),
    countRows(client, 'job_cancellation_requests', 'job_id', jobId),
    countRows(client, 'invoice_disputes', 'job_id', jobId),
    countRows(client, 'quotes', 'converted_job_id', jobId),
    countRows(client, 'reviews', 'job_id', jobId),
  ]);
  const dependencyError = [stopsResult.error, bids.error, agreements.error, pods.error, invoices.error, jobDocuments.error, legacyDocuments.error, disputes.error, cancellations.error, invoiceDisputes.error, convertedQuotes.error, reviews.error].find(Boolean);
  if (dependencyError) return { response: operationalError({ status: 500, message: 'The load safety checks could not be completed.', context: `workspace.job-owner.dependencies:${jobId}`, cause: dependencyError, retryable: true }) };

  const stops = (stopsResult.data ?? []) as StopRow[];
  const progressedStopCount = stops.filter((stop) => {
    const status = String(stop.status ?? 'pending').toLowerCase();
    return status !== 'pending' || Boolean(stop.arrived_at) || Boolean(stop.completed_at);
  }).length;
  const assigned = Boolean(job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id || job.vehicle_id);
  const status = preferredJobLifecycleStatus(job);
  const preAwardStatus = hasOnlyPreExecutionJobStatuses(job);
  const bidCount = bids.count;
  const executionArtifacts = agreements.count + pods.count + invoices.count + disputes.count + cancellations.count + invoiceDisputes.count + convertedQuotes.count + reviews.count;

  let editReason: string | null = null;
  if (assigned) editReason = 'This load has already been awarded or allocated and can no longer be edited by the posting company.';
  else if (!preAwardStatus) editReason = `Loads in ${status || 'this'} status cannot be edited.`;
  else if (bidCount > 0) editReason = 'Carrier quotes already exist for this load. Changing the transport terms would make those quotes stale.';
  else if (executionArtifacts > 0 || progressedStopCount > 0) editReason = 'This load already has protected commercial or execution history.';

  let deleteReason = editReason;
  if (!deleteReason && (jobDocuments.count > 0 || legacyDocuments.count > 0)) deleteReason = 'This load has stored documents. Remove or archive the load instead of deleting its audit evidence.';

  return {
    context: {
      job,
      stops,
      ownerCompanyId,
      capabilities: {
        canEdit: !editReason,
        canDelete: !deleteReason,
        editReason,
        deleteReason,
        bidCount,
      },
    },
  };
}

const editableSnapshot = (context: OwnerContext) => {
  const { job, stops, capabilities } = context;
  const details = parseLoadDetails(job.load_details);
  const pickupSchedule = londonDateTime(job.pickup_datetime);
  const deliverySchedule = londonDateTime(job.delivery_datetime);
  const firstStop = stops.length >= 2 ? stops[0] : null;
  const lastStop = stops.length >= 2 ? stops[stops.length - 1] : null;
  const special = String(job.special_requirements ?? '').toLowerCase();
  const requestedVehicle = text(job.requested_vehicle_label) ?? text(job.vehicle_type)?.replace(/_/g, ' ') ?? 'LWB Van';
  const requestedCargo = text(job.requested_cargo_label) ?? text(job.cargo_type)?.replace(/_/g, ' ') ?? 'Pallets';
  const lifecycleStatus = preferredJobLifecycleStatus(job);

  return {
    id: text(job.id),
    reference: `XDL-${String(job.id ?? '').slice(0, 8).toUpperCase()}`,
    status: lifecycleStatus || 'unknown',
    publish: lifecycleStatus === 'posted',
    clientName: text(job.client_name) ?? '',
    clientEmail: text(job.client_email) ?? '',
    clientPhone: text(job.client_phone) ?? '',
    pickupDate: firstStop ? londonDateTime(firstStop.window_start).date : pickupSchedule.date,
    pickupTime: text(job.pickup_time_slot) || (firstStop ? londonDateTime(firstStop.window_start).time : pickupSchedule.time),
    pickupAddress: firstStop ? text(firstStop.address) ?? '' : executionAddress(job.pickup_location, job.pickup_postcode),
    pickupPostcode: firstStop ? text(firstStop.postcode) ?? '' : text(job.pickup_postcode) ?? '',
    collectionContact: firstStop ? text(firstStop.contact_name) ?? '' : text(job.collection_contact_name) ?? '',
    collectionPhone: firstStop ? text(firstStop.contact_phone) ?? '' : text(job.collection_contact_phone) ?? '',
    deliveryDate: lastStop ? londonDateTime(lastStop.window_start).date : deliverySchedule.date,
    deliveryTime: text(job.delivery_time_slot) || (lastStop ? londonDateTime(lastStop.window_start).time : deliverySchedule.time),
    deliveryAddress: lastStop ? text(lastStop.address) ?? '' : executionAddress(job.delivery_location, job.delivery_postcode),
    deliveryPostcode: lastStop ? text(lastStop.postcode) ?? '' : text(job.delivery_postcode) ?? '',
    deliveryContact: lastStop ? text(lastStop.contact_name) ?? '' : text(job.delivery_contact_name) ?? '',
    deliveryPhone: lastStop ? text(lastStop.contact_phone) ?? '' : text(job.delivery_contact_phone) ?? '',
    additionalStops: stops.length >= 2 ? stops.slice(1, -1).map((stop) => {
      const schedule = londonDateTime(stop.window_start);
      return {
        id: text(stop.id) ?? crypto.randomUUID(),
        type: String(stop.stop_type ?? 'delivery').toLowerCase() === 'collection' ? 'collection' : 'delivery',
        date: schedule.date,
        time: schedule.time,
        postcode: text(stop.postcode) ?? '',
        address: text(stop.address) ?? '',
        contact: text(stop.contact_name) ?? '',
        phone: text(stop.contact_phone) ?? '',
        instructions: text(stop.instructions) ?? '',
      };
    }) : [],
    vehicle: requestedVehicle,
    cargo: requestedCargo,
    weight: numberValue(job.weight_kg),
    pallets: numberValue(job.pallets),
    length: numberValue(job.length_cm),
    width: numberValue(job.width_cm),
    height: numberValue(job.height_cm),
    cargoValue: numberValue(job.cargo_value_gbp),
    customerReference: text(job.customer_reference) ?? '',
    purchaseOrder: text(job.purchase_order_number) ?? '',
    bookingReference: text(job.booking_reference) ?? '',
    customerPrice: numberValue(job.budget_amount),
    targetCarrierCost: numberValue(details.targetCarrierCost),
    tailLift: boolValue(job.collection_tail_lift_required),
    forklift: boolValue(job.collection_forklift_available),
    handball: boolValue(job.collection_handball_required),
    adr: special.includes('adr'),
    temperatureControlled: special.includes('temperature controlled'),
    fragile: special.includes('fragile'),
    publicQuoteNotes: text(details.publicQuoteNotes) ?? '',
    executionInstructions: text(details.executionInstructions) ?? text(details.notes) ?? '',
    capabilities,
  };
};

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { response: operationalError({ status: 503, message: 'Load management is temporarily unavailable.', context: 'workspace.job-owner.config', retryable: true }) };
  const token = getBearerToken(request);
  if (!token) return { response: respond(401, { error: 'Unauthorized.' }) };
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { response: respond(401, { error: 'Unauthorized.' }) };
  return { client: supabaseAdmin, userId: data.user.id };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const { jobId } = await params;
  const checked = await getOwnerContext(auth.client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;
  return respond(200, { job: editableSnapshot(checked.context) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const client = auth.client;
  const { jobId } = await params;
  const checked = await getOwnerContext(client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;
  if (!checked.context.capabilities.canEdit) return respond(409, { error: checked.context.capabilities.editReason ?? 'This load cannot be edited.' });

  const rawBody = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(rawBody);
  if (!parsed.success) return respond(400, { error: 'Load details are incomplete or invalid.', fields: parsed.error.flatten().fieldErrors });
  const input = parsed.data;
  const { job: originalJob, stops: originalStops, ownerCompanyId } = checked.context;
  const now = new Date().toISOString();
  const specialRequirements = [
    input.tailLift && 'Tail lift required',
    input.forklift && 'Forklift available at collection',
    input.handball && 'Handball required',
    input.adr && 'ADR required',
    input.temperatureControlled && 'Temperature controlled',
    input.fragile && 'Fragile goods',
    input.additionalStops.length > 0 && `${input.additionalStops.length} additional stop${input.additionalStops.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(', ');
  const loadDetails = JSON.stringify({
    schema: 'xdrive_load_details_v2',
    source: 'customer_workspace_v3_edit',
    targetCarrierCost: input.targetCarrierCost ?? null,
    dimensionsCm: { length: input.lengthCm ?? null, width: input.widthCm ?? null, height: input.heightCm ?? null },
    publicQuoteNotes: input.publicQuoteNotes || null,
    additionalStopCount: input.additionalStops.length,
    notes: input.executionInstructions || null,
    executionInstructions: input.executionInstructions || null,
  });

  const mutableColumns = [
    'status','current_status','pickup_location','pickup_postcode','pickup_datetime','pickup_time_slot','delivery_location','delivery_postcode','delivery_datetime','delivery_time_slot',
    'collection_contact_name','collection_contact_phone','delivery_contact_name','delivery_contact_phone','client_name','client_email','client_phone','customer_reference','purchase_order_number','booking_reference',
    'vehicle_type','requested_vehicle_label','cargo_type','requested_cargo_label','weight_kg','pallets','length_cm','width_cm','height_cm','cargo_value_gbp','budget_amount',
    'collection_tail_lift_required','collection_forklift_available','collection_handball_required','special_requirements','load_details','exchange_visibility','exchange_posted_at','exchange_expires_at','updated_at',
  ] as const;
  const originalMutable = Object.fromEntries(mutableColumns.map((key) => [key, originalJob[key]]));

  const rollback = async () => {
    const jobRestore = await client.from('jobs').update(originalMutable).eq('id', jobId).eq('company_id', ownerCompanyId);
    const stopDelete = await client.from('job_stops').delete().eq('job_id', jobId);
    let stopRestoreError = null;
    if (!stopDelete.error && originalStops.length > 0) {
      const restoreRows = originalStops.map((stop) => ({
        id: stop.id,
        job_id: jobId,
        sequence: stop.sequence,
        stop_type: stop.stop_type,
        address: stop.address,
        postcode: stop.postcode,
        company_name: stop.company_name,
        contact_name: stop.contact_name,
        contact_phone: stop.contact_phone,
        window_start: stop.window_start,
        window_end: stop.window_end,
        instructions: stop.instructions,
        status: stop.status,
        arrived_at: stop.arrived_at,
        completed_at: stop.completed_at,
      }));
      stopRestoreError = (await client.from('job_stops').insert(restoreRows)).error;
    }
    return jobRestore.error ?? stopDelete.error ?? stopRestoreError;
  };

  const stagedRow: Record<string, unknown> = {
    status: 'draft',
    current_status: 'draft',
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
    exchange_visibility: 'private',
    exchange_posted_at: null,
    exchange_expires_at: null,
    updated_at: now,
  };

  const staged = await client.from('jobs').update(stagedRow)
    .eq('id', jobId).eq('company_id', ownerCompanyId)
    .is('awarded_carrier_company_id', null).is('assigned_company_id', null).is('assigned_driver_id', null).is('vehicle_id', null)
    .select('id').maybeSingle();
  if (staged.error || !staged.data) return operationalError({ status: 409, message: 'The load changed while you were editing it. Refresh and try again.', context: `workspace.job-owner.stage:${jobId}`, cause: staged.error ?? new Error('Owner edit guard rejected the job.'), retryable: false });

  const deleteStops = await client.from('job_stops').delete().eq('job_id', jobId);
  if (deleteStops.error) {
    const rollbackError = await rollback();
    return operationalError({ status: 500, message: rollbackError ? 'The load could not be edited cleanly. Please contact support before retrying.' : 'The route could not be updated. Your previous load details were restored.', context: `workspace.job-owner.replace-stops:${jobId}`, cause: deleteStops.error, retryable: !rollbackError });
  }

  if (input.additionalStops.length > 0) {
    const stopRows = [
      { job_id: jobId, sequence: 1, stop_type: 'collection', address: input.pickupAddress, postcode: input.pickupPostcode.toUpperCase(), contact_name: input.collectionContact || null, contact_phone: input.collectionPhone || null, window_start: input.pickupDateTime, instructions: null },
      ...input.additionalStops.map((stop, index) => ({ job_id: jobId, sequence: index + 2, stop_type: stop.type, address: stop.address, postcode: stop.postcode.toUpperCase(), contact_name: stop.contact || null, contact_phone: stop.phone || null, window_start: stop.dateTime || null, instructions: stop.instructions || null })),
      { job_id: jobId, sequence: input.additionalStops.length + 2, stop_type: 'delivery', address: input.deliveryAddress, postcode: input.deliveryPostcode.toUpperCase(), contact_name: input.deliveryContact || null, contact_phone: input.deliveryPhone || null, window_start: input.deliveryDateTime || null, instructions: null },
    ];
    const insertedStops = await client.from('job_stops').insert(stopRows);
    if (insertedStops.error) {
      const rollbackError = await rollback();
      return operationalError({ status: 500, message: rollbackError ? 'The multi-drop route could not be edited cleanly. Please contact support before retrying.' : 'The multi-drop route could not be updated. Your previous load details were restored.', context: `workspace.job-owner.insert-stops:${jobId}`, cause: insertedStops.error, retryable: !rollbackError });
    }
  }

  const expireHoursRaw = input.publish ? await getGlobalSettingNumber(client, 'exchange_auto_expire_hours') : 72;
  const expireHours = Number.isFinite(expireHoursRaw) && expireHoursRaw > 0 ? expireHoursRaw : 72;
  const finalStatus = input.publish ? 'posted' : 'draft';
  const finalResult = await client.from('jobs').update({
    status: finalStatus,
    current_status: finalStatus,
    exchange_visibility: input.publish ? 'exchange' : 'private',
    exchange_posted_at: input.publish ? now : null,
    exchange_expires_at: input.publish ? new Date(Date.now() + expireHours * 60 * 60 * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId).eq('company_id', ownerCompanyId).eq('status', 'draft').select('id, status, current_status').maybeSingle();
  if (finalResult.error || !finalResult.data) {
    const rollbackError = await rollback();
    return operationalError({ status: 500, message: rollbackError ? 'The load edit could not be finalised cleanly. Please contact support.' : 'The load edit could not be finalised. Your previous details were restored.', context: `workspace.job-owner.finalise:${jobId}`, cause: finalResult.error ?? new Error('Final owner update returned no row.'), retryable: !rollbackError });
  }

  return respond(200, { job: finalResult.data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if (auth.response || !auth.client || !auth.userId) return auth.response;
  const client = auth.client;
  const { jobId } = await params;
  const checked = await getOwnerContext(client, auth.userId, jobId);
  if (checked.response || !checked.context) return checked.response;
  if (!checked.context.capabilities.canDelete) return respond(409, { error: checked.context.capabilities.deleteReason ?? 'This load cannot be deleted.' });

  const deleted = await client.rpc('delete_unbid_exchange_job_atomic', {
    p_job_id: jobId,
    p_actor_user_id: auth.userId,
  });
  if (deleted.error) {
    if (deleted.error.code === 'P0002') return respond(404, { error: 'Load not found.' });
    if (deleted.error.code === '42501') return respond(403, { error: deleted.error.message });
    if (deleted.error.code === '23514' || deleted.error.code === '23503') return respond(409, { error: deleted.error.message });
    return operationalError({ status: 409, message: 'This load cannot be deleted because protected records are linked to it.', context: `workspace.job-owner.delete:${jobId}`, cause: deleted.error, retryable: false });
  }

  return respond(200, { deleted: true, jobId });
}
