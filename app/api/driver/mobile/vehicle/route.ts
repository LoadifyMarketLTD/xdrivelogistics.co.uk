import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('id, reg_plate, type, make, model, payload_kg, pallets_capacity, has_tail_lift')
    .eq('assigned_driver_id', driver.driverId)
    .limit(1)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });

  return respond(200, { vehicle: data ?? null });
}
