import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../_lib/requireCompanyAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Vehicle administration service is unavailable.' });
  }

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await context.params;
  const vehicleId = id?.trim();
  if (!vehicleId) return json(400, { error: 'Vehicle id is required.' });

  const { data: vehicle, error: lookupError } = await supabaseAdmin
    .from('vehicles')
    .select('id, company_id, assigned_driver_id, reg_plate, registration')
    .eq('id', vehicleId)
    .eq('company_id', admin.companyId)
    .maybeSingle();
  if (lookupError) return json(500, { error: 'Unable to verify Vehicle ownership.' });
  if (!vehicle) return json(404, { error: 'Vehicle not found for this company.' });

  if (vehicle.assigned_driver_id) {
    return json(409, {
      error: 'Assigned Vehicles cannot be deleted. Unassign the Driver first so Fleet readiness remains consistent.',
      code: 'vehicle_must_be_unassigned_before_delete',
    });
  }

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)
    .eq('company_id', admin.companyId)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    return json(409, {
      error: 'Vehicle cannot be deleted because operational or compliance history still references it.',
      code: deleteError.code ?? 'vehicle_delete_conflict',
    });
  }
  if (!deleted) return json(404, { error: 'Vehicle no longer exists.' });

  return json(200, { ok: true, vehicleId });
}
