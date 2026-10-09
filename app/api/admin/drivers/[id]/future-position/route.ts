import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyFleetOperatorContext, requireCompanyFleetOperator } from '../../../_lib/requireCompanyFleetOperator';

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  futurePosition: z.string().max(160).nullable(),
  futureDate: z.string().datetime({ offset: true }).nullable(),
  futureUntil: z.string().datetime({ offset: true }).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
});

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Future-position administration is unavailable.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid future-position payload.' });

  const operator = await requireCompanyFleetOperator(request, parsed.data.companyId);
  if (!isCompanyFleetOperatorContext(operator)) return operator;

  const { id } = await context.params;
  const driverId = id?.trim();
  if (!driverId) return respond(400, { error: 'Driver id is required.' });

  const position = parsed.data.futurePosition?.trim() || null;
  const futureDate = parsed.data.futureDate;
  const futureUntil = parsed.data.futureUntil;
  const notes = parsed.data.notes?.trim() || null;
  if (futureDate) {
    const timestamp = new Date(futureDate).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      return respond(400, { error: 'Future-position date/time must be in the future.' });
    }
  }
  if (futureUntil) {
    const timestamp = new Date(futureUntil).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      return respond(400, { error: 'Future-position end date/time must be in the future.' });
    }
    if (futureDate && timestamp <= new Date(futureDate).getTime()) {
      return respond(400, { error: 'Future-position end must be after the start.' });
    }
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id,company_id,status,display_name,future_position,future_position_date,future_position_until,future_availability_notes')
    .eq('id', driverId)
    .eq('company_id', operator.companyId)
    .maybeSingle();

  if (driverError) return respond(500, { error: 'Unable to verify the selected driver.' });
  if (!driver) return respond(404, { error: 'The selected driver is not part of this company.' });
  if (String(driver.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(409, { error: 'Future positions can only be published for an active driver.' });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('drivers')
    .update({
      future_position: position,
      future_position_date: futureDate,
      future_position_until: position ? futureUntil : null,
      future_availability_notes: position ? notes : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driverId)
    .eq('company_id', operator.companyId)
    .eq('status', 'active')
    .select('id,display_name,future_position,future_position_date,future_position_until,future_availability_notes,availability_status,status')
    .maybeSingle();

  if (updateError) return respond(503, { error: 'Future position could not be updated.' });
  if (!updated) return respond(409, { error: 'The active driver record could not be updated.' });

  return respond(200, { driver: updated });
}
