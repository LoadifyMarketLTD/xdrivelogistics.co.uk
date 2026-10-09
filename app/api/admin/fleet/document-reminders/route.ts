import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyFleetOperatorContext, requireCompanyFleetOperator } from '../../_lib/requireCompanyFleetOperator';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document reminder service is temporarily unavailable.' });
  }

  const body = await request.json().catch(() => ({})) as { companyId?: string; daysAhead?: number };
  const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  const admin = await requireCompanyFleetOperator(request, companyId);
  if (!isCompanyFleetOperatorContext(admin)) return admin;

  const daysAhead = Number.isFinite(Number(body.daysAhead))
    ? Math.max(1, Math.min(90, Math.floor(Number(body.daysAhead))))
    : 30;

  const { data, error } = await supabaseAdmin.rpc('enqueue_compliance_document_reminders', {
    p_days_ahead: daysAhead,
    p_company_id: admin.companyId,
  });

  if (error) {
    const migrationMissing = error.code === 'PGRST202' || /enqueue_compliance_document_reminders/i.test(error.message);
    return json(migrationMissing ? 503 : 500, {
      error: migrationMissing
        ? 'Compliance document reminder migration is not available yet.'
        : 'Document reminders could not be queued.',
    });
  }

  const queued = Number(data ?? 0);
  return json(200, {
    ok: true,
    queued,
    daysAhead,
    message: queued > 0
      ? queued + ' document reminder notification(s) queued.'
      : 'No new reminders were due. Existing reminders are duplicate-protected for 7 days.',
  });
}
