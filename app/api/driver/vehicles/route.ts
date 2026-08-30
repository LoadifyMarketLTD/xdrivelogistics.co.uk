import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';
import { resolveDriverOperationalEligibility } from '../_lib/operationalEligibility';

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

const deactivateSchema = z.object({
  vehicleId: z.string().uuid(),
  action: z.literal('deactivate'),
});

const assignToMeSchema = z.object({
  vehicleId: z.string().uuid(),
  action: z.literal('assign_to_me'),
});

const resolveDriver = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return {
      error: operationalError({
        status: 503,
        message: 'Vehicle management is temporarily unavailable.',
        context: 'driver.vehicles.config',
        retryable: true,
      }),
    };
  }
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized — missing bearer token.' }) };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Unauthorized — invalid or expired token.' }) };
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError) {
    return {
      error: operationalError({
        status: 500,
        message: 'We could not load your driver profile. Please try again.',
        context: `driver.vehicles.resolve-driver.user:${authData.user.id}`,
        cause: driverError,
        retryable: true,
      }),
    };
  }

  if (!driver || driver.status !== 'active' || !driver.company_id) {
    return { error: json(403, { error: 'Active company-linked driver profile required.' }) };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('user_id', authData.user.id)
    .eq('company_id', driver.company_id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return {
      error: operationalError({
        status: 500,
        message: 'We could not verify your vehicle permissions. Please try again.',
        context: `driver.vehicles.membership.user:${authData.user.id}`,
        cause: membershipError,
        retryable: true,
      }),
    };
  }

  const canManageCompanyVehicles = ['owner', 'admin'].includes(String(membership?.role_in_company ?? '').toLowerCase());
  return {
    user: authData.user,
    driverId: driver.id,
    companyId: driver.company_id as string,
    canManageCompanyVehicles,
  };
};

