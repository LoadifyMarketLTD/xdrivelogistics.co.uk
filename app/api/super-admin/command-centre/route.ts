/**
 * GET /api/super-admin/command-centre
 *
 * Returns the Command Centre data payload:
 *  - environment banner (PRODUCTION / STAGING / DEVELOPMENT)
 *  - 5 attention indicators (P0/P1 incidents, jobs at risk, blocked accounts,
 *    financial exposure, degraded services); each indicator carries its own
 *    `label` field — consumers must use that label rather than hard-coding copy.
 *  - Derived Action Queue: computed on-demand from current source tables.
 *    This is NOT a persistent incident/case registry. Items are re-derived on
 *    every request from whichever source tables are currently available.
 *    `actionQueue.derived === true` signals this contract to consumers.
 *  - `refreshedAt`: timestamp of this snapshot. No push/polling is provided.
 *
 * Active Platform Owner required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { resolveEnvironment } from '../_lib/envDetection';
import { runPlatformHealthChecks } from '../_lib/platformHealth';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const SEVERITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const PREVIEW_LIMIT = 50;
const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);

type ActionQueueItem = {
  id: string;
  type: string;
  severity: 'P0' | 'P1' | 'P2';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  entityName: string;
  detectedAt: string;
  ageMinutes: number;
  href: string;
};

const ageMinutes = (isoDate: string): number => {
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(ms / 60000));
};

/** Positive = past (age). Negative = future (time remaining). Used for expiry-date events. */
const ageMinutesUnclamped = (isoDate: string): number => {
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.floor(ms / 60000);
};

const isTableMissing = (err: { code?: string; message?: string } | null | undefined): boolean =>
  Boolean(err?.code && TABLE_MISSING_CODES.has(err.code));

