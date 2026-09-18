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
    return json(503, { error: 'Driver administration service is unavailable.' });
  }

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await context.params;
  const driverId = id?.trim();
  if (!driverId) return json(400, { error: 'Driver id is required.' });

  const { data: driver, error: lookupError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, display_name, status, is_active')
    .eq('id', driverId)
    .eq('company_id', admin.companyId)
    .maybeSingle();
  if (lookupError) return json(500, { error: 'Unable to verify Driver ownership.' });
  if (!driver) return json(404, { error: 'Driver not found for this company.' });

  if (String(driver.status ?? '').toLowerCase() === 'active' || driver.is_active === true) {
    return json(409, {
      error: 'Active Drivers cannot be hard deleted. Deactivate the Driver first so operational history remains protected.',
      code: 'driver_must_be_inactive_before_delete',
    });
  }

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from('drivers')
    .delete()
    .eq('id', driverId)
    .eq('company_id', admin.companyId)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    return json(409, {
      error: 'Driver cannot be removed because operational or compliance records still reference it. Keep the Driver inactive instead.',
      code: deleteError.code ?? 'driver_delete_conflict',
    });
  }
  if (!deleted) return json(404, { error: 'Driver no longer exists.' });

  return json(200, { ok: true, driverId });
}
