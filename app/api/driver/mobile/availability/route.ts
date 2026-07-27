import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

type AvailabilitySlot = {
  day_of_week: number;
  slot: 'AM' | 'PM' | 'EVENING';
  available: boolean;
};

type PutBody = {
  availability_status?: string;
  slots?: AvailabilitySlot[];
};

const VALID_STATUS = ['available', 'busy', 'offline'] as const;
const VALID_SLOTS = ['AM', 'PM', 'EVENING'] as const;

/**
 * GET /api/driver/mobile/availability
 * Returns the driver's current availability_status and their weekly slot grid.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const [driverResult, slotsResult] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('availability_status')
      .eq('id', driver.driverId)
      .maybeSingle(),
    supabaseAdmin
      .from('driver_availability_slots')
      .select('day_of_week,slot,available')
      .eq('driver_id', driver.driverId)
      .order('day_of_week', { ascending: true }),
  ]);

  if (driverResult.error) return respond(500, { error: driverResult.error.message });
  if (slotsResult.error) return respond(500, { error: slotsResult.error.message });

  const availabilityStatus = String(driverResult.data?.availability_status ?? 'offline');
  const slots: AvailabilitySlot[] = (slotsResult.data ?? []).map((row: { day_of_week: unknown; slot: unknown; available: unknown }) => ({
    day_of_week: Number(row.day_of_week),
    slot: String(row.slot) as AvailabilitySlot['slot'],
    available: Boolean(row.available),
  }));

  return respond(200, { availability_status: availabilityStatus, slots });
}

/**
 * PUT /api/driver/mobile/availability
 * Updates the driver's availability_status and/or their weekly slot grid.
 *
 * Body: { availability_status?: "available"|"busy"|"offline", slots?: [...] }
 * Each slot: { day_of_week: 0–6, slot: "AM"|"PM"|"EVENING", available: boolean }
 *
 * Slots are upserted via unique(driver_id, day_of_week, slot).
 * Omitting a key leaves it unchanged.
 */
export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { availability_status: newStatus, slots: newSlots } = body;

  if (newStatus !== undefined && !(VALID_STATUS as readonly string[]).includes(newStatus)) {
    return respond(400, { error: `availability_status must be one of: ${VALID_STATUS.join(', ')}.` });
  }

  if (newSlots !== undefined) {
    if (!Array.isArray(newSlots)) return respond(400, { error: 'slots must be an array.' });
    for (const s of newSlots) {
      if (!Number.isInteger(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6) {
        return respond(400, { error: 'Each slot.day_of_week must be an integer 0–6.' });
      }
      if (!(VALID_SLOTS as readonly string[]).includes(s.slot)) {
        return respond(400, { error: `Each slot.slot must be one of: ${VALID_SLOTS.join(', ')}.` });
      }
      if (typeof s.available !== 'boolean') {
        return respond(400, { error: 'Each slot.available must be a boolean.' });
      }
    }
  }

  if (newStatus !== undefined) {
    const { error } = await supabaseAdmin
      .from('drivers')
      .update({ availability_status: newStatus })
      .eq('id', driver.driverId);
    if (error) return respond(500, { error: error.message });
  }

  if (newSlots && newSlots.length > 0) {
    const upsertRows = newSlots.map((s) => ({
      driver_id: driver.driverId,
      day_of_week: s.day_of_week,
      slot: s.slot,
      available: s.available,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from('driver_availability_slots')
      .upsert(upsertRows, { onConflict: 'driver_id,day_of_week,slot' });
    if (error) return respond(500, { error: error.message });
  }

  const [driverResult, slotsResult] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('availability_status')
      .eq('id', driver.driverId)
      .maybeSingle(),
    supabaseAdmin
      .from('driver_availability_slots')
      .select('day_of_week,slot,available')
      .eq('driver_id', driver.driverId)
      .order('day_of_week', { ascending: true }),
  ]);

  const updatedStatus = String(driverResult.data?.availability_status ?? 'offline');
  const updatedSlots: AvailabilitySlot[] = (slotsResult.data ?? []).map((row: { day_of_week: unknown; slot: unknown; available: unknown }) => ({
    day_of_week: Number(row.day_of_week),
    slot: String(row.slot) as AvailabilitySlot['slot'],
    available: Boolean(row.available),
  }));

  return respond(200, { availability_status: updatedStatus, slots: updatedSlots });
}
