import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyFleetOperatorContext, requireCompanyFleetOperator } from '../../../_lib/requireCompanyFleetOperator';

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  notifyWhenTracked: z.boolean(),
});

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Vehicle tracking preferences are unavailable.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid tracking-preference payload.' });

  const operator = await requireCompanyFleetOperator(request, parsed.data.companyId);
  if (!isCompanyFleetOperatorContext(operator)) return operator;

  const { id } = await context.params;
  const vehicleId = id?.trim();
  if (!vehicleId) return respond(400, { error: 'Vehicle id is required.' });

  const { data: vehicle, error: lookupError } = await supabaseAdmin
    .from('vehicles')
    .select('id,company_id,notify_when_tracked')
    .eq('id', vehicleId)
    .eq('company_id', operator.companyId)
    .maybeSingle();
  if (lookupError) return respond(500, { error: 'Unable to verify the selected vehicle.' });
  if (!vehicle) return respond(404, { error: 'The selected vehicle is not part of this company.' });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('vehicles')
    .update({ notify_when_tracked: parsed.data.notifyWhenTracked, updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
    .eq('company_id', operator.companyId)
    .select('id,notify_when_tracked')
    .maybeSingle();
  if (updateError) return respond(503, { error: 'Tracking notification preference could not be updated.' });
  if (!updated) return respond(409, { error: 'Vehicle tracking preference could not be updated.' });

  return respond(200, { vehicle: updated });
}
