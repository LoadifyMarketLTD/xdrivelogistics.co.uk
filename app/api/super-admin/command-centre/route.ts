/**
 * GET /api/super-admin/command-centre
 *
 * Returns the Command Centre data payload:
 *  - environment banner (PRODUCTION / STAGING / DEVELOPMENT)
 *  - 5 attention indicators (P0/P1 incidents, jobs at risk, blocked accounts,
 *    financial exposure, degraded services)
 *  - Critical Action Queue (sorted by severity + age)
 *  - Platform status snapshot
 *
 * Owner role required.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const SEVERITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

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

const resolveOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

const ageMinutes = (isoDate: string): number => {
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(ms / 60000));
};

const resolveEnvironment = (): 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT' => {
  const env = (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase();
  if (env === 'production') return 'PRODUCTION';
  if (env === 'staging') return 'STAGING';
  return 'DEVELOPMENT';
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await resolveOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const now = new Date();

  // Parallel data fetch for all Command Centre indicators
  const [
    companiesPendingResult,
    companiesSuspendedResult,
    jobsAtRiskResult,
    jobsWithoutDriverResult,
    docsExpiringSoonResult,
    docsExpiredActiveResult,
    fraudCasesResult,
    invoicesOverdueResult,
    supportTicketsCriticalResult,
    gdprRequestsResult,
  ] = await Promise.all([
    // Companies awaiting approval
    supabaseAdmin
      .from('companies')
      .select('id, name, created_at', { count: 'exact' })
      .in('status', ['pending', 'pending_approval'])
      .order('created_at', { ascending: true })
      .limit(20),

    // Companies suspended/restricted
    supabaseAdmin
      .from('companies')
      .select('id, name', { count: 'exact' })
      .in('status', ['suspended', 'compliance_restricted', 'financial_restricted'])
      .limit(5),

    // Active jobs with status not changed in >2h (at risk)
    supabaseAdmin
      .from('jobs')
      .select('id, status, pickup_location, delivery_location, updated_at, created_at')
      .in('status', ['allocated', 'collected', 'in_transit'])
      .lt('updated_at', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: true })
      .limit(20),

    // Jobs awarded/posted but without driver for >1h
    supabaseAdmin
      .from('jobs')
      .select('id, status, pickup_location, delivery_location, created_at')
      .in('status', ['awarded', 'allocated'])
      .is('assigned_driver_id', null)
      .lt('updated_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(20),

    // Documents expiring in ≤7 days (active companies/drivers)
    supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, document_type, expires_at')
      .eq('status', 'approved')
      .gte('expires_at', now.toISOString())
      .lte('expires_at', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('expires_at', { ascending: true })
      .limit(20),

    // Expired documents on active jobs
    supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, document_type, expires_at')
      .eq('status', 'approved')
      .lt('expires_at', now.toISOString())
      .order('expires_at', { ascending: true })
      .limit(20),

    // Open fraud cases
    supabaseAdmin
      .from('fraud_review_cases')
      .select('id, company_id, status, created_at')
      .in('status', ['open', 'pending_review', 'escalated'])
      .order('created_at', { ascending: true })
      .limit(10),

    // Overdue invoices (payment_status = unpaid, due_date < now)
    supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, amount, due_date, created_at', { count: 'exact' })
      .eq('payment_status', 'unpaid')
      .not('due_date', 'is', null)
      .lt('due_date', now.toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
      .limit(20),

    // Critical support tickets (open, not yet responded)
    supabaseAdmin
      .from('support_tickets')
      .select('id, subject, status, created_at', { count: 'exact' })
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: true })
      .limit(10),

    // GDPR requests approaching deadline (SAR: 30 days from receipt)
    supabaseAdmin
      .from('support_tickets')
      .select('id, subject, created_at')
      .eq('category', 'gdpr')
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: true })
      .limit(10),
  ]);

  // Build Critical Action Queue
  const queue: ActionQueueItem[] = [];

  // Companies pending approval
  for (const company of (companiesPendingResult.data ?? []) as Array<{ id: string; name: string; created_at: string }>) {
    const age = ageMinutes(company.created_at);
    queue.push({
      id: `company-approval-${company.id}`,
      type: 'company_pending_approval',
      severity: age > 24 * 60 ? 'P0' : 'P1',
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

  // Jobs at risk (no status change for >2h in active states)
  for (const job of (jobsAtRiskResult.data ?? []) as Array<{ id: string; status: string; pickup_location: string | null; delivery_location: string | null; updated_at: string }>) {
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

  // Jobs without driver
  for (const job of (jobsWithoutDriverResult.data ?? []) as Array<{ id: string; status: string; pickup_location: string | null; delivery_location: string | null; created_at: string }>) {
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

  // Documents expiring soon
  for (const doc of (docsExpiringSoonResult.data ?? []) as Array<{ id: string; driver_id: string; document_type: string; expires_at: string }>) {
    const daysLeft = Math.ceil((new Date(doc.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    queue.push({
      id: `doc-expiring-${doc.id}`,
      type: 'document_expiring',
      severity: daysLeft <= 2 ? 'P1' : 'P2',
      title: 'Document expiring soon',
      description: `${doc.document_type.replace(/_/g, ' ')} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      entityType: 'driver',
      entityId: doc.driver_id,
      entityName: `Document: ${doc.document_type}`,
      detectedAt: doc.expires_at,
      ageMinutes: 0,
      href: `/super-admin/compliance/expiries`,
    });
  }

  // Expired documents
  for (const doc of (docsExpiredActiveResult.data ?? []) as Array<{ id: string; driver_id: string; document_type: string; expires_at: string }>) {
    queue.push({
      id: `doc-expired-${doc.id}`,
      type: 'document_expired',
      severity: 'P1',
      title: 'Document expired',
      description: `${doc.document_type.replace(/_/g, ' ')} expired on ${doc.expires_at.slice(0, 10)}`,
      entityType: 'driver',
      entityId: doc.driver_id,
      entityName: `Document: ${doc.document_type}`,
      detectedAt: doc.expires_at,
      ageMinutes: ageMinutes(doc.expires_at),
      href: `/super-admin/compliance/expiries`,
    });
  }

  // Fraud cases
  for (const fraudCase of (fraudCasesResult.data ?? []) as Array<{ id: string; company_id: string; status: string; created_at: string }>) {
    const age = ageMinutes(fraudCase.created_at);
    queue.push({
      id: `fraud-${fraudCase.id}`,
      type: 'fraud_case',
      severity: fraudCase.status === 'escalated' ? 'P0' : 'P1',
      title: 'Fraud case open',
      description: `Status: ${fraudCase.status} · Age: ${age >= 60 ? `${Math.floor(age / 60)}h` : `${age}m`}`,
      entityType: 'company',
      entityId: fraudCase.company_id,
      entityName: `Fraud Case #${fraudCase.id.slice(0, 8)}`,
      detectedAt: fraudCase.created_at,
      ageMinutes: age,
      href: `/super-admin/compliance/fraud-cases`,
    });
  }

  // Overdue invoices
  for (const invoice of (invoicesOverdueResult.data ?? []) as Array<{ id: string; invoice_number: string; amount: number; due_date: string; created_at: string }>) {
    const age = ageMinutes(invoice.due_date);
    queue.push({
      id: `invoice-overdue-${invoice.id}`,
      type: 'invoice_overdue',
      severity: age > 30 * 24 * 60 ? 'P1' : 'P2',
      title: 'Invoice overdue',
      description: `${invoice.invoice_number} · £${(invoice.amount ?? 0).toFixed(2)} · overdue ${Math.floor(age / (24 * 60))} days`,
      entityType: 'invoice',
      entityId: invoice.id,
      entityName: invoice.invoice_number,
      detectedAt: invoice.due_date,
      ageMinutes: age,
      href: `/super-admin/finance/invoices`,
    });
  }

  // Critical support tickets
  for (const ticket of (supportTicketsCriticalResult.data ?? []) as Array<{ id: string; subject: string; status: string; created_at: string }>) {
    const age = ageMinutes(ticket.created_at);
    queue.push({
      id: `ticket-${ticket.id}`,
      type: 'support_ticket_open',
      severity: age > 4 * 60 ? 'P1' : 'P2',
      title: 'Support ticket open',
      description: `${ticket.subject ?? 'No subject'} · ${age >= 60 ? `${Math.floor(age / 60)}h` : `${age}m`} old`,
      entityType: 'ticket',
      entityId: ticket.id,
      entityName: ticket.subject ?? `Ticket #${ticket.id.slice(0, 8)}`,
      detectedAt: ticket.created_at,
      ageMinutes: age,
      href: `/super-admin/support/tickets`,
    });
  }

  // GDPR requests
  for (const req of (gdprRequestsResult.data ?? []) as Array<{ id: string; subject: string; created_at: string }>) {
    const age = ageMinutes(req.created_at);
    // SAR deadline: 30 days = 43200 minutes. Alert when >20 days old.
    const daysOld = Math.floor(age / (24 * 60));
    const daysLeft = 30 - daysOld;
    queue.push({
      id: `gdpr-${req.id}`,
      type: 'gdpr_request',
      severity: daysLeft <= 5 ? 'P0' : 'P1',
      title: 'GDPR request approaching deadline',
      description: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining · ${req.subject ?? 'Subject Access Request'}`,
      entityType: 'ticket',
      entityId: req.id,
      entityName: req.subject ?? `GDPR Request #${req.id.slice(0, 8)}`,
      detectedAt: req.created_at,
      ageMinutes: age,
      href: `/super-admin/support/tickets`,
    });
  }

  // Sort queue: P0 first, then P1, then P2, within same severity by age desc
  queue.sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
    if (severityDiff !== 0) return severityDiff;
    return b.ageMinutes - a.ageMinutes;
  });

  // Attention indicators (top 5)
  const p0p1Count = queue.filter((item) => item.severity === 'P0' || item.severity === 'P1').length;
  const jobsAtRiskCount = (jobsAtRiskResult.data ?? []).length + (jobsWithoutDriverResult.data ?? []).length;
  const blockedAccountsCount = companiesSuspendedResult.count ?? 0;
  const overdueAmount = ((invoicesOverdueResult.data ?? []) as Array<{ amount: number }>)
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
  const degradedServicesCount = 0; // Will be populated from health checks in PR-4.1

  return respond(200, {
    environment: resolveEnvironment(),
    refreshedAt: now.toISOString(),
    attentionIndicators: {
      p0p1Incidents: { count: p0p1Count, label: 'Incidents P0/P1', severity: p0p1Count > 0 ? 'critical' : 'ok' },
      jobsAtRisk: { count: jobsAtRiskCount, label: 'Jobs at risk', severity: jobsAtRiskCount > 5 ? 'warning' : jobsAtRiskCount > 0 ? 'caution' : 'ok' },
      blockedAccounts: { count: blockedAccountsCount, label: 'Blocked accounts', severity: blockedAccountsCount > 10 ? 'warning' : 'ok' },
      financialExposure: { amountGbp: overdueAmount, label: 'Overdue invoices', severity: overdueAmount > 10000 ? 'critical' : overdueAmount > 1000 ? 'warning' : 'ok' },
      degradedServices: { count: degradedServicesCount, label: 'Degraded services', severity: degradedServicesCount > 0 ? 'critical' : 'ok' },
    },
    actionQueue: {
      total: queue.length,
      p0: queue.filter((i) => i.severity === 'P0').length,
      p1: queue.filter((i) => i.severity === 'P1').length,
      p2: queue.filter((i) => i.severity === 'P2').length,
      items: queue.slice(0, 50), // Return top 50 items
    },
  });
}
