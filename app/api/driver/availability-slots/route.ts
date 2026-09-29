import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const patchSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  slot: z.enum(['AM', 'PM', 'EVENING']),
  available: z.boolean(),
});

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { data, error } = await supabaseAdmin
    .from('driver_availability_slots')
    .select('day_of_week, slot, available')
    .eq('driver_id', driver.driverId)
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
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid weekly schedule update.' });
  }

  const { data, error } = await supabaseAdmin
    .from('driver_availability_slots')
    .upsert(
      {
        driver_id: driver.driverId,
        day_of_week: parsed.data.day_of_week,
        slot: parsed.data.slot,
        available: parsed.data.available,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id,day_of_week,slot' },
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
