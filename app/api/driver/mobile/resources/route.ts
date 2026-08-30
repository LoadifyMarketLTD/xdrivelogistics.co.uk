import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../_lib';

type AnyRow = Record<string, unknown>;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BASE64_CHARS = 14_000_000;

function cleanString(value: unknown, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function hasExpectedDocumentMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function timestampOf(value: unknown) {
  const parsed = new Date(typeof value === 'string' ? value : '').getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  // Identity, account approval, active status and native-device binding remain
  // fail-closed inside requireDriver. Everything below is presentation/context
  // and must not turn a valid session into a false authorization failure when a
  // peripheral subsystem is temporarily unavailable.
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;

  const driverResult = await supabaseAdmin!
    .from('drivers')
    .select('id,company_id,display_name,email,phone,status,app_access,driver_type,can_commercial_bid')
    .eq('id', context.driverId)
    .maybeSingle();
  if (driverResult.error || !driverResult.data) {
    return NextResponse.json({ error: driverResult.error?.message ?? 'Driver profile was not found.' }, { status: 500 });
  }

  const [vehicleResult, companyResult] = await Promise.all([
    supabaseAdmin!
      .from('vehicles')
      .select('id,type,make,model,reg_plate,status,company_id,assigned_driver_id')
      .eq('assigned_driver_id', context.driverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.companyId
      ? supabaseAdmin!
        .from('companies')
        .select('id,name,company_number,company_type,status')
        .eq('id', context.companyId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const vehicle = vehicleResult.error ? null : (vehicleResult.data ?? null) as AnyRow | null;
  const company = companyResult.error ? null : (companyResult.data ?? null) as AnyRow | null;
  const vehicleId = String(vehicle?.id ?? '');

  let operationalAlertsQuery = supabaseAdmin!
    .from('notification_events')
    .select('id,event_type,entity_type,entity_id,payload,status,created_at,recipient_user_id,company_id')
    .order('created_at', { ascending: false })
    .limit(100);
  operationalAlertsQuery = context.companyId
    ? operationalAlertsQuery.or(`recipient_user_id.eq.${context.userId},and(recipient_user_id.is.null,company_id.eq.${context.companyId})`)
    : operationalAlertsQuery.eq('recipient_user_id', context.userId);

  const [driverDocsResult, vehicleDocsResult, notificationsResult, operationalAlertsResult, journeyResult, preferencesResult] = await Promise.all([
    supabaseAdmin!.from('driver_documents').select('id,doc_type,status,expiry_date,created_at').eq('driver_id', context.driverId).order('created_at', { ascending: false }).limit(100),
    vehicleId
      ? supabaseAdmin!.from('vehicle_documents').select('id,doc_type,status,expiry_date,created_at').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    // The user-scoped inbox is retained because post-award Driver Instructions
    // are deliberately appended here when a Driver is already assigned.
    supabaseAdmin!.from('notifications').select('id,title,body,type,read_at,created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(100),
    operationalAlertsQuery,
    supabaseAdmin!.from('return_journeys')
      .select('id,from_postcode,to_postcode,available_from,available_to,vehicle_type,notes,status')
      .eq('driver_id', context.driverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin!.from('driver_job_search_preferences').select('job_id,state').eq('driver_id', context.driverId),
  ]);

  const partialResources = [
    vehicleResult.error ? 'vehicle' : null,
    companyResult.error ? 'company' : null,
    driverDocsResult.error ? 'driver_documents' : null,
    vehicleDocsResult.error ? 'vehicle_documents' : null,
    notificationsResult.error ? 'notifications' : null,
    operationalAlertsResult.error ? 'operational_alerts' : null,
    journeyResult.error ? 'return_journey' : null,
    preferencesResult.error ? 'job_search_preferences' : null,
  ].filter((value): value is string => Boolean(value));

  let invoices: AnyRow[] = [];
  if (context.companyId) {
    const invoiceResult = await supabaseAdmin!
      .from('invoices')
      .select('id,invoice_number,status,payment_status,total,amount,currency,client_name,due_date')
      .eq('company_id', context.companyId)
      .eq('created_by', context.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (invoiceResult.error) partialResources.push('invoices');
    else invoices = (invoiceResult.data ?? []) as AnyRow[];
  }

  const driver = driverResult.data as AnyRow;
  const displayName = String(driver.display_name || driver.email || 'Driver');
  const phone = String(driver.phone ?? '');
  const email = String(driver.email ?? '');
  const vehicleLabel = vehicle
    ? [[vehicle.make, vehicle.model].filter(Boolean).join(' '), String(vehicle.type || '')].filter(Boolean).join(' - ')
    : '';
  const vehicleRegistration = vehicle ? String(vehicle.reg_plate || '') : '';
  const documents = [
    ...(!driverDocsResult.error ? (driverDocsResult.data ?? []).map((row) => ({ ...row, is_vehicle_document: false })) : []),
    ...(!vehicleDocsResult.error ? (vehicleDocsResult.data ?? []).map((row) => ({ ...row, is_vehicle_document: true })) : []),
  ];

  const operationalAlerts = operationalAlertsResult.error
    ? []
    : (operationalAlertsResult.data ?? []).map((row) => ({
      ...row,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    }));
  const inboxNotifications = notificationsResult.error ? [] : notificationsResult.data ?? [];
  const inboxAlerts = inboxNotifications.map((row) => ({
    id: String(row.id),
    event_type: String(row.type || 'notification'),
    entity_type: 'notification',
    entity_id: String(row.id),
    payload: {
      message: String(row.body ?? ''),
      title: String(row.title ?? ''),
      read_at: row.read_at ?? null,
      source: 'driver_inbox',
    },
    status: row.read_at ? 'sent' : 'pending',
    created_at: String(row.created_at ?? new Date(0).toISOString()),
  }));
  const alerts = [...operationalAlerts, ...inboxAlerts]
    .sort((left, right) => timestampOf(right.created_at) - timestampOf(left.created_at))
    .slice(0, 100);

  const canonicalJourney = journeyResult.error ? null : journeyResult.data as AnyRow | null;
  const compatibilityJourney = canonicalJourney
    ? {
      ...canonicalJourney,
      from_location: canonicalJourney.from_postcode ?? null,
      to_location: canonicalJourney.to_postcode ?? null,
      available_date: canonicalJourney.available_from ?? null,
    }
    : null;

  return NextResponse.json({
    resources: {
      name: displayName,
      email,
      phone,
      driver,
      company,
      vehicle,
      quotes: [],
      documents,
      invoices,
      alerts,
      partial: partialResources,

      // Compatibility shape retained for older consumers.
      profile: {
        driver_id: context.driverId,
        company_id: context.companyId,
        vehicle_id: vehicleId || null,
        display_name: displayName,
        email,
        vehicle_label: vehicleLabel,
        vehicle_registration: vehicleRegistration,
      },
      notifications: inboxNotifications,
      return_journey: compatibilityJourney,
      nearby_drivers: [],
      job_search_preferences: preferencesResult.error ? [] : preferencesResult.data ?? [],
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
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', context.userId)
        .select('id');
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
    // Deprecated compatibility action. New Expo flows use
    // /api/driver/return-journey, but older consumers must still go through the
    // same server-only atomic canonical RPC rather than a client-side delete/insert.
    const fromPostcode = cleanString(body.fromLocation ?? body.fromPostcode, 120).toUpperCase();
    const toPostcode = cleanString(body.toLocation ?? body.toPostcode, 120).toUpperCase();
    const rawFrom = cleanString(body.availableDate ?? body.availableFrom, 80);
    const rawTo = cleanString(body.availableTo, 80);
    const availableFrom = rawFrom && Number.isFinite(Date.parse(rawFrom)) ? new Date(rawFrom).toISOString() : null;
    const availableTo = rawTo && Number.isFinite(Date.parse(rawTo)) ? new Date(rawTo).toISOString() : null;
    const vehicleType = cleanString(body.vehicleType, 100) || null;
    const notes = cleanString(body.notes, 4000) || null;
    if (!context.companyId && fromPostcode) {
      return NextResponse.json({ error: 'A company-bound driver profile is required for return journeys.' }, { status: 409 });
    }

    const { error } = await supabaseAdmin!.rpc('replace_driver_return_journey_canonical', {
      p_driver_id: context.driverId,
      p_company_id: context.companyId,
      p_from_postcode: fromPostcode || null,
      p_to_postcode: toPostcode || null,
      p_available_from: availableFrom,
      p_available_to: availableTo,
      p_vehicle_type: vehicleType,
      p_notes: notes,
    });
    if (error) {
      const status = error.code === '22023' ? 400 : error.code === '42501' ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
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
    if (!hasExpectedDocumentMagicBytes(bytes, mimeType)) {
      return NextResponse.json({ error: 'Document content does not match its declared file type.' }, { status: 415 });
    }

    const vehicleResult = isVehicleDocument
      ? await supabaseAdmin!.from('vehicles').select('id').eq('assigned_driver_id', context.driverId).eq('company_id', context.companyId).limit(1).maybeSingle()
      : { data: null, error: null };
    if (vehicleResult.error) return NextResponse.json({ error: vehicleResult.error.message }, { status: 500 });
    if (isVehicleDocument && !vehicleResult.data?.id) return NextResponse.json({ error: 'No assigned vehicle is available for this document.' }, { status: 409 });

    const uploadFolder = context.companyId ?? context.driverId;
    const path = `${uploadFolder}/${context.driverId}/${randomUUID()}-${fileName}`;
    const { error: storageError } = await supabaseAdmin!.storage.from('driver-docs').upload(path, bytes, { contentType: mimeType, upsert: false });
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

    const insertResult = isVehicleDocument
      ? await supabaseAdmin!.from('vehicle_documents').insert({ vehicle_id: vehicleResult.data!.id, doc_type: docType, file_path: path, status: 'pending', uploaded_by: context.userId })
      : await supabaseAdmin!.from('driver_documents').insert({ driver_id: context.driverId, doc_type: docType, file_path: path, status: 'pending' });
    if (insertResult.error) {
      await supabaseAdmin!.storage.from('driver-docs').remove([path]);
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
