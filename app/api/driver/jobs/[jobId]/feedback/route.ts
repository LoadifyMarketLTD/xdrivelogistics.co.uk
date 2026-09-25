import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../../_lib/webDriverContext';

const terminalStatuses = new Set(['delivered', 'completed', 'cancelled']);
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type FeedbackBody = {
  rating?: unknown;
  comment?: unknown;
};

const normalizeComment = (value: unknown) => {
  const comment = typeof value === 'string' ? value.trim() : '';
  return comment.slice(0, 2000);
};
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Feedback is temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { jobId } = await context.params;
  let body: FeedbackBody;
  try {
    body = await request.json() as FeedbackBody;
  } catch {
    return json(400, { error: 'Invalid feedback payload.' });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json(400, { error: 'Rating must be between 1 and 5.' });
  }
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, assigned_driver_id, status, current_status')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return json(500, { error: 'We could not verify this booking.' });
  if (!job || job.assigned_driver_id !== driver.driverId) {
    return json(404, { error: 'Assigned booking not found.' });
  }

  const status = String(job.current_status ?? job.status ?? '').trim().toLowerCase();
  if (!terminalStatuses.has(status)) {
    return json(409, { error: 'Feedback is available after delivery, completion or cancellation.' });
  }
  if (!job.company_id) {
    return json(409, { error: 'The posting company is not available for this booking.' });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('job_id', jobId)
    .eq('reviewer_user_id', driver.userId)
    .maybeSingle();
  if (existingError) return json(500, { error: 'We could not verify existing feedback.' });

  const payload = {
    company_id: job.company_id,
    job_id: jobId,
    reviewer_user_id: driver.userId,
    reviewer_company_id: driver.companyId,
    reviewed_user_id: null,
    rating,
    comment: normalizeComment(body.comment) || null,
  };

  const mutation = existing?.id
    ? supabaseAdmin.from('reviews').update(payload).eq('id', existing.id).select('id, job_id, reviewer_user_id, rating, comment, created_at').single()
    : supabaseAdmin.from('reviews').insert(payload).select('id, job_id, reviewer_user_id, rating, comment, created_at').single();

  const { data: review, error: reviewError } = await mutation;
  if (reviewError || !review) {
    return json(500, { error: 'We could not save your feedback.' });
  }

  return json(200, { review, updated: Boolean(existing?.id) });
}
