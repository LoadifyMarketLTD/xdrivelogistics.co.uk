import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Direct Booking resources are temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const companyId = request.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  if (!companyId) return respond(400, { error: 'companyId is required.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return respond(503, { error: 'Company membership could not be verified.' });
  const role = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin', 'fleet_manager', 'dispatcher'].includes(role)) {
    return respond(403, { error: 'This role cannot allocate internal Direct Bookings.' });
  }

  const [{ data: drivers, error: driversError }, { data: vehicles, error: vehiclesError }] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id, display_name, full_name, email, status, availability_status, driver_type')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('display_name', { ascending: true }),
    supabaseAdmin
      .from('vehicles')
      .select('id, reg_plate, type, status, assigned_driver_id')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('reg_plate', { ascending: true }),
  ]);

  if (driversError || vehiclesError) {
    return respond(503, { error: 'Internal drivers and vehicles could not be loaded.' });
  }

  return respond(200, {
    drivers: (drivers ?? []).map((driver) => ({
      id: String(driver.id),
      name: driver.display_name || driver.full_name || driver.email || 'Driver',
      availabilityStatus: driver.availability_status ?? null,
      driverType: driver.driver_type ?? null,
    })),
    vehicles: (vehicles ?? []).map((vehicle) => ({
      id: String(vehicle.id),
      registration: vehicle.reg_plate ?? 'No registration',
      type: vehicle.type ?? null,
      assignedDriverId: vehicle.assigned_driver_id ?? null,
    })),
  });
}
