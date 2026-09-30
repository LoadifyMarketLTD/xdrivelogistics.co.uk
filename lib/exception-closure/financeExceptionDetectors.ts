export type DetectorInvoice = {
  id: string;
  job_id?: string | null;
  company_id?: string | null;
  supplier_company_id?: string | null;
  buyer_company_id?: string | null;
  invoice_number?: string | null;
  load_id?: string | null;
  job_ref?: string | null;
  status?: string | null;
  payment_status?: string | null;
  due_date?: string | null;
  issue_date?: string | null;
  payment_due_days?: number | null;
  disputed_at?: string | null;
  paid_at?: string | null;
};

export type InvoiceFailureEvent = {
  job_id?: string | null;
  message?: string | null;
  event_time?: string | null;
  created_at?: string | null;
};

export type JobFinanceContext = {
  id: string;
  label: string;
  companyId: string | null;
  isTest: boolean;
};

export type FinanceExceptionCandidate = {
  caseType: 'invoice_generation_failed' | 'payment_overdue' | 'payment_disputed';
  severity: 'P1' | 'P2';
  title: string;
  description: string;
  entityType: 'job' | 'invoice';
  entityId: string;
  entityLabel: string;
  companyId: string | null;
  dedupeKey: string;
  nextAction: string;
  nextActionDueMinutes: number;
  customerUpdateDueMinutes: number | null;
  closureDueMinutes: number;
  metadata: Record<string, unknown>;
};

const lower = (value: unknown) => String(value ?? '').trim().toLowerCase();

const invoiceLabel = (invoice: DetectorInvoice) =>
  invoice.invoice_number?.trim()
  || invoice.load_id?.trim()
  || invoice.job_ref?.trim()
  || invoice.id.slice(0, 8).toUpperCase();

const invoiceCompanyId = (invoice: DetectorInvoice) =>
  invoice.supplier_company_id
  || invoice.company_id
  || invoice.buyer_company_id
  || null;

const dueAtMs = (invoice: DetectorInvoice) => {
  if (invoice.due_date) {
    const parsed = Date.parse(`${invoice.due_date}T00:00:00Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (invoice.issue_date) {
    const issue = Date.parse(`${invoice.issue_date}T00:00:00Z`);
    if (Number.isFinite(issue)) return issue + Math.max(0, invoice.payment_due_days ?? 30) * 86_400_000;
  }
  return Number.NaN;
};

export function detectFinanceExceptions(
  invoices: DetectorInvoice[],
  failureEvents: InvoiceFailureEvent[],
  jobsById: Map<string, JobFinanceContext>,
  nowMs = Date.now(),
) {
  const out: FinanceExceptionCandidate[] = [];
  const todayUtc = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
  );
  const invoiceJobIds = new Set(
    invoices.map((invoice) => invoice.job_id ?? '').filter(Boolean),
  );

  for (const invoice of invoices) {
    const jobId = invoice.job_id ?? '';
    const job = jobId ? jobsById.get(jobId) : undefined;
    if (!job || job.isTest) continue;

    const paymentStatus = lower(invoice.payment_status);
    const status = lower(invoice.status);
    const due = dueAtMs(invoice);

    if (
      Number.isFinite(due)
      && due < todayUtc
      && ['unpaid', 'partially_paid', 'overdue'].includes(paymentStatus)
      && !['paid', 'void', 'draft', 'cancelled', 'canceled'].includes(status)
    ) {
      out.push({
        caseType: 'payment_overdue',
        severity: 'P2',
        title: 'Invoice payment is overdue',
        description: 'The invoice has passed its payment due date and remains unpaid or partially paid.',
        entityType: 'invoice',
        entityId: invoice.id,
        entityLabel: invoiceLabel(invoice),
        companyId: invoiceCompanyId(invoice) ?? job.companyId,
        dedupeKey: `exception:payment_overdue:invoice:${invoice.id}`,
        nextAction: 'Review the receivable, confirm payment position and record the agreed follow-up.',
        nextActionDueMinutes: 120,
        customerUpdateDueMinutes: 120,
        closureDueMinutes: 1440,
        metadata: {
          detector: 'payment_overdue',
          job_id: jobId,
          due_date: invoice.due_date ?? null,
          payment_status: paymentStatus,
          invoice_status: status,
        },
      });
    }

    if (paymentStatus === 'disputed' || status === 'disputed') {
      out.push({
        caseType: 'payment_disputed',
        severity: 'P1',
        title: 'Invoice payment is disputed',
        description: 'The invoice or payment record is marked disputed and requires active finance resolution.',
        entityType: 'invoice',
        entityId: invoice.id,
        entityLabel: invoiceLabel(invoice),
        companyId: invoiceCompanyId(invoice) ?? job.companyId,
        dedupeKey: `exception:payment_disputed:invoice:${invoice.id}`,
        nextAction: 'Review the dispute evidence, identify the owner and agree the next resolution step.',
        nextActionDueMinutes: 30,
        customerUpdateDueMinutes: 30,
        closureDueMinutes: 480,
        metadata: {
          detector: 'payment_disputed',
          job_id: jobId,
          disputed_at: invoice.disputed_at ?? null,
          payment_status: paymentStatus,
          invoice_status: status,
        },
      });
    }
  }

  const seenFailureJobs = new Set<string>();
  for (const event of failureEvents) {
    const jobId = event.job_id ?? '';
    if (!jobId || seenFailureJobs.has(jobId) || invoiceJobIds.has(jobId)) continue;
    const job = jobsById.get(jobId);
    if (!job || job.isTest) continue;
    seenFailureJobs.add(jobId);

    out.push({
      caseType: 'invoice_generation_failed',
      severity: 'P1',
      title: 'Automatic invoice generation failed',
      description: 'A delivered or completed job recorded an automatic invoice generation failure and no invoice currently exists.',
      entityType: 'job',
      entityId: jobId,
      entityLabel: job.label,
      companyId: job.companyId,
      dedupeKey: `exception:invoice_generation_failed:job:${jobId}`,
      nextAction: 'Investigate the invoice generation failure and restore the job-to-invoice closure path.',
      nextActionDueMinutes: 30,
      customerUpdateDueMinutes: null,
      closureDueMinutes: 120,
      metadata: {
        detector: 'invoice_generation_failed',
        failure_message: event.message ?? null,
        failure_recorded_at: event.event_time ?? event.created_at ?? null,
      },
    });
  }

  return out;
}
