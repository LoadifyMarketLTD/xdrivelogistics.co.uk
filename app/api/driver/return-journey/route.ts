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

const putSchema = z.object({
  from_postcode: z.string().max(120).nullable(),
  to_postcode: z.string().max(120).nullable(),
  available_from: z.string().datetime({ offset: true }).nullable(),
  available_to: z.string().datetime({ offset: true }).nullable(),
  vehicle_type: z.string().max(100).nullable(),
  notes: z.string().max(4000).nullable(),
});

function missingStatusColumn(message: string | null | undefined) {
  const value = String(message ?? '').toLowerCase();
  return value.includes('status') && (
    value.includes('column') ||
    value.includes('does not exist') ||
    value.includes('schema cache')
  );
}

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
    .select('id, company_id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError || !driver) {
    return { error: json(403, { error: 'Driver profile required.' }) } as const;
  }

  const status = String(driver.status ?? '').trim().toLowerCase();
  if (['suspended', 'inactive', 'blocked', 'rejected'].includes(status)) {
    return { error: json(403, { error: 'Active driver profile required.' }) } as const;
  }

  return {
    driverId: driver.id as string,
    companyId: driver.company_id as string,
  } as const;
}

async function loadCurrentJourney(driverId: string) {
  const admin = supabaseAdmin!;
  const current = await admin
    .from('return_journeys')
    .select('from_postcode, to_postcode, available_from, available_to, vehicle_type, notes')
    .eq('driver_id', driverId)
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!current.error) return current;
  if (!missingStatusColumn(current.error.message)) return current;

  return admin
    .from('return_journeys')
    .select('from_postcode, to_postcode, available_from, available_to, vehicle_type, notes')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function clearCurrentJourney(driverId: string) {
  const admin = supabaseAdmin!;
  const current = await admin
    .from('return_journeys')
    .delete()
    .eq('driver_id', driverId)
    .eq('status', 'available');

  if (!current.error) return current;
  if (!missingStatusColumn(current.error.message)) return current;

  return admin
    .from('return_journeys')
    .delete()
    .eq('driver_id', driverId);
}

export async function GET(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;

  const { data, error } = await loadCurrentJourney(resolved.driverId);
  if (error) {
    return json(503, { error: 'Your current return journey could not be loaded.' });
  }

  return json(200, { journey: data ?? null });
}

export async function PUT(request: NextRequest) {
  const resolved = await resolveDriver(request);
  if ('error' in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid return journey declaration.' });
  }

  const cleared = await clearCurrentJourney(resolved.driverId);
  if (cleared.error) {
    return json(500, { error: 'The existing return journey could not be replaced safely.' });
  }

  const fromPostcode = parsed.data.from_postcode?.trim() || null;
  if (!fromPostcode) {
    return json(200, { journey: null });
  }

  const admin = supabaseAdmin!;
  const baseInsert = {
    company_id: resolved.companyId,
    driver_id: resolved.driverId,
    from_postcode: fromPostcode,
    to_postcode: parsed.data.to_postcode?.trim() || null,
    available_from: parsed.data.available_from,
    available_to: parsed.data.available_to,
    vehicle_type: parsed.data.vehicle_type?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
  };

  let inserted = await admin
    .from('return_journeys')
    .insert({ ...baseInsert, status: 'available' })
    .select('from_postcode, to_postcode, available_from, available_to, vehicle_type, notes')
    .maybeSingle();

  if (inserted.error && missingStatusColumn(inserted.error.message)) {
    inserted = await admin
      .from('return_journeys')
      .insert(baseInsert)
      .select('from_postcode, to_postcode, available_from, available_to, vehicle_type, notes')
      .maybeSingle();
  }

  if (inserted.error) {
    return json(500, { error: 'The return journey could not be published.' });
  }

  return json(200, { journey: inserted.data ?? null });
}
