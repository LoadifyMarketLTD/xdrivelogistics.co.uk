import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const bodySchema = z.object({
  carrierCompanyId: z.string().uuid(),
});

type JobRow = {
  id: string;
  company_id: string;
  created_by: string | null;
  status: string | null;
  current_status: string | null;
  exchange_visibility: string | null;
  awarded_carrier_company_id: string | null;
};

const companyStatus = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0]?.status ?? '').trim().toLowerCase();
  if (value && typeof value === 'object') {
    return String((value as { status?: unknown }).status ?? '').trim().toLowerCase();
  }
  return '';
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'A valid carrier company is required.' });

  const { id: jobId } = await params;
  const { data: rawJob, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, created_by, status, current_status, exchange_visibility, awarded_carrier_company_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!rawJob) return respond(404, { error: 'Job not found.' });

  const job = rawJob as JobRow;
  if (job.awarded_carrier_company_id) {
    return respond(409, { error: 'This job has already been awarded and cannot be directly invited.' });
  }
  if (job.exchange_visibility && job.exchange_visibility !== 'private') {
    return respond(409, { error: 'Direct Invite is only available for private, unawarded jobs.' });
  }
  if (parsed.data.carrierCompanyId === job.company_id) {
    return respond(400, { error: 'You cannot directly invite your own company.' });
  }

  const [membershipResult, profileResult, carrierResult] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status, companies!inner(status)')
      .eq('company_id', job.company_id)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('companies')
      .select('id, status')
      .eq('id', parsed.data.carrierCompanyId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (membershipResult.error) return respond(500, { error: membershipResult.error.message });
  if (profileResult.error) return respond(500, { error: profileResult.error.message });
  if (carrierResult.error) return respond(500, { error: carrierResult.error.message });
  if (!carrierResult.data) return respond(404, { error: 'Active carrier company not found.' });

  const membership = membershipResult.data;
  const role = String(membership?.role_in_company ?? '').trim().toLowerCase();
  const profileRole = String(profileResult.data?.role ?? '').trim().toLowerCase();
  const activeCompany = companyStatus(membership?.companies) === 'active';
  const operatorRole = ['owner', 'admin', 'dispatcher', 'member'].includes(role);
  const operator = Boolean(membership) && activeCompany && profileRole !== 'driver' && operatorRole;
  const admin = operator && ['owner', 'admin'].includes(role);
  const creatorOrAdmin = operator && (job.created_by === authData.user.id || admin);

  if (!creatorOrAdmin) {
    return respond(403, {
      error: 'Only the job creator or a Company Owner/Admin can send a direct carrier invitation.',
    });
  }

  const currentStatus = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    exchange_visibility: 'direct',
    direct_invite_company_id: parsed.data.carrierCompanyId,
    exchange_posted_at: now,
    awarded_carrier_company_id: null,
    updated_at: now,
  };
  if (currentStatus === 'draft') {
    update.status = 'posted';
    update.current_status = 'posted';
    update.status_updated_at = now;
  }

  let updateQuery = supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', jobId)
    .eq('company_id', job.company_id)
    .is('awarded_carrier_company_id', null)
    .or('exchange_visibility.is.null,exchange_visibility.eq.private');
  updateQuery = job.status === null
    ? updateQuery.is('status', null)
    : updateQuery.eq('status', job.status);
  updateQuery = job.current_status === null
    ? updateQuery.is('current_status', null)
    : updateQuery.eq('current_status', job.current_status);

  const { data: updated, error: updateError } = await updateQuery
    .select('id, status, current_status, exchange_visibility, direct_invite_company_id, updated_at')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) {
    return respond(409, {
      error: 'The job changed while the invitation was being sent. Refresh and retry.',
    });
  }

  return respond(200, { success: true, job: updated });
}
