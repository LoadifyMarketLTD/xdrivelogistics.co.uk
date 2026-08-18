import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../_lib/webDriverContext';

const MAX_JOB_IDS = 250;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

function uniqueJobIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map((entry) => typeof entry === 'string' ? entry.trim() : '').filter(Boolean))];
  if (ids.length > MAX_JOB_IDS || ids.some((id) => !UUID_PATTERN.test(id))) return null;
  return ids;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Diary detail services are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { jobIds?: unknown } | null;
  const requestedJobIds = uniqueJobIds(body?.jobIds);
  if (!requestedJobIds) {
    return json(400, { error: `jobIds must contain at most ${MAX_JOB_IDS} valid job identifiers.` });
  }
  if (requestedJobIds.length === 0) {
    return json(200, { reviews: [], documents: [], events: [], unavailable: [] });
  }

  // Never trust job ids supplied by the browser. Intersect them with the
  // authenticated driver's actual assignments before any service-role detail read.
  const { data: assignedJobs, error: assignedJobsError } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('assigned_driver_id', driver.driverId)
    .in('id', requestedJobIds)
    .limit(MAX_JOB_IDS);

  if (assignedJobsError) {
    return json(500, { error: 'Diary assignments could not be verified.' });
  }

  const authorisedJobIds = (assignedJobs ?? [])
    .map((row) => typeof row.id === 'string' ? row.id : '')
    .filter(Boolean);
  if (authorisedJobIds.length === 0) {
    return json(200, { reviews: [], documents: [], events: [], unavailable: [] });
  }

  const [reviewsResult, documentsResult, eventsResult] = await Promise.all([
    supabaseAdmin
      .from('reviews')
      .select('id, job_id, rating, comment, created_at')
      .in('job_id', authorisedJobIds)
      .eq('reviewed_user_id', driver.userId)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from('job_documents')
      .select('id, job_id, file_name, file_type, file_url, uploaded_at')
      .in('job_id', authorisedJobIds)
      .order('uploaded_at', { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from('job_tracking_events')
      .select('id, job_id, event_type, event_time, user_name, notes, message')
      .in('job_id', authorisedJobIds)
      .order('event_time', { ascending: false })
      .limit(1000),
  ]);

  const unavailable: string[] = [];
  if (reviewsResult.error) unavailable.push('feedback');
  if (documentsResult.error) unavailable.push('documents');
  if (eventsResult.error) unavailable.push('history');

  return json(200, {
    reviews: reviewsResult.error ? [] : (reviewsResult.data ?? []),
    documents: documentsResult.error ? [] : (documentsResult.data ?? []),
    events: eventsResult.error ? [] : (eventsResult.data ?? []),
    unavailable,
  });
}
