import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const terminalStatuses = new Set(['delivered', 'completed', 'cancelled']);
const operatorRoles = new Set(['owner', 'admin', 'dispatcher']);
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizeComment = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 2000) : '';

type FeedbackBody = {
  companyId?: unknown;
  rating?: unknown;
  comment?: unknown;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Feedback is temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Your session has expired. Sign in again.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Your session has expired. Sign in again.' });

  let body: FeedbackBody;
  try {
    body = await request.json() as FeedbackBody;
  } catch {
    return json(400, { error: 'Invalid feedback payload.' });
  }

  const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  const rating = Number(body.rating);
  if (!uuidPattern.test(companyId)) return json(400, { error: 'A valid company workspace is required.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json(400, { error: 'Rating must be between 1 and 5.' });
  }

  const { id: jobId } = await context.params;
  if (!uuidPattern.test(jobId)) return json(400, { error: 'A valid booking is required.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company, status')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return json(500, { error: 'We could not verify company access.' });
  if (!membership || !operatorRoles.has(String(membership.role_in_company ?? '').toLowerCase())) {
    return json(403, { error: 'Owner, admin or dispatcher access is required to leave company feedback.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, assigned_company_id, status, current_status')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return json(500, { error: 'We could not verify this booking.' });
  if (!job || job.company_id !== companyId) {
    return json(404, { error: 'Company booking not found.' });
  }

  const status = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
  if (!terminalStatuses.has(status)) {
    return json(409, { error: 'Feedback is available after delivery, completion or cancellation.' });
  }

  const targetCompanyId = job.awarded_carrier_company_id ?? job.assigned_company_id;
  if (!targetCompanyId || targetCompanyId === companyId) {
    return json(409, { error: 'No external carrier is available for feedback on this booking.' });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('job_id', jobId)
    .eq('reviewer_company_id', companyId)
    .maybeSingle();
  if (existingError) return json(500, { error: 'We could not verify existing company feedback.' });

  const payload = {
    company_id: targetCompanyId,
    reviewer_company_id: companyId,
    job_id: jobId,
    reviewer_user_id: authData.user.id,
    reviewed_user_id: null,
    rating,
    comment: normalizeComment(body.comment) || null,
  };

  const mutation = existing?.id
    ? supabaseAdmin.from('reviews').update(payload).eq('id', existing.id)
    : supabaseAdmin.from('reviews').insert(payload);
  const { data: review, error: reviewError } = await mutation
    .select('id, company_id, reviewer_company_id, job_id, reviewer_user_id, rating, comment, created_at')
    .single();
  if (reviewError || !review) return json(500, { error: 'We could not save company feedback.' });

  return json(200, { review, updated: Boolean(existing?.id) });
}
