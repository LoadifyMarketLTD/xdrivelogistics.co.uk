import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

const periodStart = (period: string) => {
  const now = new Date();
  if (period === 'today') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (period === '7d') {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (period === '30d') {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (driverError) return respond(500, { error: driverError.message });
  if (!driver?.company_id) return respond(403, { error: 'Driver company context is unavailable.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driver.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });

  const role = normalise(membership?.role_in_company);
  if (role !== 'owner' && role !== 'admin') {
    return respond(403, { error: 'Owner-driver or company admin access is required.' });
  }

  const period = new URL(request.url).searchParams.get('period') ?? '30d';
  if (!['today', '7d', '30d', 'all'].includes(period)) {
    return respond(400, { error: 'Unsupported period.' });
  }
  const cutoff = periodStart(period);

  let revenueQuery = supabaseAdmin
    .from('invoices')
    .select('id, amount, status, payment_status, due_date, created_at')
    .eq('company_id', driver.company_id)
    .limit(1000);
  let payableQuery = supabaseAdmin
    .from('invoices')
    .select('id, amount, status, payment_status, due_date, created_at, supplier_company_id')
    .eq('buyer_company_id', driver.company_id)
    .limit(1000);
  let jobsQuery = supabaseAdmin
    .from('jobs')
    .select('id, awarded_carrier_company_id, created_at')
    .eq('company_id', driver.company_id)
    .limit(1000);

  if (cutoff) {
    revenueQuery = revenueQuery.gte('created_at', cutoff);
    payableQuery = payableQuery.gte('created_at', cutoff);
    jobsQuery = jobsQuery.gte('created_at', cutoff);
  }

  const feedbackCutoff = new Date();
  feedbackCutoff.setDate(feedbackCutoff.getDate() - 90);

  const [revenueResult, payableResult, jobsResult, receivedFeedbackResult, givenFeedbackResult] = await Promise.all([
    revenueQuery,
    payableQuery,
    jobsQuery,
    supabaseAdmin
      .from('reviews')
      .select('id, rating, created_at')
      .eq('company_id', driver.company_id)
      .gte('created_at', feedbackCutoff.toISOString())
      .limit(1000),
    supabaseAdmin
      .from('reviews')
      .select('id, rating, created_at')
      .eq('reviewer_company_id', driver.company_id)
      .gte('created_at', feedbackCutoff.toISOString())
      .limit(1000),
  ]);

  if (revenueResult.error) return respond(500, { error: revenueResult.error.message });
  if (payableResult.error) return respond(500, { error: payableResult.error.message });
  if (jobsResult.error) return respond(500, { error: jobsResult.error.message });
  if (receivedFeedbackResult.error) return respond(500, { error: receivedFeedbackResult.error.message });
  if (givenFeedbackResult.error) return respond(500, { error: givenFeedbackResult.error.message });

  const cancelled = new Set(['cancelled', 'canceled', 'void']);
  const revenueRows = (revenueResult.data ?? []).filter((row) => !cancelled.has(normalise(row.status)));
  const payableRows = (payableResult.data ?? []).filter((row) =>
    row.supplier_company_id
    && row.supplier_company_id !== driver.company_id
    && !cancelled.has(normalise(row.status)),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSettled = (row: { status?: unknown; payment_status?: unknown }) =>
    normalise(row.status) === 'paid' || normalise(row.payment_status) === 'paid';

  const isOverdue = (row: { due_date?: string | null; status?: unknown; payment_status?: unknown }) => {
    if (isSettled(row) || !row.due_date) return false;
    const due = new Date(row.due_date);
    return Number.isFinite(due.getTime()) && due.getTime() < today.getTime();
  };

  const revenueGross = revenueRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const subcontractSpend = payableRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const awaitingSettlement = payableRows.filter((row) => !isSettled(row)).length;
  const overduePayables = payableRows.filter(isOverdue).length;

  const subcontractedBookings = (jobsResult.data ?? []).filter((row) =>
    row.awarded_carrier_company_id && row.awarded_carrier_company_id !== driver.company_id,
  ).length;

  const receivedFeedback = receivedFeedbackResult.data ?? [];
  const givenFeedback = givenFeedbackResult.data ?? [];
  const receivedRatingAverage = receivedFeedback.length
    ? receivedFeedback.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) / receivedFeedback.length
    : null;

  return respond(200, {
    period,
    revenueGross,
    subcontractSpend,
    recordedGrossMargin: revenueGross - subcontractSpend,
    accountsPayable: {
      received: payableRows.length,
      awaitingSettlement,
      overdue: overduePayables,
      totalGross: subcontractSpend,
    },
    bookingsSubcontracted: subcontractedBookings,
    feedback90Days: {
      received: receivedFeedback.length,
      given: givenFeedback.length,
      receivedRatingAverage,
    },
  });
}
