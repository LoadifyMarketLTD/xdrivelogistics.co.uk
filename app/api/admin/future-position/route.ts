import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../_lib/requireCompanyAdmin';

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  driverId: z.string().uuid(),
  futurePosition: z.string().trim().max(120).nullable(),
  futurePositionDate: z.string().datetime({ offset: true }).nullable(),
});

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function PUT(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid future position payload.' });

  const context = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(context)) return context;

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('id', parsed.data.driverId)
    .eq('company_id', context.companyId)
    .limit(1)
    .maybeSingle();

  if (driverError) return respond(500, { error: 'Unable to verify the selected driver.' });
  if (!driver) return respond(404, { error: 'The selected driver is not part of this company.' });
  if (String(driver.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(409, { error: 'Future positions can only be published for an active driver.' });
  }

  const futurePosition = parsed.data.futurePosition?.trim() || null;
  const futurePositionDate = futurePosition ? parsed.data.futurePositionDate : null;

  const { error: updateError } = await supabaseAdmin
    .from('drivers')
    .update({
      future_position: futurePosition,
      future_position_date: futurePositionDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.driverId)
    .eq('company_id', context.companyId);

  if (updateError) return respond(503, { error: 'Future position could not be updated.' });

  return respond(200, {
    success: true,
    futurePosition: {
      driverId: parsed.data.driverId,
      futurePosition,
      futurePositionDate,
    },
  });
}
