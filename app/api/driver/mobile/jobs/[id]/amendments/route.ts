import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

async function requireAssignedJob(jobId: string, driverId: string) {
  return supabaseAdmin!
    .from('jobs')
    .select('id,assigned_driver_id,awarded_carrier_company_id,assigned_company_id,status,current_status')
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .maybeSingle();
}

const amendmentSelect = 'id,agreement_id,job_id,version_number,proposed_by_company_id,counterparty_company_id,reason,change_summary,effective_agreed_amount,currency,payment_terms,pod_required,effective_job_snapshot,status,proposed_at,decided_at,decision_note,created_at' as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;

  const { data: job, error: jobError } = await requireAssignedJob(id, driver.driverId);
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const { data, error } = await supabaseAdmin
    .from('job_commercial_agreement_amendments')
    .select(amendmentSelect)
    .eq('job_id', id)
    .order('version_number', { ascending: false })
    .limit(20);

  if (error) return respond(500, { error: error.message });
  const amendments = (data ?? []).filter((row) =>
    String(row.counterparty_company_id ?? '') === String(driver.companyId ?? job.awarded_carrier_company_id ?? job.assigned_company_id ?? '')
    || String(row.proposed_by_company_id ?? '') === String(driver.companyId ?? '')
  );
  return respond(200, { ok: true, amendments });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const amendmentId = String(body.amendmentId ?? '').trim();
  const action = String(body.action ?? '').trim().toLowerCase();
  const note = String(body.note ?? '').trim().slice(0, 2000);
  if (!amendmentId) return respond(400, { error: 'amendmentId is required.' });
  if (!['accept', 'reject'].includes(action)) return respond(400, { error: 'Action must be accept or reject.' });

  const { data: job, error: jobError } = await requireAssignedJob(id, driver.driverId);
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const { data: amendment, error: amendmentError } = await supabaseAdmin
    .from('job_commercial_agreement_amendments')
    .select(amendmentSelect)
    .eq('id', amendmentId)
    .eq('job_id', id)
    .maybeSingle();
  if (amendmentError) return respond(500, { error: amendmentError.message });
  if (!amendment) return respond(404, { error: 'Commercial amendment not found.' });
  if (String(amendment.status) !== 'proposed') return respond(409, { error: 'This amendment has already been decided.' });
  const executionCompanyId = String(
    job.awarded_carrier_company_id ?? job.assigned_company_id ?? driver.companyId ?? '',
  );
  if (!executionCompanyId || String(amendment.counterparty_company_id ?? '') !== executionCompanyId) {
    return respond(403, { error: 'This amendment is not awaiting a decision from your execution company.' });
  }

  const nextStatus = action === 'accept' ? 'accepted' : 'rejected';
  const now = new Date().toISOString();
  const { data: decided, error } = await supabaseAdmin
    .from('job_commercial_agreement_amendments')
    .update({
      status: nextStatus,
      decided_by_user_id: driver.userId,
      decided_by_company_id: executionCompanyId,
      decision_note: note || null,
      decided_at: now,
    })
    .eq('id', amendmentId)
    .eq('status', 'proposed')
    .select(amendmentSelect)
    .maybeSingle();

  if (error) return respond(409, { error: error.message });
  if (!decided) return respond(409, { error: 'The amendment changed before your decision was recorded. Refresh and retry.' });
  await insertTrackingEvent(
    id,
    driver.userId,
    'note',
    'Commercial amendment v' + String(decided.version_number ?? '?') + ' ' + nextStatus + ' by assigned driver.',
  );
  return respond(200, { ok: true, amendment: decided });
}