export async function GET(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;
  const { driverId, companyId, canManageCompanyVehicles } = resolved;
  const admin = supabaseAdmin!;

  let query = admin
    .from('vehicles')
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, assigned_driver_id, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);

  // Company drivers see only vehicle records assigned to them. Fleet inventory
  // belongs to Fleet/Company administration, not to the Driver workspace.
  if (!canManageCompanyVehicles) query = query.eq('assigned_driver_id', driverId);

  const { data: vehicles, error } = await query;

  if (error) {
    return operationalError({
      status: 500,
      message: 'We could not load your vehicles. Please try again.',
      context: `driver.vehicles.list.company:${companyId}`,
      cause: error,
      retryable: true,
    });
  }

  let canonicalVehicleId: string | null = null;
  let canonicalVehicleSignalAvailable = true;
  try {
    const operational = await resolveDriverOperationalEligibility(admin, driverId);
    canonicalVehicleId = operational.blockers.includes('canonical_vehicle_company_mismatch')
      ? null
      : operational.canonicalVehicleId;
  } catch {
    canonicalVehicleSignalAvailable = false;
  }

  return json(200, {
    vehicles: vehicles ?? [],
    assignedVehicleId: (vehicles ?? []).find((v) => v.assigned_driver_id === driverId && String(v.status ?? '').toLowerCase() === 'active')?.id ?? null,
    canonicalVehicleId,
    canonicalVehicleSignalAvailable,
    canManageVehicles: canManageCompanyVehicles,
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;
  const { companyId, canManageCompanyVehicles } = resolved;
  if (!canManageCompanyVehicles) {
    return json(403, { error: 'Only an owner/admin driver can add company vehicles. Fleet changes are managed by your company.' });
  }
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
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, assigned_driver_id, status')
    .maybeSingle();

  if (insertError) {
    return operationalError({
      status: 500,
      message: 'We could not add this vehicle. Please try again.',
      context: `driver.vehicles.create.company:${companyId}`,
      cause: insertError,
      retryable: true,
    });
  }

  return json(201, { vehicle: inserted });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;
  const { companyId, driverId, canManageCompanyVehicles } = resolved;
  if (!canManageCompanyVehicles) {
    return json(403, { error: 'Only an owner/admin driver can change company vehicle records. Contact your fleet manager for assignment changes.' });
  }
  const admin = supabaseAdmin!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const assignToMe = assignToMeSchema.safeParse(body);
  if (assignToMe.success) {
    const { data: vehicle, error: vehicleError } = await admin
      .from('vehicles')
      .select('id,company_id,assigned_driver_id,status,reg_plate')
      .eq('id', assignToMe.data.vehicleId)
      .maybeSingle();
    if (vehicleError) return json(500, { error: 'The vehicle assignment could not be verified.' });
    if (!vehicle) return json(404, { error: 'Vehicle not found.' });
    if (vehicle.company_id !== companyId) return json(403, { error: 'This vehicle does not belong to your company.' });
    if (String(vehicle.status ?? '').trim().toLowerCase() !== 'active') {
      return json(409, { error: 'Only an active vehicle can be assigned to your Driver profile.' });
    }
    if (vehicle.assigned_driver_id && vehicle.assigned_driver_id !== driverId) {
      return json(409, { error: 'This vehicle is already assigned to another Driver.' });
    }
    if (vehicle.assigned_driver_id === driverId) {
      return json(200, { vehicle, action: 'assigned_to_me', idempotent: true });
    }

    const { data: existing, error: existingError } = await admin
      .from('vehicles')
      .select('id,reg_plate')
      .eq('assigned_driver_id', driverId)
      .eq('status', 'active')
      .neq('id', vehicle.id)
      .limit(1)
      .maybeSingle();
    if (existingError) return json(500, { error: 'Your current vehicle assignment could not be verified.' });
    if (existing) {
      return json(409, {
        error: `You already have an active assigned vehicle${existing.reg_plate ? ` (${existing.reg_plate})` : ''}. Unassign it before choosing another.`,
      });
    }

    const { data: updated, error: updateError } = await admin
      .from('vehicles')
      .update({ assigned_driver_id: driverId })
      .eq('id', vehicle.id)
      .eq('company_id', companyId)
      .is('assigned_driver_id', null)
      .select('id,reg_plate,assigned_driver_id,status')
      .maybeSingle();
    if (updateError) return json(500, { error: 'The vehicle could not be assigned to your Driver profile.' });
    if (!updated) return json(409, { error: 'The vehicle assignment changed before your request completed. Refresh and try again.' });
    return json(200, { vehicle: updated, action: 'assigned_to_me', idempotent: false });
  }

  const deactivate = deactivateSchema.safeParse(body);
  if (deactivate.success) {
    const { data: vehicle, error: vehicleError } = await admin
      .from('vehicles')
      .select('id, company_id, assigned_driver_id, reg_plate')
      .eq('id', deactivate.data.vehicleId)
      .maybeSingle();

    if (vehicleError) {
      return operationalError({
        status: 500,
        message: 'We could not verify this vehicle. Please try again.',
        context: `driver.vehicles.deactivate.lookup:${deactivate.data.vehicleId}`,
        cause: vehicleError,
        retryable: true,
      });
    }
    if (!vehicle) return json(404, { error: 'Vehicle not found.' });
    if (vehicle.company_id !== companyId) {
      return json(403, { error: 'Access denied — vehicle does not belong to your company.' });
    }
    if (vehicle.assigned_driver_id !== driverId) {
      return json(403, { error: 'Forbidden — this vehicle is not assigned to your driver profile.' });
    }

    const { data: updated, error: updateError } = await admin
      .from('vehicles')
      .update({ assigned_driver_id: null })
      .eq('id', deactivate.data.vehicleId)
      .select('id, reg_plate, assigned_driver_id')
      .maybeSingle();

    if (updateError) {
      return operationalError({
        status: 500,
        message: 'We could not unassign this vehicle. Please try again.',
        context: `driver.vehicles.deactivate.update:${deactivate.data.vehicleId}`,
        cause: updateError,
        retryable: true,
      });
    }
    return json(200, { vehicle: updated, action: 'unassigned' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { id: vehicleId, ...updateFields } = parsed.data;

  const { data: vehicle, error: vehicleError } = await admin
    .from('vehicles')
    .select('id, company_id')
    .eq('id', vehicleId)
    .maybeSingle();

  if (vehicleError) {
    return operationalError({
      status: 500,
      message: 'We could not verify this vehicle. Please try again.',
      context: `driver.vehicles.update.lookup:${vehicleId}`,
      cause: vehicleError,
      retryable: true,
    });
  }
  if (!vehicle) return json(404, { error: 'Vehicle not found.' });
  if (vehicle.company_id !== companyId) {
    return json(403, { error: 'Access denied — vehicle does not belong to your company.' });
  }

  const { data: updated, error: updateError } = await admin
    .from('vehicles')
    .update(updateFields)
    .eq('id', vehicleId)
    .select('id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift, has_straps, has_blankets, assigned_driver_id, status')
    .maybeSingle();

  if (updateError) {
    return operationalError({
      status: 500,
      message: 'We could not update this vehicle. Please try again.',
      context: `driver.vehicles.update:${vehicleId}`,
      cause: updateError,
      retryable: true,
    });
  }

  return json(200, { vehicle: updated });
}
