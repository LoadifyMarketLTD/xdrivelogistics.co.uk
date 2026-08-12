import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const patchSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  slot: z.enum(['AM', 'PM', 'EVENING']),
  available: z.boolean(),
});

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Service not configured.' }) } as const;
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: json(401, { error: 'Unauthorized — missing bearer token.' }) } as const;
  }

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Unauthorized — invalid or expired token.' }) } as const;
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError || !driver) {
    return { error: json(403, { error: 'Driver profile required.' }) } as const;
  }

  const status = String(driver.status ?? '').trim().toLowerCase();
  if (['suspended', 'inactive', 'blocked', 'rejected'].includes(status)) {
    return { error: json(403, { error: 'Active driver profile required.' }) } as const;
  }

  return { driverId: driver.id as string } as const;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;

  const { data, error } = await supabaseAdmin!
    .from('driver_availability_slots')
    .select('day_of_week, slot, available')
    .eq('driver_id', resolved.driverId)
    .order('day_of_week', { ascending: true });

  if (error) {
    return json(503, {
      error: 'Weekly schedule is not available in this database build.',
      code: 'SCHEDULE_NOT_AVAILABLE',
    });
  }

  return json(200, { slots: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid weekly schedule update.' });
  }

  const { data, error } = await supabaseAdmin!
    .from('driver_availability_slots')
    .upsert(
      {
        driver_id: resolved.driverId,
        day_of_week: parsed.data.day_of_week,
        slot: parsed.data.slot,
        available: parsed.data.available,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id,day_of_week,slot' }
    )
    .select('day_of_week, slot, available')
    .maybeSingle();

  if (error) {
    return json(503, {
      error: 'Weekly schedule could not be updated.',
      code: 'SCHEDULE_NOT_AVAILABLE',
    });
  }

  return json(200, { slot: data });
}
