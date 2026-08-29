import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { labelToCargoType, labelToVehicleType } from '../../../../lib/vehicleTypes';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { getFeatureFlags, getGlobalSettingBoolean } from '../../_lib/platformFlags';
import { operationalError } from '../../_lib/operationalError';

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
  // Legacy input remains accepted so older clients do not break. Legacy notes
  // are execution-private by default and are never promoted to Marketplace.
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
    return operationalError({
      status: 503,
      message: 'Load posting is temporarily unavailable.',
      context: 'jobs.create.config',
      retryable: true,
    });
  }
  const adminClient = supabaseAdmin;

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
  if (membershipError) {
    return operationalError({
      status: 500,
      message: 'We could not verify your company access. Please try again.',
      context: `jobs.create.membership.company:${input.companyId}.user:${authData.user.id}`,
      cause: membershipError,
      retryable: true,
    });
  }
  if (!membership) return respond(403, { error: 'You cannot post loads for this company workspace.' });

  let exchangeAutoExpireHours = 72;
  if (input.publish) {
    const flags = await getFeatureFlags(supabaseAdmin, ['exchange_marketplace']);
    if (!flags.get('exchange_marketplace')) {
      return respond(503, { error: 'The exchange marketplace is currently disabled. You can save this job as a draft.' });
    }
    const { getGlobalSettingNumber } = await import('../../_lib/platformFlags');
    exchangeAutoExpireHours = await getGlobalSettingNumber(supabaseAdmin, 'exchange_auto_expire_hours');
  }

  const complianceBlockPosting = await getGlobalSettingBoolean(supabaseAdmin, 'compliance_block_posting');
  if (complianceBlockPosting) {
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('status')
      .eq('id', input.companyId)
      .maybeSingle();
    if (companyError) {
      return operationalError({
        status: 503,
        message: 'Company compliance status could not be verified. Please try again.',
        context: `jobs.create.compliance.company:${input.companyId}`,
        cause: companyError,
        retryable: true,
      });
    }
    if (!company?.status) {
      return operationalError({
        status: 503,
        message: 'Company compliance status could not be verified. Please try again.',
        context: `jobs.create.compliance-missing.company:${input.companyId}`,
        retryable: true,
      });
    }
    const companyStatus = String(company.status).toLowerCase();
    if (!['active', 'fully_active', 'active_with_warnings'].includes(companyStatus)) {
      return respond(403, { error: 'Your company account is not in good standing. Job posting is blocked until compliance issues are resolved.' });
    }
  }

  const verifyMultiDropReplay = async (job: { id: string; status: unknown; current_status: unknown }) => {
    if (input.additionalStops.length === 0) return null;
    const expectedStopCount = input.additionalStops.length + 2;
    const { count, error } = await adminClient
      .from('job_stops')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job.id);
    if (error) {
      return operationalError({
        status: 503,
        message: 'We could not verify the saved multi-drop route. Please try again.',
        context: `jobs.create.multidrop-replay.job:${job.id}`,
        cause: error,
        retryable: true,
      });
    }
    if (count !== expectedStopCount || (input.publish && String(job.status) !== 'posted')) {
      return respond(409, {
        error: 'An earlier multi-drop save did not finish cleanly. Open the draft and retry before publishing.',
      });
    }
    return null;
  };

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
      return operationalError({
        status: 500,
        message: 'We could not verify whether this load was already submitted. Please try again.',
        context: `jobs.create.idempotency-check.company:${input.companyId}`,
        cause: existingResult.error,
        retryable: true,
      });
    }
  }
  if (existingResult.data) {
    const replayBlock = await verifyMultiDropReplay(existingResult.data);
    if (replayBlock) return replayBlock;
    return respond(200, { job: existingResult.data, replayed: true, idempotencyProtected: true });
  }

  const specialRequirements = [
    input.tailLift && 'Tail lift required',
    input.forklift && 'Forklift available at collection',
    input.handball && 'Handball required',
    input.adr && 'ADR required',
    input.temperatureControlled && 'Temperature controlled',
    input.fragile && 'Fragile goods',
    input.additionalStops.length > 0 && `${input.additionalStops.length} additional stop${input.additionalStops.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(', ');

  const now = new Date().toISOString();
  const requestedStatus = input.publish ? 'posted' : 'draft';
  const deferPublication = input.publish && input.additionalStops.length > 0;
  const status = deferPublication ? 'draft' : requestedStatus;
  const executionInstructions = input.executionInstructions || input.notes || null;
  const loadDetails = JSON.stringify({
    schema: 'xdrive_load_details_v2',
    source: input.mode === 'broker' ? 'broker_workspace_v3' : 'customer_workspace_v3',
    targetCarrierCost: input.targetCarrierCost ?? null,
    dimensionsCm: {
      length: input.lengthCm ?? null,
      width: input.widthCm ?? null,
      height: input.heightCm ?? null,
    },
    publicQuoteNotes: input.publicQuoteNotes || null,
    additionalStopCount: input.additionalStops.length,
    // `notes` is retained as the backwards-compatible execution-private key.
    notes: executionInstructions,
    executionInstructions,
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
    exchange_visibility: deferPublication ? 'private' : (input.publish ? 'exchange' : 'private'),
    exchange_posted_at: deferPublication ? null : (input.publish ? now : null),
    exchange_expires_at: deferPublication
      ? null
      : (input.publish
        ? new Date(Date.now() + exchangeAutoExpireHours * 60 * 60 * 1000).toISOString()
        : null),
    updated_at: now,
  };
  if (idempotencyAvailable) row.creation_idempotency_key = input.idempotencyKey;

  let insertResult = await supabaseAdmin
    .from('jobs')
    .insert(row)
    .select('id, status, current_status')
    .single();

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
    if (replayError) {
      return operationalError({
        status: 500,
        message: 'The load may already have been submitted, but we could not verify it. Please refresh before trying again.',
        context: `jobs.create.idempotency-replay.company:${input.companyId}`,
        cause: replayError,
        retryable: true,
      });
    }
    if (replay) {
      const replayBlock = await verifyMultiDropReplay(replay);
      if (replayBlock) return replayBlock;
      return respond(200, { job: replay, replayed: true, idempotencyProtected: true });
    }
  }
  if (insertResult.error) {
    return operationalError({
      status: 500,
      message: input.publish
        ? 'We could not publish this load to the marketplace. Please try again.'
        : 'We could not save this load. Please try again.',
      context: `jobs.create.insert.company:${input.companyId}.mode:${input.mode}.publish:${input.publish}`,
      cause: insertResult.error,
      retryable: true,
    });
  }

  let createdJob = insertResult.data;
  if (input.additionalStops.length > 0) {
    const stopRows = [
      {
        job_id: createdJob.id,
        sequence: 1,
        stop_type: 'collection',
        address: input.pickupAddress,
        postcode: input.pickupPostcode.toUpperCase(),
        contact_name: input.collectionContact || null,
        contact_phone: input.collectionPhone || null,
        window_start: input.pickupDateTime,
        instructions: null,
      },
      ...input.additionalStops.map((stop, index) => ({
        job_id: createdJob.id,
        sequence: index + 2,
        stop_type: stop.type,
        address: stop.address,
        postcode: stop.postcode.toUpperCase(),
        contact_name: stop.contact || null,
        contact_phone: stop.phone || null,
        window_start: stop.dateTime || null,
        instructions: stop.instructions || null,
      })),
      {
        job_id: createdJob.id,
        sequence: input.additionalStops.length + 2,
        stop_type: 'delivery',
        address: input.deliveryAddress,
        postcode: input.deliveryPostcode.toUpperCase(),
        contact_name: input.deliveryContact || null,
        contact_phone: input.deliveryPhone || null,
        window_start: input.deliveryDateTime || null,
        instructions: null,
      },
    ];

    const { error: stopsError } = await supabaseAdmin
      .from('job_stops')
      .insert(stopRows);
    if (stopsError) {
      const cleanup = await supabaseAdmin
        .from('jobs')
        .delete()
        .eq('id', createdJob.id)
        .eq('company_id', input.companyId);
      return operationalError({
        status: 500,
        message: cleanup.error
          ? 'The multi-drop route could not be saved cleanly. Please contact support before retrying this load.'
          : 'We could not save the multi-drop route. The load was not published. Please try again.',
        context: `jobs.create.multidrop-stops.job:${createdJob.id}.cleanup:${cleanup.error ? 'failed' : 'ok'}`,
        cause: stopsError,
        retryable: !cleanup.error,
      });
    }

    if (deferPublication) {
      const { data: publishedJob, error: publishError } = await supabaseAdmin
        .from('jobs')
        .update({
          status: 'posted',
          current_status: 'posted',
          exchange_visibility: 'exchange',
          exchange_posted_at: now,
          exchange_expires_at: new Date(Date.now() + exchangeAutoExpireHours * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', createdJob.id)
        .eq('company_id', input.companyId)
        .eq('status', 'draft')
        .select('id, status, current_status')
        .single();
      if (publishError || !publishedJob) {
        const cleanup = await supabaseAdmin
          .from('jobs')
          .delete()
          .eq('id', createdJob.id)
          .eq('company_id', input.companyId);
        return operationalError({
          status: 500,
          message: cleanup.error
            ? 'The multi-drop load could not be published cleanly. Please contact support before retrying.'
            : 'We could not publish the multi-drop load. The draft was removed; please try again.',
          context: `jobs.create.multidrop-publish.job:${createdJob.id}.cleanup:${cleanup.error ? 'failed' : 'ok'}`,
          cause: publishError ?? new Error('Multi-drop publish returned no job.'),
          retryable: !cleanup.error,
        });
      }
      createdJob = publishedJob;
    }
  }

  return respond(201, {
    job: createdJob,
    replayed: false,
    idempotencyProtected: idempotencyAvailable,
  });
}
