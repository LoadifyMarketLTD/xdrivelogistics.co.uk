import { NextRequest, NextResponse } from 'next/server';
import { operationalError } from '../../../_lib/operationalError';
import { londonDate, londonMidnight, shiftDate, reportingStart } from './reportingDates';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'private, no-store' } });

const summaryError = (context: string, cause: unknown) => operationalError({ context: 'driver.dashboard.commercial-summary.' + context, message: 'Commercial summary could not be loaded. Please try again.', cause });

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

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
    .select('id, company_id, driver_type, can_commercial_bid')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (driverError) return summaryError('driverError', driverError);
  if (!driver?.company_id) return respond(403, { error: 'Driver company context is unavailable.' });
  if (normalise(driver.driver_type) !== 'owner_driver' || driver.can_commercial_bid !== true) {
    return respond(403, { error: 'Owner Driver commercial access is required.' });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driver.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return summaryError('membershipError', membershipError);

  const role = normalise(membership?.role_in_company);
  if (role !== 'owner') {
    return respond(403, { error: 'Owner Driver company-owner access is required.' });
  }

  const searchParams = new URL(request.url).searchParams;
  const period = searchParams.get('period') ?? 'today';
  if (!['today', '7d', '30d', 'all', 'custom'].includes(period)) {
    return respond(400, { error: 'Unsupported period.' });
  }

  const now = new Date();
  let cutoff = reportingStart(period, now);
  let periodEnd: string | null = null;
  if (period === 'custom') {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) return respond(400, { error: 'Custom period requires from and to dates.' });
    const fromDate = londonMidnight(from);
    const toDate = londonMidnight(shiftDate(to, 1));
    if (!fromDate || !toDate || from >= shiftDate(to, 1)) {
      return respond(400, { error: 'Invalid custom date range.' });
    }
    cutoff = fromDate.toISOString();
    periodEnd = toDate.toISOString();
  }

  let revenueQuery = supabaseAdmin
    .from('invoices')
    .select('id, amount, status, payment_status, due_date, created_at')
    .eq('company_id', driver.company_id)
    .order('id').limit(1000);
  let payableQuery = supabaseAdmin
    .from('invoices')
    .select('id, amount, status, payment_status, due_date, created_at, supplier_company_id')
    .eq('buyer_company_id', driver.company_id)
    .order('id').limit(1000);
  let jobsQuery = supabaseAdmin
    .from('jobs')
    .select('id, awarded_carrier_company_id, created_at')
    .eq('company_id', driver.company_id)
    .order('id').limit(1000);

  if (cutoff) {
    revenueQuery = revenueQuery.gte('created_at', cutoff);
    payableQuery = payableQuery.gte('created_at', cutoff);
    jobsQuery = jobsQuery.gte('created_at', cutoff);
  }
  if (periodEnd) {
    revenueQuery = revenueQuery.lt('created_at', periodEnd);
    payableQuery = payableQuery.lt('created_at', periodEnd);
    jobsQuery = jobsQuery.lt('created_at', periodEnd);
  }

  const feedbackCutoff = new Date(now);
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
      .order('id').limit(1000),
    supabaseAdmin
      .from('reviews')
      .select('id, rating, created_at')
      .eq('reviewer_company_id', driver.company_id)
      .gte('created_at', feedbackCutoff.toISOString())
      .order('id').limit(1000),
  ]);

  if (revenueResult.error) return summaryError('revenueResult.error', revenueResult.error);
  if (payableResult.error) return summaryError('payableResult.error', payableResult.error);
  if (jobsResult.error) return summaryError('jobsResult.error', jobsResult.error);
  if (receivedFeedbackResult.error) return summaryError('receivedFeedbackResult.error', receivedFeedbackResult.error);
  if (givenFeedbackResult.error) return summaryError('givenFeedbackResult.error', givenFeedbackResult.error);

  // Never present potentially truncated results as authoritative financial totals.
  if ([revenueResult, payableResult, jobsResult, receivedFeedbackResult, givenFeedbackResult].some(result => (result.data?.length ?? 0) >= 1000)) {
    return respond(503, { error: 'The selected reporting period exceeds the current summary capacity. Choose a shorter period or contact support.' });
  }

  const cancelled = new Set(['cancelled', 'canceled', 'void']);
  const revenueRows = (revenueResult.data ?? []).filter((row) => !cancelled.has(normalise(row.status)));
  const payableRows = (payableResult.data ?? []).filter((row) =>
    row.supplier_company_id
    && row.supplier_company_id !== driver.company_id
    && !cancelled.has(normalise(row.status)),
  );

  const today = londonDate(now);

  const isSettled = (row: { status?: unknown; payment_status?: unknown }) =>
    normalise(row.status) === 'paid' || normalise(row.payment_status) === 'paid';

  const isOverdue = (row: { due_date?: string | null; status?: unknown; payment_status?: unknown }) => {
    if (isSettled(row) || !row.due_date) return false;
    const due = row.due_date.slice(0, 10);
    return londonMidnight(due) !== null && due < today;
  };

  const revenueGross = revenueRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const subcontractSpend = payableRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const awaitingPayment = payableRows.filter((row) => !isSettled(row)).length;
  const dueForPayment = payableRows.filter(isOverdue).length;

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
      dueForPayment,
      awaitingPayment,
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
