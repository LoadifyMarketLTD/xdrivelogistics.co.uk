import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

async function resolveDriver(request: NextRequest): Promise<{
  userId: string;
  driverId: string;
  companyId: string | null;
} | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authErr,
  } = await validatorClient.auth.getUser(token);
  if (authErr || !user) return null;

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!driver?.id) return null;
  return { userId: user.id, driverId: driver.id as string, companyId: driver.company_id as string | null };
}

// GET /api/driver/vehicles — list vehicles assigned to this driver
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return json(403, { error: 'Forbidden — active driver record required.' });

  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, company_id, created_at')
    .eq('assigned_driver_id', driver.driverId)
    .order('created_at', { ascending: false });

  if (error) return json(500, { error: error.message });

  return json(200, { vehicles: data ?? [], driverId: driver.driverId });
}

// POST /api/driver/vehicles — register a new vehicle for this driver
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return json(403, { error: 'Forbidden — active driver record required.' });

  if (!driver.companyId) {
    return json(400, { error: 'Driver must be linked to a company before registering a vehicle.' });
  }

  let body: {
    type?: string;
    reg_plate?: string;
    make?: string;
    model?: string;
    payload_kg?: number | null;
    pallets_capacity?: number | null;
    has_tail_lift?: boolean;
    has_straps?: boolean;
    has_blankets?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  if (!body.type?.trim()) return json(400, { error: 'Vehicle type is required.' });
  if (!body.reg_plate?.trim()) return json(400, { error: 'Registration plate is required.' });

  const { data: vehicle, error: insertErr } = await supabaseAdmin
    .from('vehicles')
    .insert({
      company_id: driver.companyId,
      assigned_driver_id: driver.driverId,
      type: body.type.trim(),
      reg_plate: body.reg_plate.trim().toUpperCase(),
      make: body.make?.trim() ?? null,
      model: body.model?.trim() ?? null,
      payload_kg: body.payload_kg ?? null,
      pallets_capacity: body.pallets_capacity ?? null,
      has_tail_lift: body.has_tail_lift ?? false,
      has_straps: body.has_straps ?? false,
      has_blankets: body.has_blankets ?? false,
    })
    .select('id, type, reg_plate, make, model, payload_kg, has_tail_lift, created_at')
    .single();

  if (insertErr) return json(500, { error: insertErr.message });

  return json(201, { vehicle, success: true });
}

// PATCH /api/driver/vehicles — update or deactivate a vehicle
export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return json(403, { error: 'Forbidden — active driver record required.' });

  let body: {
    vehicleId?: string;
    action?: string;
    type?: string;
    reg_plate?: string;
    make?: string;
    model?: string;
    payload_kg?: number | null;
    pallets_capacity?: number | null;
    has_tail_lift?: boolean;
    has_straps?: boolean;
    has_blankets?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { vehicleId, action } = body;
  if (!vehicleId) return json(400, { error: 'vehicleId is required.' });

  // Confirm vehicle is assigned to this driver
  const { data: vehicle } = await supabaseAdmin
    .from('vehicles')
    .select('id, assigned_driver_id')
    .eq('id', vehicleId)
    .maybeSingle();

  if (!vehicle) return json(404, { error: 'Vehicle not found.' });
  if (vehicle.assigned_driver_id !== driver.driverId) {
    return json(403, { error: 'Forbidden — this vehicle is not assigned to you.' });
  }

  if (action === 'deactivate') {
    // Unassign vehicle from driver (soft deactivation — remove assignment)
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('vehicles')
      .update({ assigned_driver_id: null })
      .eq('id', vehicleId)
      .select('id, reg_plate')
      .single();

    if (updateErr) return json(500, { error: updateErr.message });
    return json(200, { vehicle: updated, action: 'deactivated', success: true });
  }

  // Default: update vehicle fields
  const updatePayload: Record<string, unknown> = {};
  if (body.type?.trim()) updatePayload.type = body.type.trim();
  if (body.reg_plate?.trim()) updatePayload.reg_plate = body.reg_plate.trim().toUpperCase();
  if ('make' in body) updatePayload.make = body.make?.trim() ?? null;
  if ('model' in body) updatePayload.model = body.model?.trim() ?? null;
  if ('payload_kg' in body) updatePayload.payload_kg = body.payload_kg ?? null;
  if ('pallets_capacity' in body) updatePayload.pallets_capacity = body.pallets_capacity ?? null;
  if ('has_tail_lift' in body) updatePayload.has_tail_lift = body.has_tail_lift;
  if ('has_straps' in body) updatePayload.has_straps = body.has_straps;
  if ('has_blankets' in body) updatePayload.has_blankets = body.has_blankets;

  if (Object.keys(updatePayload).length === 0) {
    return json(400, { error: 'No updatable fields provided.' });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('vehicles')
    .update(updatePayload)
    .eq('id', vehicleId)
    .select('id, type, reg_plate, make, model, payload_kg, has_tail_lift')
    .single();

  if (updateErr) return json(500, { error: updateErr.message });

  return json(200, { vehicle: updated, action: 'updated', success: true });
}
