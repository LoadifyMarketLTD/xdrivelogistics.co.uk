import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getFeatureFlags, getGlobalSettingNumber } from '../../../../_lib/platformFlags';
import { supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../../_lib/requireCompanyAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('publish'), companyId: z.string().uuid() }),
  z.object({
    action: z.literal('direct_invite'),
    companyId: z.string().uuid(),
    carrierCompanyId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('cancel'),
    companyId: z.string().uuid(),
    reason: z.string().trim().min(5).max(1000).optional(),
  }),
]);

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const rpcErrorResponse = (error: { code?: string | null; message?: string | null }) => {
  if (error.code === 'P0002') return respond(404, { error: error.message ?? 'Job not found.' });
  if (error.code === '42501') return respond(403, { error: error.message ?? 'Forbidden.' });
  if (error.code === '23514' || error.code === '23503' || error.code === '23505') {
    return respond(409, { error: error.message ?? 'The requested job action is not allowed.' });
  }
  return respond(500, { error: error.message ?? 'The job action could not be completed.' });
};

async function publicationSettings() {
  const flags = await getFeatureFlags(supabaseAdmin!, ['exchange_marketplace']);
  if (!flags.get('exchange_marketplace')) {
    return { response: respond(503, { error: 'The exchange marketplace is currently disabled.' }) };
  }
  const expireHours = await getGlobalSettingNumber(supabaseAdmin!, 'exchange_auto_expire_hours');
  return { expireHours: Number.isFinite(expireHours) && expireHours > 0 ? expireHours : 72 };
}

const historyWith = (raw: unknown, status: string, actorUserId: string, note: string) => {
  const history = Array.isArray(raw) ? raw : [];
  return [...history, {
    status,
    label: status.replaceAll('_', ' '),
    timestamp: new Date().toISOString(),
    actor_user_id: actorUserId,
    source: 'admin_jobs_manage_api',
    note,
  }];
};
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseAdmin) return respond(503, { error: 'Job management is temporarily unavailable.' });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid job management request.' });

  const admin = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, status, current_status, exchange_visibility, direct_invite_company_id, awarded_carrier_company_id, assigned_company_id, assigned_driver_id, vehicle_id, status_history')
    .eq('id', id)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'The job could not be loaded.' });
  if (!job) return respond(404, { error: 'Job not found.' });
  if (String(job.company_id) !== admin.companyId) {
    return respond(403, { error: 'Only the load-owning company can manage this job.' });
  }

  const status = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
  const assigned = Boolean(
    job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id || job.vehicle_id,
  );
  if (parsed.data.action === 'cancel') {
    const reason = parsed.data.reason ?? 'Cancellation requested from the company Jobs workspace.';
    const rpcName = assigned
      ? 'request_awarded_job_cancellation_atomic'
      : 'cancel_unassigned_exchange_job_atomic';
    const args = assigned
      ? { p_job_id: id, p_actor_user_id: admin.userId, p_reason: reason }
      : { p_job_id: id, p_actor_user_id: admin.userId, p_reason: reason };
    const result = await supabaseAdmin.rpc(rpcName, args);
    if (result.error) return rpcErrorResponse(result.error);
    return respond(assigned ? 202 : 200, {
      success: true,
      cancellationRequested: assigned,
      result: result.data,
    });
  }

  if (assigned) {
    return respond(409, { error: 'Awarded or assigned jobs cannot be republished or directly invited.' });
  }
  if (!['draft', 'posted'].includes(status)) {
    return respond(409, { error: `Jobs in ${status || 'this'} status cannot be published.` });
  }

  const settings = await publicationSettings();
  if (settings.response) return settings.response;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + settings.expireHours! * 60 * 60 * 1000).toISOString();
  let visibility = 'exchange';
  let directInviteCompanyId: string | null = null;
  let note = 'Published to the exchange marketplace.';

  if (parsed.data.action === 'direct_invite') {
    if (parsed.data.carrierCompanyId === admin.companyId) {
      return respond(400, { error: 'A company cannot send a Direct Booking to itself.' });
    }
    if (job.exchange_visibility && job.exchange_visibility !== 'private') {
      return respond(409, { error: 'Only private jobs can be converted to a Direct Booking.' });
    }
    const { data: carrier, error: carrierError } = await supabaseAdmin
      .from('companies')
      .select('id, status')
      .eq('id', parsed.data.carrierCompanyId)
      .maybeSingle();
    if (carrierError) return respond(500, { error: 'The selected carrier could not be verified.' });
    if (!carrier || String(carrier.status).toLowerCase() !== 'active') {
      return respond(409, { error: 'The selected Direct Booking carrier is not active.' });
    }
    visibility = 'direct';
    directInviteCompanyId = String(carrier.id);
    note = 'Published as a Direct Booking to the selected carrier.';
  }

  const nextHistory = historyWith(job.status_history, 'posted', admin.userId, note);
  const update = await supabaseAdmin
    .from('jobs')
    .update({
      status: 'posted',
      current_status: 'posted',
      exchange_visibility: visibility,
      direct_invite_company_id: directInviteCompanyId,
      exchange_posted_at: now,
      exchange_expires_at: expiresAt,
      status_history: nextHistory,
      status_updated_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('company_id', admin.companyId)
    .eq('status', job.status)
    .select('id, status, current_status, exchange_visibility, direct_invite_company_id, exchange_posted_at, exchange_expires_at')
    .maybeSingle();

  if (update.error) return respond(500, { error: update.error.message });
  if (!update.data) {
    return respond(409, { error: 'The job changed while the action was being saved. Refresh and retry.' });
  }

  return respond(200, { success: true, job: update.data });
}
