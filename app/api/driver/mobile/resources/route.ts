import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../_lib';

type AnyRow = Record<string, unknown>;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BASE64_CHARS = 14_000_000;
const SEARCH_FILTER_KEYS = new Set([
  'region', 'from', 'fromRadius', 'to', 'toRadius', 'vehicleFrom', 'vehicleTo',
  'bodyType', 'dateFrom', 'dateTo', 'freightType', 'member', 'description', 'loadType',
]);

function cleanString(value: unknown, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function cleanNumber(value: unknown, min = 0, max = 1_000_000) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}
function cleanDate(value: unknown) {
  const raw = cleanString(value, 80);
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : null;
}
function cleanBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}
function normalizeSearchFilters(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as AnyRow;
  const output: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!SEARCH_FILTER_KEYS.has(key)) continue;
    if (typeof raw === 'boolean') output[key] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) output[key] = raw;
    else if (typeof raw === 'string') output[key] = raw.trim().slice(0, 200);
  }
  return output;
}

function hasExpectedDocumentMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export async function GET(request: NextRequest) {
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;

  const driverResult = await supabaseAdmin!
    .from('drivers')
    .select('id,company_id,display_name,email,phone,status,app_access,driver_type,can_commercial_bid')
    .eq('id', context.driverId)
    .maybeSingle();
  if (driverResult.error || !driverResult.data) return NextResponse.json({ error: driverResult.error?.message ?? 'Driver profile was not found.' }, { status: 500 });

  const vehicleResult = await supabaseAdmin!
    .from('vehicles')
    .select('id,type,make,model,reg_plate,payload_kg,pallets_capacity')
    .eq('assigned_driver_id', context.driverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vehicleResult.error) return NextResponse.json({ error: vehicleResult.error.message }, { status: 500 });
  const vehicleId = String(vehicleResult.data?.id ?? '');

  const [
    driverDocsResult,
    vehicleDocsResult,
    notificationsResult,
    journeysResult,
    preferencesResult,
    alertPreferencesResult,
    searchDefaultsResult,
  ] = await Promise.all([
    supabaseAdmin!.from('driver_documents').select('id,doc_type,status,expiry_date,created_at').eq('driver_id', context.driverId).order('created_at', { ascending: false }).limit(100),
    vehicleId
      ? supabaseAdmin!.from('vehicle_documents').select('id,doc_type,status,expiry_date,created_at').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin!.from('notifications').select('id,title,body,type,read_at,created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin!.from('return_journeys')
      .select('id,journey_mode,go_anywhere,from_postcode,to_postcode,via_location,available_from,journey_eta,capacity_status,weight_available_kg,pallet_space_available,status,created_at')
      .eq('driver_id', context.driverId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin!.from('driver_job_search_preferences').select('job_id,state').eq('driver_id', context.driverId),
    supabaseAdmin!.from('driver_alert_preferences').select('push_enabled,sound_enabled,heads_up_enabled,marketplace_enabled,quote_enabled,booking_enabled,operational_enabled').eq('driver_id', context.driverId).maybeSingle(),
    supabaseAdmin!.from('driver_search_filter_defaults').select('filters').eq('driver_id', context.driverId).maybeSingle(),
  ]);

  const firstError = driverDocsResult.error
    ?? vehicleDocsResult.error
    ?? notificationsResult.error
    ?? journeysResult.error
    ?? preferencesResult.error
    ?? alertPreferencesResult.error
    ?? searchDefaultsResult.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  let invoices: AnyRow[] = [];
  if (context.companyId) {
    const invoiceResult = await supabaseAdmin!
      .from('invoices')
      .select('id,invoice_number,status,payment_status,total,amount,currency,client_name,due_date')
      .eq('company_id', context.companyId)
      .eq('created_by', context.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (invoiceResult.error) return NextResponse.json({ error: invoiceResult.error.message }, { status: 500 });
    invoices = (invoiceResult.data ?? []) as AnyRow[];
  }

  const driver = driverResult.data as AnyRow;
  const vehicle = (vehicleResult.data ?? null) as AnyRow | null;
  const displayName = String(driver.display_name || driver.email || 'Driver');
  const vehicleLabel = vehicle
    ? [[vehicle.make, vehicle.model].filter(Boolean).join(' '), String(vehicle.type || '')].filter(Boolean).join(' - ')
    : '';
  const vehicleRegistration = vehicle ? String(vehicle.reg_plate || '') : '';
  const journeys = (journeysResult.data ?? []) as AnyRow[];
  const activeJourney = journeys.find((row) => String(row.status ?? 'available') === 'available') ?? journeys[0] ?? null;
  const alerts = (alertPreferencesResult.data ?? {}) as AnyRow;

  return NextResponse.json({
    resources: {
      profile: {
        driver_id: context.driverId,
        company_id: context.companyId,
        vehicle_id: vehicleId || null,
        display_name: displayName,
        email: String(driver.email ?? ''),
        vehicle_label: vehicleLabel,
        vehicle_registration: vehicleRegistration,
        payload_kg: vehicle?.payload_kg ?? null,
        pallets_capacity: vehicle?.pallets_capacity ?? null,
      },
      documents: [
        ...(driverDocsResult.data ?? []).map((row) => ({ ...row, is_vehicle_document: false })),
        ...(vehicleDocsResult.data ?? []).map((row) => ({ ...row, is_vehicle_document: true })),
      ],
      notifications: notificationsResult.data ?? [],
      return_journey: activeJourney,
      return_journeys: journeys,
      invoices,
      nearby_drivers: [],
      job_search_preferences: preferencesResult.data ?? [],
      alert_preferences: {
        push_enabled: alerts.push_enabled ?? true,
        sound_enabled: alerts.sound_enabled ?? true,
        heads_up_enabled: alerts.heads_up_enabled ?? true,
        marketplace_enabled: alerts.marketplace_enabled ?? true,
        quote_enabled: alerts.quote_enabled ?? true,
        booking_enabled: alerts.booking_enabled ?? true,
        operational_enabled: alerts.operational_enabled ?? true,
      },
      search_filter_defaults: (searchDefaultsResult.data as AnyRow | null)?.filters ?? {},
    },
  });
}

export async function POST(request: NextRequest) {
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;
  const body = await request.json().catch(() => null) as AnyRow | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  const action = String(body.action ?? '');

  if (action === 'mark_notification_read' || action === 'delete_notification') {
    const notificationId = cleanString(body.notificationId, 80);
    if (!notificationId) return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 });
    if (action === 'mark_notification_read') {
      const { data, error } = await supabaseAdmin!.from('notifications')
        .update({ read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', context.userId).select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data?.length) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    } else {
      const { data, error } = await supabaseAdmin!.from('notifications')
        .delete().eq('id', notificationId).eq('user_id', context.userId).select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data?.length) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'save_return_journey') {
    if (!context.companyId) return NextResponse.json({ error: 'Company context is required for a journey.' }, { status: 409 });
    const mode = cleanString(body.mode, 30).toLowerCase() || 'going_home';
    if (!['going_home', 'going_to', 'future'].includes(mode)) return NextResponse.json({ error: 'Unsupported journey mode.' }, { status: 400 });
    const goAnywhere = body.goAnywhere === true;
    const fromLocation = cleanString(body.fromLocation, 300);
    const toLocation = cleanString(body.toLocation, 300);
    const viaLocation = cleanString(body.viaLocation, 300);
    const availableFrom = cleanDate(body.availableDate ?? body.availableFrom);
    const journeyEta = cleanDate(body.journeyEta);
    const capacityStatus = cleanString(body.capacityStatus, 80);
    const weightAvailableKg = cleanNumber(body.weightAvailableKg, 0, 100_000);
    const palletSpaceAvailable = cleanNumber(body.palletSpaceAvailable, 0, 100);
    if (!goAnywhere && !fromLocation && !toLocation) return NextResponse.json({ error: 'Enter a journey location or enable Go Anywhere.' }, { status: 400 });
    const { error } = await supabaseAdmin!.rpc('replace_driver_return_journey_v2', {
      p_driver_id: context.driverId,
      p_company_id: context.companyId,
      p_mode: mode,
      p_go_anywhere: goAnywhere,
      p_from_location: fromLocation,
      p_to_location: toLocation,
      p_via_location: viaLocation,
      p_available_from: availableFrom,
      p_journey_eta: journeyEta,
      p_capacity_status: capacityStatus,
      p_weight_available_kg: weightAvailableKg,
      p_pallet_space_available: palletSpaceAvailable == null ? null : Math.round(palletSpaceAvailable),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '22023' ? 400 : 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'save_alert_preferences') {
    const { error } = await supabaseAdmin!.from('driver_alert_preferences').upsert({
      driver_id: context.driverId,
      push_enabled: cleanBoolean(body.pushEnabled, true),
      sound_enabled: cleanBoolean(body.soundEnabled, true),
      heads_up_enabled: cleanBoolean(body.headsUpEnabled, true),
      marketplace_enabled: cleanBoolean(body.marketplaceEnabled, true),
      quote_enabled: cleanBoolean(body.quoteEnabled, true),
      booking_enabled: cleanBoolean(body.bookingEnabled, true),
      operational_enabled: cleanBoolean(body.operationalEnabled, true),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'driver_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'save_search_filter_defaults') {
    const filters = normalizeSearchFilters(body.filters);
    if (JSON.stringify(filters).length > 8_000) return NextResponse.json({ error: 'Search defaults are too large.' }, { status: 413 });
    const { error } = await supabaseAdmin!.from('driver_search_filter_defaults').upsert({
      driver_id: context.driverId,
      filters,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'driver_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'set_job_preference') {
    const jobId = cleanString(body.jobId, 80);
    const state = body.state == null ? null : cleanString(body.state, 20);
    if (!jobId) return NextResponse.json({ error: 'Job id is required.' }, { status: 400 });
    if (state !== null && !['saved', 'deleted'].includes(state)) return NextResponse.json({ error: 'Unsupported job preference.' }, { status: 400 });
    if (state === null) {
      const { error } = await supabaseAdmin!.from('driver_job_search_preferences').delete().eq('driver_id', context.driverId).eq('job_id', jobId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin!.from('driver_job_search_preferences').upsert({
        driver_id: context.driverId, job_id: jobId, state, updated_at: new Date().toISOString(),
      }, { onConflict: 'driver_id,job_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'upload_document') {
    const docType = cleanString(body.docType, 100);
    const fileName = cleanString(body.fileName, 160).replace(/[^a-zA-Z0-9._-]/g, '-') || 'document';
    const mimeType = cleanString(body.mimeType, 100) || 'application/octet-stream';
    const base64 = typeof body.base64 === 'string' ? body.base64 : '';
    const isVehicleDocument = body.isVehicleDocument === true;
    if (!docType || !base64) return NextResponse.json({ error: 'Document type and file are required.' }, { status: 400 });
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return NextResponse.json({ error: 'Use a PDF, JPG, PNG or WEBP document.' }, { status: 400 });
    if (base64.length > MAX_DOCUMENT_BASE64_CHARS) return NextResponse.json({ error: 'Document must be 10 MB or smaller.' }, { status: 413 });
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: 'Document must be 10 MB or smaller.' }, { status: 413 });
    if (!hasExpectedDocumentMagicBytes(bytes, mimeType)) return NextResponse.json({ error: 'Document content does not match its declared file type.' }, { status: 415 });

    const selectedVehicle = isVehicleDocument
      ? await supabaseAdmin!.from('vehicles').select('id').eq('assigned_driver_id', context.driverId).eq('company_id', context.companyId).limit(1).maybeSingle()
      : { data: null, error: null };
    if (selectedVehicle.error) return NextResponse.json({ error: selectedVehicle.error.message }, { status: 500 });
    if (isVehicleDocument && !selectedVehicle.data?.id) return NextResponse.json({ error: 'No assigned vehicle is available for this document.' }, { status: 409 });

    const uploadFolder = context.companyId ?? context.driverId;
    const path = `${uploadFolder}/${context.driverId}/${randomUUID()}-${fileName}`;
    const { error: storageError } = await supabaseAdmin!.storage.from('driver-docs').upload(path, bytes, { contentType: mimeType, upsert: false });
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

    const insertResult = isVehicleDocument
      ? await supabaseAdmin!.from('vehicle_documents').insert({ vehicle_id: selectedVehicle.data!.id, doc_type: docType, file_path: path, status: 'pending', uploaded_by: context.userId })
      : await supabaseAdmin!.from('driver_documents').insert({ driver_id: context.driverId, doc_type: docType, file_path: path, status: 'pending' });
    if (insertResult.error) {
      await supabaseAdmin!.storage.from('driver-docs').remove([path]);
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
