import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

type AvailabilityStatus = 'available' | 'busy' | 'offline';

const AVAILABILITY = new Set<AvailabilityStatus>(['available', 'busy', 'offline']);
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

function validRadius(value: unknown) {
  const radius = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(radius) && [10, 20, 30].includes(radius) ? radius : null;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Driver availability profile is temporarily unavailable.' });
  }

  const context = await requireActiveWebDriver(request);
  if (!isWebDriverContext(context)) return context;

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select('id,availability_status,destination_priority_enabled,destination_radius_miles,future_position,future_position_date,status')
    .eq('id', context.driverId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (error) return json(500, { error: 'Driver availability profile could not be loaded.' });
  if (!data) return json(404, { error: 'Driver profile was not found.' });
  return json(200, { driver: data });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Driver availability profile is temporarily unavailable.' });
  }

  const context = await requireActiveWebDriver(request);
  if (!isWebDriverContext(context)) return context;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json(400, { error: 'Invalid JSON body.' });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.availabilityStatus !== undefined) {
    const availabilityStatus = String(body.availabilityStatus).trim().toLowerCase() as AvailabilityStatus;
    if (!AVAILABILITY.has(availabilityStatus)) {
      return json(400, { error: 'Availability must be available, busy or offline.' });
    }
    updates.availability_status = availabilityStatus;
  }

  if (body.destinationPriorityEnabled !== undefined) {
    if (typeof body.destinationPriorityEnabled !== 'boolean') {
      return json(400, { error: 'Destination priority must be true or false.' });
    }
    updates.destination_priority_enabled = body.destinationPriorityEnabled;
  }
  if (body.destinationRadiusMiles !== undefined) {
    const radius = validRadius(body.destinationRadiusMiles);
    if (radius === null) {
      return json(400, { error: 'Destination radius must be 10, 20 or 30 miles.' });
    }
    updates.destination_radius_miles = radius;
  }

  if (Object.keys(updates).length === 1) {
    return json(400, { error: 'No supported availability fields were provided.' });
  }

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .update(updates)
    .eq('id', context.driverId)
    .eq('user_id', context.userId)
    .eq('app_access', true)
    .select('id,availability_status,destination_priority_enabled,destination_radius_miles,future_position,future_position_date,status')
    .maybeSingle();

  if (error) return json(500, { error: 'Driver availability profile could not be updated.' });
  if (!data) return json(409, { error: 'Your Driver workspace record could not be updated.' });

  if (data.availability_status !== 'available') {
    await supabaseAdmin.from('driver_availability_presence').delete().eq('driver_id', context.driverId);
  }

  return json(200, { driver: data });
}
