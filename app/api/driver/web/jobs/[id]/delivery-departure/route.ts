import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { respond } from '../../../../mobile/_lib';
import { isWebDriverContext, requireActiveWebDriver } from '../../../../_lib/webDriverContext';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const optionalNumber = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { id: jobId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return respond(400, { error: 'Invalid JSON body.' });

  const yourRef = clean(body.yourRef, 160);
  const customerRef = clean(body.customerRef, 160);
  const notes = clean(body.notes, 2000);
  const itemCount = optionalNumber(body.itemCount, 0, 100000);
  const weightKg = optionalNumber(body.weightKg, 0, 100000);
  if ([itemCount, weightKg].some((value) => Number.isNaN(value))) {
    return respond(400, { error: 'Items and weight must be valid positive numbers.' });
  }

  const etaRaw = clean(body.etaAt, 80);
  const etaDate = etaRaw ? new Date(etaRaw) : null;
  if (!etaDate || !Number.isFinite(etaDate.getTime())) {
    return respond(400, { error: 'Enter a valid delivery ETA date and time.' });
  }
  const now = Date.now();
  if (etaDate.getTime() < now - 5 * 60 * 1000 || etaDate.getTime() > now + 14 * 24 * 60 * 60 * 1000) {
    return respond(400, { error: 'Delivery ETA must be between now and 14 days from now.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,current_status,status,assigned_driver_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Booking could not be resolved.' });
  if (!job) return respond(404, { error: 'Booking not found.' });

  const status = String(job.current_status || job.status || '').toLowerCase();
  if (!['loaded', 'in_transit'].includes(status)) {
    return respond(409, { error: 'Delivery departure details can be saved only after the load is confirmed Loaded.' });
  }

  const {data:stops,error:stopsError}=await supabaseAdmin
    .from('job_stops')
    .select('stop_type,status')
    .eq('job_id',jobId);
  if(stopsError){
    const detail=(stopsError.message||'').toLowerCase();
    if(!detail.includes('job_stops'))return respond(503,{error:'Collection stop state could not be verified.'});
  }else{
    const remaining=(stops??[]).filter(stop=>stop.stop_type==='collection'&&!['completed','skipped'].includes(String(stop.status??'pending').toLowerCase()));
    if(remaining.length)return respond(409,{error:'Complete all collection stops before saving the delivery ETA.',remainingCollectionStops:remaining.length});
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (yourRef) update.booking_reference = yourRef;
  if (customerRef) update.customer_reference = customerRef;
  if (itemCount !== null) update.no_of_items = Math.round(itemCount);
  if (weightKg !== null) update.weight_kg = weightKg;
  if (notes) update.driver_notes = notes;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .select('id')
    .maybeSingle();
  if (updateError) return respond(500, { error: 'Delivery departure details could not be saved.' });
  if (!updated) return respond(409, { error: 'Booking changed while saving. Refresh and retry.' });

  const capturedAt = new Date().toISOString();
  const { error: eventError } = await supabaseAdmin.from('job_tracking_events').insert({
    job_id: jobId,
    created_by: driver.userId,
    user_id: driver.userId,
    event_type: 'driver_delivery_departure_details',
    event_time: capturedAt,
    message: `Delivery ETA recorded for ${etaDate.toISOString()}.`,
    meta: {
      source: 'driver_pwa',
      etaAt: etaDate.toISOString(),
      yourRef: yourRef || null,
      customerRef: customerRef || null,
      itemCount,
      weightKg,
      notes: notes || null,
    },
  });
  if (eventError) return respond(500, { error: 'Departure details were saved, but the audit event could not be recorded.' });

  return respond(200, { ok: true, etaAt: etaDate.toISOString() });
}
