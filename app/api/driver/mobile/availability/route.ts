import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';
import {
  normalizeAvailabilitySlots,
  normalizeAvailabilityStatus,
  validateAvailabilityPutBody,
} from './contract';

type AvailabilitySlot = {
  day_of_week: number;
  slot: 'AM' | 'PM' | 'EVENING';
  available: boolean;
};

type PutBody = {
  availability_status?: string;
  slots?: AvailabilitySlot[];
};

// PostgreSQL native codes for missing table/column, and PostgREST schema-cache codes for
// when the schema cache hasn't yet refreshed after a migration (column/relationship not found).
const AVAILABILITY_SCHEMA_ERROR_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST200']);

function availabilitySchemaResponse(error: { code?: string; message: string }) {
  if (error.code && AVAILABILITY_SCHEMA_ERROR_CODES.has(error.code)) {
    return respond(503, { error: 'Availability schema is not installed on this environment yet.' });
  }
  return respond(500, { error: error.message });
}

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

  if (driverResult.error) return availabilitySchemaResponse(driverResult.error);
  if (slotsResult.error) return availabilitySchemaResponse(slotsResult.error);

  const availabilityStatus = normalizeAvailabilityStatus(driverResult.data?.availability_status);
  const slots: AvailabilitySlot[] = normalizeAvailabilitySlots(slotsResult.data ?? []);

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

  let body: PutBody | unknown;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const validatedBody = validateAvailabilityPutBody(body);
  if (!validatedBody.ok) return respond(400, { error: validatedBody.error });
  const { availability_status: newStatus, slots: newSlots } = validatedBody.value;

  if (newStatus !== undefined) {
    const { error } = await supabaseAdmin
      .from('drivers')
      .update({ availability_status: newStatus })
      .eq('id', driver.driverId);
    if (error) return availabilitySchemaResponse(error);
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
    if (error) return availabilitySchemaResponse(error);
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
  if (driverResult.error) return availabilitySchemaResponse(driverResult.error);
  if (slotsResult.error) return availabilitySchemaResponse(slotsResult.error);

  const updatedStatus = normalizeAvailabilityStatus(driverResult.data?.availability_status);
  const updatedSlots: AvailabilitySlot[] = normalizeAvailabilitySlots(slotsResult.data ?? []);

  return respond(200, { availability_status: updatedStatus, slots: updatedSlots });
}
