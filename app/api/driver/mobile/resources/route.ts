import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../_lib';

type AnyRow = Record<string, unknown>;

function cleanString(value: unknown, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: NextRequest) {
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return context;

  const driverResult = await supabaseAdmin!
    .from('drivers')
    .select('id,company_id,display_name,full_name,name,email,phone,status,app_access,driver_type,can_commercial_bid')
    .eq('id', context.driverId)
    .maybeSingle();
  if (driverResult.error || !driverResult.data) {
    return NextResponse.json({ error: driverResult.error?.message ?? 'Driver profile was not found.' }, { status: 500 });
  }

  const vehicleResult = await supabaseAdmin!
    .from('vehicles')
    .select('id,type,vehicle_type,make,model,registration,reg_plate,reg')
    .eq('assigned_driver_id', context.driverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vehicleResult.error) return NextResponse.json({ error: vehicleResult.error.message }, { status: 500 });
  const vehicleId = String(vehicleResult.data?.id ?? '');

  const [driverDocsResult, vehicleDocsResult, notificationsResult, journeyResult, preferencesResult] = await Promise.all([
    supabaseAdmin!.from('driver_documents').select('id,doc_type,status,expiry_date,created_at').eq('driver_id', context.driverId).order('created_at', { ascending: false }).limit(100),
    vehicleId
      ? supabaseAdmin!.from('vehicle_documents').select('id,doc_type,status,expiry_date,created_at').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin!.from('notifications').select('id,title,body,type,read_at,created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin!.from('return_journeys').select('id,from_location,to_location,available_date').eq('driver_id', context.driverId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin!.from('driver_job_search_preferences').select('job_id,state').eq('driver_id', context.driverId),
  ]);

  const firstError = driverDocsResult.error ?? vehicleDocsResult.error ?? notificationsResult.error ?? journeyResult.error ?? preferencesResult.error;
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
  const displayName = String(driver.display_name || driver.full_name || driver.name || driver.email || 'Driver');
  const vehicleLabel = vehicle
    ? [[vehicle.make, vehicle.model].filter(Boolean).join(' '), String(vehicle.vehicle_type || vehicle.type || '')].filter(Boolean).join(' - ')
    : '';
  const vehicleRegistration = vehicle ? String(vehicle.registration || vehicle.reg_plate || vehicle.reg || '') : '';

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
      },
      documents: [
        ...(driverDocsResult.data ?? []).map((row) => ({ ...row, is_vehicle_document: false })),
        ...(vehicleDocsResult.data ?? []).map((row) => ({ ...row, is_vehicle_document: true })),
      ],
      notifications: notificationsResult.data ?? [],
      return_journey: journeyResult.data ?? null,
      invoices,
      nearby_drivers: [],
      job_search_preferences: preferencesResult.data ?? [],
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
    const fromLocation = cleanString(body.fromLocation, 300);
    const toLocation = cleanString(body.toLocation, 300);
    const rawDate = cleanString(body.availableDate, 80);
    const availableDate = rawDate && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : null;
    const { error } = await supabaseAdmin!.rpc('replace_driver_return_journey', {
      p_driver_id: context.driverId,
      p_company_id: context.companyId,
      p_from_location: fromLocation,
      p_to_location: toLocation,
      p_available_date: availableDate,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '22023' ? 400 : 500 });
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
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: 'Document must be 10 MB or smaller.' }, { status: 400 });

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