const exactCount = (result: { count: number | null; error: { message: string } | null }) =>
  result.error || result.count === null ? null : result.count;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  if (!(await verifyPlatformOwner(request))) {
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoDaysAhead = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFiveDaysAgo = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayDate = now.toISOString().slice(0, 10);

  const [
    companiesPendingPreviewResult,
    companiesPendingCountResult,
    companiesSuspendedCountResult,
    jobsAtRiskPreviewResult,
    jobsAtRiskCountResult,
    jobsAtRiskP0CountResult,
    jobsWithoutDriverPreviewResult,
    jobsWithoutDriverCountResult,
    docsExpiringSoonPreviewResult,
    docsExpiringSoonCountResult,
    docsExpiringSoonP1CountResult,
    docsExpiredPreviewResult,
    docsExpiredCountResult,
    fraudCasesPreviewResult,
    fraudCasesCountResult,
    fraudCasesP0CountResult,
    invoicesOverduePreviewResult,
    invoicesOverdueCountResult,
    invoicesOverdueP1CountResult,
    supportTicketsCriticalPreviewResult,
    supportTicketsCriticalCountResult,
    supportTicketsCriticalP0CountResult,
    gdprRequestsPreviewResult,
    gdprRequestsCountResult,
    gdprRequestsP0CountResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('companies')
      .select('id, name, created_at')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    supabaseAdmin
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'suspended'),
    supabaseAdmin
      .from('jobs')
      .select('id, status, pickup_location, delivery_location, updated_at, created_at')
      .in('status', ['allocated', 'collected', 'in_transit'])
      .lt('updated_at', twoHoursAgo)
      .order('updated_at', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['allocated', 'collected', 'in_transit'])
      .lt('updated_at', twoHoursAgo),
    supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['allocated', 'collected', 'in_transit'])
      .lt('updated_at', fourHoursAgo),
    supabaseAdmin
      .from('jobs')
      .select('id, status, pickup_location, delivery_location, created_at')
      .in('status', ['awarded', 'allocated'])
      .is('assigned_driver_id', null)
      .lt('updated_at', oneHourAgo)
      .order('created_at', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['awarded', 'allocated'])
      .is('assigned_driver_id', null)
      .lt('updated_at', oneHourAgo),
    supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, doc_type, expiry_date')
      .eq('status', 'approved')
      .gte('expiry_date', now.toISOString())
      .lte('expiry_date', sevenDaysAhead)
      .order('expiry_date', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('driver_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('expiry_date', now.toISOString())
      .lte('expiry_date', sevenDaysAhead),
    supabaseAdmin
      .from('driver_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('expiry_date', now.toISOString())
      .lte('expiry_date', twoDaysAhead),
    supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, doc_type, expiry_date')
      .eq('status', 'approved')
      .lt('expiry_date', now.toISOString())
      .order('expiry_date', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('driver_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lt('expiry_date', now.toISOString()),
    supabaseAdmin
      .from('fraud_review_cases')
      .select('id, subject_company_id, status, created_at')
      .in('status', ['open', 'investigating'])
      .order('created_at', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('fraud_review_cases')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'investigating']),
    supabaseAdmin
      .from('fraud_review_cases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'investigating'),
    supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, amount, currency, due_date, created_at')
      .eq('payment_status', 'unpaid')
      .not('status', 'eq', 'void')
      .not('due_date', 'is', null)
      .lt('due_date', todayDate)
      .order('due_date', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'unpaid')
      .not('status', 'eq', 'void')
      .not('due_date', 'is', null)
      .lt('due_date', todayDate),
    supabaseAdmin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'unpaid')
      .not('status', 'eq', 'void')
      .not('due_date', 'is', null)
      .lt('due_date', thirtyDaysAgoDate),
    supabaseAdmin
      .from('support_tickets')
      .select('id, subject, status, priority, created_at')
      .in('status', ['open', 'investigating'])
      .eq('priority', 'critical')
      .order('created_at', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'investigating'])
      .eq('priority', 'critical'),
    supabaseAdmin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'investigating')
      .eq('priority', 'critical'),
    supabaseAdmin
      .from('support_tickets')
      .select('id, subject, created_at')
      .eq('category', 'compliance')
      .in('status', ['open', 'investigating'])
      .lt('created_at', twentyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(PREVIEW_LIMIT),
    supabaseAdmin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'compliance')
      .in('status', ['open', 'investigating'])
      .lt('created_at', twentyDaysAgo),
    supabaseAdmin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'compliance')
      .in('status', ['open', 'investigating'])
      .lt('created_at', twentyFiveDaysAgo),
  ]);

  const queryErrors: string[] = [];
  const collectQueryError = (
    source: string,
    ...errors: Array<{ code?: string; message?: string } | null | undefined>
  ) => {
    const error = errors.find((candidate) => candidate && !isTableMissing(candidate));
    if (error) queryErrors.push(`${source}: ${error.message}`);
  };

  collectQueryError('companies_pending', companiesPendingPreviewResult.error, companiesPendingCountResult.error);
  collectQueryError('companies_suspended', companiesSuspendedCountResult.error);
  collectQueryError('jobs_at_risk', jobsAtRiskPreviewResult.error, jobsAtRiskCountResult.error, jobsAtRiskP0CountResult.error);
  collectQueryError('jobs_without_driver', jobsWithoutDriverPreviewResult.error, jobsWithoutDriverCountResult.error);
  collectQueryError('docs_expiring', docsExpiringSoonPreviewResult.error, docsExpiringSoonCountResult.error, docsExpiringSoonP1CountResult.error);
  collectQueryError('docs_expired', docsExpiredPreviewResult.error, docsExpiredCountResult.error);

  const fraudUnavailable = [
    fraudCasesPreviewResult.error,
    fraudCasesCountResult.error,
    fraudCasesP0CountResult.error,
  ].some((error) => isTableMissing(error));
  collectQueryError('fraud_cases', fraudCasesPreviewResult.error, fraudCasesCountResult.error, fraudCasesP0CountResult.error);

  const invoicesUnavailable = [
    invoicesOverduePreviewResult.error,
    invoicesOverdueCountResult.error,
    invoicesOverdueP1CountResult.error,
  ].some((error) => isTableMissing(error));
  collectQueryError('invoices_overdue', invoicesOverduePreviewResult.error, invoicesOverdueCountResult.error, invoicesOverdueP1CountResult.error);

  const supportCriticalUnavailable = [
    supportTicketsCriticalPreviewResult.error,
    supportTicketsCriticalCountResult.error,
    supportTicketsCriticalP0CountResult.error,
  ].some((error) => isTableMissing(error));
  collectQueryError(
    'support_tickets_critical',
    supportTicketsCriticalPreviewResult.error,
    supportTicketsCriticalCountResult.error,
    supportTicketsCriticalP0CountResult.error,
  );

  const gdprUnavailable = [
    gdprRequestsPreviewResult.error,
    gdprRequestsCountResult.error,
    gdprRequestsP0CountResult.error,
  ].some((error) => isTableMissing(error));
  collectQueryError('gdpr_requests', gdprRequestsPreviewResult.error, gdprRequestsCountResult.error, gdprRequestsP0CountResult.error);

  if (queryErrors.length > 0) {
    return respond(503, {
      error: 'Command Centre data could not be determined safely.',
      queryErrors,
    });
  }

  const queue: ActionQueueItem[] = [];

  for (const company of (companiesPendingPreviewResult.data ?? []) as Array<{ id: string; name: string; created_at: string }>) {
    const age = ageMinutes(company.created_at);
    queue.push({
      id: `company-approval-${company.id}`,
      type: 'company_pending_approval',
      severity: 'P1' as const,
      title: 'Company awaiting approval',
      description: `${company.name} has been waiting ${age >= 60 ? `${Math.floor(age / 60)}h` : `${age}m`}`,
      entityType: 'company',
      entityId: company.id,
      entityName: company.name,
      detectedAt: company.created_at,
      ageMinutes: age,
      href: `/super-admin/companies/approvals`,
    });
  }

  for (const job of (jobsAtRiskPreviewResult.data ?? []) as Array<{ id: string; status: string; pickup_location: string | null; delivery_location: string | null; updated_at: string }>) {
    const age = ageMinutes(job.updated_at);
    queue.push({
      id: `job-at-risk-${job.id}`,
      type: 'job_status_stale',
      severity: age > 4 * 60 ? 'P0' : 'P1',
      title: 'Job status stale',
      description: `Status "${job.status}" not updated for ${Math.floor(age / 60)}h ${age % 60}m`,
      entityType: 'job',
      entityId: job.id,
      entityName: `${job.pickup_location ?? '—'} → ${job.delivery_location ?? '—'}`,
      detectedAt: job.updated_at,
      ageMinutes: age,
      href: `/super-admin/operations/active-jobs`,
    });
  }

  for (const job of (jobsWithoutDriverPreviewResult.data ?? []) as Array<{ id: string; status: string; pickup_location: string | null; delivery_location: string | null; created_at: string }>) {
    const age = ageMinutes(job.created_at);
    queue.push({
      id: `job-no-driver-${job.id}`,
      type: 'job_no_driver',
      severity: 'P1',
      title: 'Job without driver',
      description: `"${job.status}" job has no driver assigned`,
      entityType: 'job',
      entityId: job.id,
      entityName: `${job.pickup_location ?? '—'} → ${job.delivery_location ?? '—'}`,
      detectedAt: job.created_at,
      ageMinutes: age,
      href: `/super-admin/operations/allocations`,
    });
  }

  for (const doc of (docsExpiringSoonPreviewResult.data ?? []) as Array<{ id: string; driver_id: string; doc_type: string; expiry_date: string }>) {
    const daysLeft = Math.ceil((new Date(doc.expiry_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    queue.push({
      id: `doc-expiring-${doc.id}`,
      type: 'document_expiring',
      severity: daysLeft <= 2 ? 'P1' : 'P2',
      title: 'Document expiring soon',
      description: `${doc.doc_type.replace(/_/g, ' ')} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      entityType: 'driver',
      entityId: doc.driver_id,
      entityName: `Document: ${doc.doc_type}`,
      detectedAt: doc.expiry_date,
      ageMinutes: ageMinutesUnclamped(doc.expiry_date),
      href: `/super-admin/compliance/expiries`,
    });
  }

  for (const doc of (docsExpiredPreviewResult.data ?? []) as Array<{ id: string; driver_id: string; doc_type: string; expiry_date: string }>) {
    queue.push({
      id: `doc-expired-${doc.id}`,
      type: 'document_expired',
      severity: 'P1',
      title: 'Document expired',
      description: `${doc.doc_type.replace(/_/g, ' ')} expired on ${doc.expiry_date.slice(0, 10)}`,
      entityType: 'driver',
      entityId: doc.driver_id,
      entityName: `Document: ${doc.doc_type}`,
      detectedAt: doc.expiry_date,
      ageMinutes: ageMinutes(doc.expiry_date),
      href: `/super-admin/compliance/expiries`,
    });
  }

  if (!fraudUnavailable) {
    for (const fraudCase of (fraudCasesPreviewResult.data ?? []) as Array<{ id: string; subject_company_id: string | null; status: string; created_at: string }>) {
      const age = ageMinutes(fraudCase.created_at);
      queue.push({
        id: `fraud-${fraudCase.id}`,
        type: 'fraud_case',
        severity: fraudCase.status === 'investigating' ? 'P0' : 'P1',
        title: 'Fraud case open',
        description: `Status: ${fraudCase.status} · Age: ${age >= 60 ? `${Math.floor(age / 60)}h` : `${age}m`}`,
        entityType: 'company',
        entityId: fraudCase.subject_company_id ?? fraudCase.id,
        entityName: `Fraud Case #${fraudCase.id.slice(0, 8)}`,
        detectedAt: fraudCase.created_at,
        ageMinutes: age,
        href: `/super-admin/compliance/fraud-cases`,
      });
    }
  }

  if (!invoicesUnavailable) {
    for (const invoice of (invoicesOverduePreviewResult.data ?? []) as Array<{ id: string; invoice_number: string; amount: number; currency: string | null; due_date: string; created_at: string }>) {
      const age = ageMinutes(invoice.due_date);
      const currency = String(invoice.currency ?? '').trim().toUpperCase() || 'UNKNOWN';
      queue.push({
        id: `invoice-overdue-${invoice.id}`,
        type: 'invoice_overdue',
        severity: age > 30 * 24 * 60 ? 'P1' : 'P2',
        title: 'Invoice overdue',
        description: `${invoice.invoice_number} · ${currency} ${(invoice.amount ?? 0).toFixed(2)} · overdue ${Math.floor(age / (24 * 60))} days`,
        entityType: 'invoice',
        entityId: invoice.id,
        entityName: invoice.invoice_number,
        detectedAt: invoice.due_date,
        ageMinutes: age,
        href: `/super-admin/finance/invoices`,
      });
    }
  }

  if (!supportCriticalUnavailable) {
    for (const ticket of (supportTicketsCriticalPreviewResult.data ?? []) as Array<{ id: string; subject: string; status: string; priority: string; created_at: string }>) {
      const age = ageMinutes(ticket.created_at);
      queue.push({
        id: `ticket-${ticket.id}`,
        type: 'support_ticket_critical',
        severity: ticket.status === 'investigating' ? 'P0' : 'P1',
        title: 'Critical support ticket',
        description: `${ticket.subject ?? 'No subject'} · ${age >= 60 ? `${Math.floor(age / 60)}h` : `${age}m`} old`,
        entityType: 'ticket',
        entityId: ticket.id,
        entityName: ticket.subject ?? `Ticket #${ticket.id.slice(0, 8)}`,
        detectedAt: ticket.created_at,
        ageMinutes: age,
        href: `/super-admin/support/tickets`,
      });
    }
  }

  if (!gdprUnavailable) {
    for (const req of (gdprRequestsPreviewResult.data ?? []) as Array<{ id: string; subject: string; created_at: string }>) {
      const age = ageMinutes(req.created_at);
      const daysOld = Math.floor(age / (24 * 60));
      const daysLeft = 30 - daysOld;
      queue.push({
        id: `gdpr-${req.id}`,
        type: 'gdpr_request',
        severity: daysLeft <= 5 ? 'P0' : 'P1',
        title: 'GDPR request approaching deadline',
        description: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining · ${req.subject ?? 'Compliance Request'}`,
        entityType: 'ticket',
        entityId: req.id,
        entityName: req.subject ?? `Request #${req.id.slice(0, 8)}`,
        detectedAt: req.created_at,
        ageMinutes: age,
        href: `/super-admin/support/tickets`,
      });
    }
  }

  queue.sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
    if (severityDiff !== 0) return severityDiff;
    return b.ageMinutes - a.ageMinutes;
  });

  const companiesPendingCount = exactCount(companiesPendingCountResult);
  const jobsAtRiskCount = exactCount(jobsAtRiskCountResult);
  const jobsAtRiskP0Count = exactCount(jobsAtRiskP0CountResult);
  const jobsWithoutDriverCount = exactCount(jobsWithoutDriverCountResult);
  const docsExpiringSoonCount = exactCount(docsExpiringSoonCountResult);
  const docsExpiringSoonP1Count = exactCount(docsExpiringSoonP1CountResult);
  const docsExpiredCount = exactCount(docsExpiredCountResult);
  const fraudCasesCount = fraudUnavailable ? 0 : (exactCount(fraudCasesCountResult) ?? 0);
  const fraudCasesP0Count = fraudUnavailable ? 0 : (exactCount(fraudCasesP0CountResult) ?? 0);
  const overdueInvoiceCount = invoicesUnavailable ? null : exactCount(invoicesOverdueCountResult);
  const overdueInvoiceP1Count = invoicesUnavailable ? 0 : (exactCount(invoicesOverdueP1CountResult) ?? 0);
  const supportCriticalCount = supportCriticalUnavailable ? 0 : (exactCount(supportTicketsCriticalCountResult) ?? 0);
  const supportCriticalP0Count = supportCriticalUnavailable ? 0 : (exactCount(supportTicketsCriticalP0CountResult) ?? 0);
  const gdprRequestsCount = gdprUnavailable ? 0 : (exactCount(gdprRequestsCountResult) ?? 0);
  const gdprRequestsP0Count = gdprUnavailable ? 0 : (exactCount(gdprRequestsP0CountResult) ?? 0);
  const blockedAccountsCount = exactCount(companiesSuspendedCountResult);

  const coreCountUnavailable = [
    companiesPendingCount,
    jobsAtRiskCount,
    jobsAtRiskP0Count,
    jobsWithoutDriverCount,
    docsExpiringSoonCount,
    docsExpiringSoonP1Count,
    docsExpiredCount,
    blockedAccountsCount,
  ].some((count) => count === null);

  if (coreCountUnavailable) {
    return respond(503, {
      error: 'Command Centre exact counts could not be determined safely.',
    });
  }

  const staleJobP1Count =
    jobsAtRiskCount !== null && jobsAtRiskP0Count !== null ? Math.max(0, jobsAtRiskCount - jobsAtRiskP0Count) : 0;
  const docsExpiringSoonP2Count =
    docsExpiringSoonCount !== null && docsExpiringSoonP1Count !== null
      ? Math.max(0, docsExpiringSoonCount - docsExpiringSoonP1Count)
      : 0;
  const fraudCasesP1Count = Math.max(0, fraudCasesCount - fraudCasesP0Count);
  const overdueInvoiceP2Count =
    overdueInvoiceCount === null ? 0 : Math.max(0, overdueInvoiceCount - overdueInvoiceP1Count);
  const supportCriticalP1Count = Math.max(0, supportCriticalCount - supportCriticalP0Count);
  const gdprRequestsP1Count = Math.max(0, gdprRequestsCount - gdprRequestsP0Count);
  const p0Count = (jobsAtRiskP0Count ?? 0)
    + fraudCasesP0Count
    + supportCriticalP0Count
    + gdprRequestsP0Count;
  const p1Count = (companiesPendingCount ?? 0)
    + staleJobP1Count
    + (jobsWithoutDriverCount ?? 0)
    + (docsExpiringSoonP1Count ?? 0)
    + (docsExpiredCount ?? 0)
    + fraudCasesP1Count
    + overdueInvoiceP1Count
    + supportCriticalP1Count
    + gdprRequestsP1Count;
  const p2Count = docsExpiringSoonP2Count + overdueInvoiceP2Count;
  const totalQueueCount = p0Count + p1Count + p2Count;
  const criticalActionsCount = p0Count + p1Count;
  const exactJobsAtRiskCount =
    jobsAtRiskCount !== null && jobsWithoutDriverCount !== null
      ? jobsAtRiskCount + jobsWithoutDriverCount
      : null;

  const invoicesQueryFailed = Boolean(
    !invoicesUnavailable &&
    (invoicesOverduePreviewResult.error || invoicesOverdueCountResult.error || invoicesOverdueP1CountResult.error),
  );

  let degradedServicesCount: number | null = null;
  let degradedServicesSeverity: 'warning' | 'caution' | 'ok' | 'unknown' = 'unknown';
  let degradedServicesNote = 'Platform health snapshot unavailable — not reported as zero.';
  try {
    const healthSnapshot = await runPlatformHealthChecks();
    const { summary } = healthSnapshot;
    if (summary.determined && summary.unhealthyCount !== null) {
      degradedServicesCount = summary.unhealthyCount;
      degradedServicesSeverity = summary.errorCount > 0
        ? 'warning'
        : summary.degradedCount > 0
          ? 'caution'
          : 'ok';
      degradedServicesNote = degradedServicesCount === 0
        ? `All ${summary.totalChecks} canonical health checks are healthy.`
        : `${degradedServicesCount} of ${summary.totalChecks} canonical health checks require attention (${summary.errorCount} error, ${summary.degradedCount} degraded).`;
    }
  } catch {
    degradedServicesCount = null;
    degradedServicesSeverity = 'unknown';
    degradedServicesNote = 'Platform health snapshot unavailable — not reported as zero.';
  }

  const unavailableSources: string[] = [];
  if (fraudUnavailable) unavailableSources.push('fraud_review_cases');
  if (invoicesUnavailable) unavailableSources.push('invoices');
  if (supportCriticalUnavailable) unavailableSources.push('support_tickets');
  if (gdprUnavailable) unavailableSources.push('support_tickets_gdpr');

  const criticalCoverageUnavailable = fraudUnavailable || supportCriticalUnavailable || gdprUnavailable;
  const queueCoverageUnavailable = criticalCoverageUnavailable || invoicesUnavailable;

  return respond(200, {
    environment: resolveEnvironment(),
    refreshedAt: now.toISOString(),
    ...(unavailableSources.length > 0 ? { unavailableSources } : {}),
    attentionIndicators: {
      p0p1Incidents: criticalCoverageUnavailable
        ? {
            count: null,
            label: 'Critical actions (P0/P1)',
            severity: 'unknown' as const,
            note: 'One or more critical-action sources are unavailable.',
          }
        : {
            count: criticalActionsCount,
            label: 'Critical actions (P0/P1)',
            severity: criticalActionsCount > 0 ? 'critical' as const : 'ok' as const,
          },
      jobsAtRisk: exactJobsAtRiskCount === null
        ? { count: null, label: 'Jobs at risk', severity: 'unknown' as const, note: 'Jobs-at-risk totals unavailable.' }
        : {
            count: exactJobsAtRiskCount,
            label: 'Jobs at risk',
            severity: exactJobsAtRiskCount > 5 ? 'warning' as const : exactJobsAtRiskCount > 0 ? 'caution' as const : 'ok' as const,
          },
      blockedAccounts: blockedAccountsCount === null
        ? { count: null, label: 'Blocked accounts', severity: 'unknown' as const, note: 'Blocked account totals unavailable.' }
        : {
            count: blockedAccountsCount,
            label: 'Blocked accounts',
            severity: blockedAccountsCount > 10 ? 'warning' as const : 'ok' as const,
          },
      financialExposure: invoicesUnavailable
        ? { count: null, label: 'Overdue invoices', severity: 'unknown' as const, note: 'Invoices table not yet available' }
        : invoicesQueryFailed || overdueInvoiceCount === null
          ? { count: null, label: 'Overdue invoices', severity: 'unknown' as const, note: 'Overdue invoice totals unavailable.' }
          : {
              count: overdueInvoiceCount,
              label: 'Overdue invoices',
              severity: 'unknown' as const,
              note: 'Exact overdue amount unavailable without a safe database aggregate.',
            },
      degradedServices: {
        count: degradedServicesCount,
        label: 'Degraded services',
        severity: degradedServicesSeverity,
        note: degradedServicesNote,
      },
    },
    actionQueue: {
      derived: true,
      partial: queueCoverageUnavailable,
      queueNote: queueCoverageUnavailable
        ? 'Computed from available source tables only; at least one source is unavailable, so queue totals are unknown.'
        : 'Computed on-demand from current source tables. Not a persistent incident/case registry — items are re-derived on every request.',
      total: queueCoverageUnavailable ? null : totalQueueCount,
      p0: criticalCoverageUnavailable ? null : p0Count,
      p1: queueCoverageUnavailable ? null : p1Count,
      p2: invoicesUnavailable ? null : p2Count,
      items: queue.slice(0, PREVIEW_LIMIT),
    },
  });
}
