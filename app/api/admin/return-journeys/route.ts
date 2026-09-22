import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../_lib/requireCompanyAdmin';

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  driverId: z.string().uuid(),
  fromPostcode: z.string().max(120).nullable(),
  toPostcode: z.string().max(120).nullable(),
  availableFrom: z.string().datetime({ offset: true }).nullable(),
  availableTo: z.string().datetime({ offset: true }).nullable(),
  vehicleType: z.string().max(100).nullable(),
  notes: z.string().max(4000).nullable(),
});

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid return journey payload.' });
  }

  const context = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(context)) return context;

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('id', parsed.data.driverId)
    .eq('company_id', context.companyId)
    .limit(1)
    .maybeSingle();

  if (driverError) {
    return respond(500, { error: 'Unable to verify the selected driver.' });
  }
  if (!driver) {
    return respond(404, { error: 'The selected driver is not part of this company.' });
  }
  if (String(driver.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(409, { error: 'Return journeys can only be published for an active driver.' });
  }

  const fromPostcode = parsed.data.fromPostcode?.trim().toUpperCase() || null;
  const toPostcode = parsed.data.toPostcode?.trim().toUpperCase() || null;
  const vehicleType = parsed.data.vehicleType?.trim() || null;
  const notes = parsed.data.notes?.trim() || null;

  const { error } = await supabaseAdmin.rpc('replace_driver_return_journey_canonical', {
    p_driver_id: parsed.data.driverId,
    p_company_id: context.companyId,
    p_from_postcode: fromPostcode,
    p_to_postcode: toPostcode,
    p_available_from: parsed.data.availableFrom,
    p_available_to: parsed.data.availableTo,
    p_vehicle_type: vehicleType,
    p_notes: notes,
  });

  if (error) {
    if (error.code === '22023') return respond(400, { error: error.message });
    if (error.code === '42501') return respond(403, { error: 'Return journey company binding is not authorised.' });
    return respond(503, { error: 'The return journey could not be updated.' });
  }

  return respond(200, {
    success: true,
    journey: fromPostcode
      ? {
          driver_id: parsed.data.driverId,
          company_id: context.companyId,
          from_postcode: fromPostcode,
          to_postcode: toPostcode,
          available_from: parsed.data.availableFrom,
          available_to: parsed.data.availableTo,
          vehicle_type: vehicleType,
          notes,
          status: 'available',
        }
      : null,
  });
}
