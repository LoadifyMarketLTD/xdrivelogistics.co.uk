import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../mobile/_lib';

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
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return { error: context } as const;
  return {
    driverId: context.driverId,
    companyId: context.companyId,
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
