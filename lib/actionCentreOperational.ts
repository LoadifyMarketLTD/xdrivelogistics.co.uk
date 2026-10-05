import { classifyWorkspaceJobStage, isCompanyExecutionJob, normalizedJobStatus } from './jobs/workspaceJobStage';

export type OperationalActionCentreRole = 'admin' | 'broker' | 'customer' | 'driver';

export type OperationalActionJob = {
  id: string;
  company_id?: string | null;
  status?: string | null;
  current_status?: string | null;
  awarded_carrier_company_id?: string | null;
  assigned_company_id?: string | null;
  assigned_driver_id?: string | null;
  vehicle_id?: string | null;
  pod_generated?: boolean | null;
  accepted_bid_id?: string | null;
  broker_pod_review_status?: string | null;
  customer_reference?: string | null;
  booking_reference?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export type OperationalActionBid = {
  id?: string | null;
  job_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type OperationalActionInvoice = {
  id: string;
  job_id?: string | null;
  company_id?: string | null;
  buyer_company_id?: string | null;
  supplier_company_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

export type OperationalActionItem = {
  id: string;
  event_id: string;
  event_type: string;
  entity_type: 'job' | 'invoice';
  status: 'pending' | 'failed';
  created_at: string;
  cta_href: string;
  persistent: true;
  source: 'operational';
};

const nonTerminal = new Set(['draft','received','posted','quoted','awarded','allocated','accepted','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery']);
const settledInvoiceStates = new Set(['paid','void','cancelled']);

const when = (value: string | null | undefined, fallback: string) => value || fallback;
const text = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

const invoiceBelongsToSupplier = (invoice: OperationalActionInvoice, companyId: string) =>
  invoice.supplier_company_id === companyId || invoice.company_id === companyId;

const invoiceBelongsToBuyer = (invoice: OperationalActionInvoice, companyId: string) =>
  invoice.buyer_company_id === companyId;

const isOverdue = (invoice: OperationalActionInvoice, now: Date) => {
  const state = text(invoice.payment_status || invoice.status);
  if (settledInvoiceStates.has(state)) return false;
  if (!invoice.due_date) return false;
  const due = new Date(`${invoice.due_date}T23:59:59.999Z`).getTime();
  return Number.isFinite(due) && due < now.getTime();
};

const hasSubmittedQuote = (bids: OperationalActionBid[], jobId: string) =>
  bids.some((bid) => bid.job_id === jobId && text(bid.status) === 'submitted');

const hasInvoice = (invoices: OperationalActionInvoice[], jobId: string) =>
  invoices.some((invoice) => invoice.job_id === jobId && !settledInvoiceStates.has(text(invoice.status)));

const driverActionFor = (job: OperationalActionJob): string | null => {
  const status = normalizedJobStatus(job);
  if (status === 'allocated') return 'driver_acceptance_required';
  if (status === 'accepted') return 'depart_for_collection';
  if (status === 'on_my_way') return 'arrive_at_collection';
  if (status === 'on_site_pickup') return 'confirm_loaded';
  if (status === 'loaded' || status === 'in_transit') return 'continue_to_delivery';
  if (status === 'on_site_delivery') return 'confirm_delivery';
  if (status === 'delivered' && !job.pod_generated) return 'complete_pod';
  return null;
};

export function deriveOperationalActionCentreItems(input: {
  role: OperationalActionCentreRole;
  companyId?: string | null;
  driverId?: string | null;
  jobs: OperationalActionJob[];
  bids: OperationalActionBid[];
  invoices: OperationalActionInvoice[];
  now?: Date;
}): OperationalActionItem[] {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const companyId = String(input.companyId ?? '').trim();
  const driverId = String(input.driverId ?? '').trim();
  const items: OperationalActionItem[] = [];

  const push = (item: Omit<OperationalActionItem, 'persistent' | 'source'>) => {
    items.push({ ...item, persistent: true, source: 'operational' });
  };

  if (input.role === 'driver' && driverId) {
    for (const job of input.jobs.filter((row) => row.assigned_driver_id === driverId)) {
      const action = driverActionFor(job);
      if (!action) continue;
      push({
        id: `operational-driver-${job.id}-${action}`,
        event_id: job.id,
        event_type: action,
        entity_type: 'job',
        status: 'pending',
        created_at: when(job.delivered_at || job.completed_at || job.created_at, nowIso),
        cta_href: `/driver/jobs/${job.id}`,
      });
    }
    return items;
  }

  if (!companyId) return items;

  if (input.role === 'admin') {
    const executionJobs = input.jobs.filter((job) => isCompanyExecutionJob(job, companyId));
    for (const job of executionJobs) {
      const stage = classifyWorkspaceJobStage(job);
      const status = normalizedJobStatus(job);
      if ((stage === 'awarded' || stage === 'allocated') && !job.assigned_driver_id) {
        push({ id: `operational-admin-${job.id}-allocation`, event_id: job.id, event_type: 'driver_allocation_required', entity_type: 'job', status: 'pending', created_at: when(job.created_at, nowIso), cta_href: '/admin/fleet/assignments' });
      }
      if (status === 'delivered' && !job.pod_generated) {
        push({ id: `operational-admin-${job.id}-pod`, event_id: job.id, event_type: 'pod_completion_required', entity_type: 'job', status: 'pending', created_at: when(job.delivered_at || job.created_at, nowIso), cta_href: '/admin/pod' });
      }
      if (classifyWorkspaceJobStage(job) === 'completed' && job.pod_generated && !hasInvoice(input.invoices, job.id)) {
        push({ id: `operational-admin-${job.id}-invoice`, event_id: job.id, event_type: 'invoice_ready', entity_type: 'job', status: 'pending', created_at: when(job.completed_at || job.delivered_at || job.created_at, nowIso), cta_href: '/admin/finance' });
      }
    }
    for (const invoice of input.invoices.filter((row) => invoiceBelongsToSupplier(row, companyId) && isOverdue(row, now))) {
      push({ id: `operational-admin-invoice-${invoice.id}-overdue`, event_id: invoice.id, event_type: 'invoice_overdue', entity_type: 'invoice', status: 'failed', created_at: when(invoice.created_at, nowIso), cta_href: '/admin/invoices' });
    }
  }

  if (input.role === 'broker' || input.role === 'customer') {
    const ownJobs = input.jobs.filter((job) => job.company_id === companyId);
    for (const job of ownJobs) {
      const status = normalizedJobStatus(job);
      if (nonTerminal.has(status) && !job.accepted_bid_id && hasSubmittedQuote(input.bids, job.id)) {
        push({
          id: `operational-${input.role}-${job.id}-quote`,
          event_id: job.id,
          event_type: 'quote_decision_required',
          entity_type: 'job',
          status: 'pending',
          created_at: when(job.created_at, nowIso),
          cta_href: input.role === 'broker' ? '/broker/bids' : '/customer/quotes',
        });
      }
      if (input.role === 'broker' && job.pod_generated && classifyWorkspaceJobStage(job) === 'completed' && !['approved','rejected'].includes(text(job.broker_pod_review_status))) {
        push({ id: `operational-broker-${job.id}-pod-review`, event_id: job.id, event_type: 'pod_review_required', entity_type: 'job', status: 'pending', created_at: when(job.delivered_at || job.completed_at || job.created_at, nowIso), cta_href: '/broker/pod-review' });
      }
    }
    if (input.role === 'customer') {
      for (const invoice of input.invoices.filter((row) => invoiceBelongsToBuyer(row, companyId) && isOverdue(row, now))) {
        push({ id: `operational-customer-invoice-${invoice.id}-overdue`, event_id: invoice.id, event_type: 'invoice_payment_attention', entity_type: 'invoice', status: 'pending', created_at: when(invoice.created_at, nowIso), cta_href: '/customer/invoices' });
      }
    }
  }

  return items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
