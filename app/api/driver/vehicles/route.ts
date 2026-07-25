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

const VEHICLE_TYPES = [
  'bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton',
  'truck_7_5t', 'truck_18t', 'artic', 'swb_van', 'mwb_van', 'lwb_van',
  'xlwb_van', 'luton_tail_lift', 'curtainside_van', 'truck_3_5t', 'truck_5t',
  'truck_12t', 'truck_26t', 'artic_44t_curtainsider', 'artic_44t_box_trailer',
  'artic_44t_flatbed', 'artic_44t_refrigerated', 'artic_44t_double_deck',
  'hiab', 'moffett', 'adr_vehicle', 'refrigerated_vehicle',
  'temperature_controlled_vehicle',
] as const;

const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  reg_plate: z.string().min(1).max(20).optional(),
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  payload_kg: z.number().int().min(1).max(100000).optional(),
  pallets_capacity: z.number().int().min(1).max(500).optional(),
  has_tail_lift: z.boolean().optional(),
  has_straps: z.boolean().optional(),
  has_blankets: z.boolean().optional(),
});

const patchSchema = vehicleSchema.partial().extend({
  id: z.string().uuid(),
});

const resolveDriver = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Service not configured.' }) };
  }
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized — missing bearer token.' }) };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Unauthorized — invalid or expired token.' }) };
  }

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (!driver) {
    return { error: json(403, { error: 'Driver profile not found.' }) };
  }

  return { user: authData.user, driverId: driver.id, companyId: driver.company_id as string };
};

export async function GET(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;
  const { driverId, companyId } = resolved;
  const admin = supabaseAdmin!;

  const { data: vehicles, error } = await admin
    .from('vehicles')
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, assigned_driver_id, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json(500, { error: error.message });

  return json(200, {
    vehicles: vehicles ?? [],
    assignedVehicleId: (vehicles ?? []).find((v) => v.assigned_driver_id === driverId)?.id ?? null,
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;
  const { companyId } = resolved;
  const admin = supabaseAdmin!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = vehicleSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { data: inserted, error: insertError } = await admin
    .from('vehicles')
    .insert({ ...parsed.data, company_id: companyId })
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets')
    .maybeSingle();

  if (insertError) return json(500, { error: insertError.message });

  return json(201, { vehicle: inserted });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;
  const { companyId } = resolved;
  const admin = supabaseAdmin!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { id: vehicleId, ...updateFields } = parsed.data;

  // Verify ownership
  const { data: vehicle } = await admin
    .from('vehicles')
    .select('id, company_id')
    .eq('id', vehicleId)
    .maybeSingle();

  if (!vehicle) return json(404, { error: 'Vehicle not found.' });
  if (vehicle.company_id !== companyId) {
    return json(403, { error: 'Access denied — vehicle does not belong to your company.' });
  }

  const { data: updated, error: updateError } = await admin
    .from('vehicles')
    .update(updateFields)
    .eq('id', vehicleId)
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets')
    .maybeSingle();

  if (updateError) return json(500, { error: updateError.message });

  return json(200, { vehicle: updated });
}
