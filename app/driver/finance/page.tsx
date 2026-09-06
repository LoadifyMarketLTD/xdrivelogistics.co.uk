'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
  type CanonicalInvoiceStatus,
  type CanonicalPaymentStatus,
} from '../../../lib/invoiceStatus';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type InvoiceStatus = CanonicalInvoiceStatus;
type PaymentStatus = CanonicalPaymentStatus;

type InvoiceRow = {
  id: string;
  invoice_number: string;
  job_ref: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  client_name: string;
  amount: number;
  net_amount: number;
  vat_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  currency: string;
};

type EligibleJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  client_name: string | null;
  customer_reference: string | null;
  status: string;
  commercial_mode: 'marketplace' | 'direct';
  agreed_amount: number | null;
  direct_invoice_amount: number | null;
  currency: string;
  invoice: {
    id: string;
    invoice_number: string | null;
    status: string;
    amount: number | null;
    client_name: string | null;
    delivery_state: string | null;
  } | null;
};

type FinanceSummary = {
  total: number;
  draft: number;
  sent: number;
  overdue: number;
  paid: number;
  disputed: number;
  cancelled: number;
};

type ValueSummary = { net: number; vat: number; gross: number; paid: number; outstanding: number };

type PaymentSummary = {
  total: number;
  unpaid: number;
  partially_paid: number;
  paid: number;
  overdue: number;
  disputed: number;
  refunded: number;
};

const STATUS_TABS: Array<{ id: InvoiceStatus | 'All'; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Disputed', label: 'Disputed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

const PAYMENT_TABS: Array<{ id: PaymentStatus | 'All'; label: string }> = [
  { id: 'All', label: 'All payments' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partially_paid', label: 'Part paid' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'refunded', label: 'Refunded' },
];

const money = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount ?? 0));

const date = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not set';

const getToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

function statusTone(status: InvoiceStatus): 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' {
  if (status === 'Paid') return 'green';
  if (status === 'Sent') return 'blue';
  if (status === 'Overdue') return 'red';
  if (status === 'Disputed') return 'purple';
  if (status === 'Cancelled') return 'grey';
  return 'orange';
}

function paymentTone(status: PaymentStatus): 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' {
  if (status === 'paid') return 'green';
  if (status === 'partially_paid') return 'blue';
  if (status === 'overdue') return 'red';
  if (status === 'disputed') return 'purple';
  if (status === 'refunded') return 'grey';
  return 'orange';
}

export default function DriverFinancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const canGenerateInvoices = user?.membershipRole === 'owner' || user?.membershipRole === 'admin';
  const [activeTab, setActiveTab] = useState<InvoiceStatus | 'All'>('All');
  const [paymentTab, setPaymentTab] = useState<PaymentStatus | 'All'>('All');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [payments, setPayments] = useState<PaymentSummary | null>(null);
  const [values, setValues] = useState<ValueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [eligibleJobs, setEligibleJobs] = useState<EligibleJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState('');

  const loadInvoices = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const token = await getToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (activeTab !== 'All') params.set('invoice_status', activeTab);
      if (paymentTab !== 'All') params.set('payment_status', paymentTab);
      const response = await fetch(`/api/driver/finance/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as {
        rows?: InvoiceRow[];
        invoiceSummary?: FinanceSummary;
        paymentSummary?: PaymentSummary;
        valueSummary?: ValueSummary;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to load invoices.');

      setInvoices((payload?.rows ?? []).map((row) => ({
        ...row,
        status: toCanonicalInvoiceStatusWithDueDate(row.status, row.due_date),
        payment_status: toCanonicalPaymentStatus(row.payment_status),
      })));
      setSummary(payload?.invoiceSummary ?? null);
      setPayments(payload?.paymentSummary ?? null);
      setValues(payload?.valueSummary ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, paymentTab]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);

  const loadEligibleJobs = async () => {
    if (!canGenerateInvoices) return;
    setJobsLoading(true);
    setGenerateError('');
    const token = await getToken();
    if (!token) {
      setGenerateError('Your session has expired. Please sign in again.');
      setJobsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/driver/finance/jobs/eligible', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as { rows?: EligibleJob[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to load completed jobs.');
      setEligibleJobs(payload?.rows ?? []);
    } catch (reason) {
      setGenerateError(reason instanceof Error ? reason.message : 'Failed to load completed jobs.');
    } finally {
      setJobsLoading(false);
    }
  };

  const openJobPicker = () => {
    if (!canGenerateInvoices) return;
    const next = !showJobPicker;
    setShowJobPicker(next);
    if (next) void loadEligibleJobs();
  };

  const generateInvoice = async (jobId: string) => {
    if (!canGenerateInvoices) return;
    setGeneratingJobId(jobId);
    setGenerateError('');
    const token = await getToken();
    if (!token) {
      setGenerateError('Your session has expired. Please sign in again.');
      setGeneratingJobId(null);
      return;
    }

    try {
      const response = await fetch(`/api/driver/finance/jobs/${jobId}/generate-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      const payload = (await response.json().catch(() => null)) as { invoice?: { id: string }; error?: string } | null;
      if (!response.ok || !payload?.invoice?.id) throw new Error(payload?.error ?? 'Invoice could not be generated.');
      router.push(`/driver/finance/invoices/${payload.invoice.id}`);
    } catch (reason) {
      setGenerateError(reason instanceof Error ? reason.message : 'Invoice could not be generated.');
    } finally {
      setGeneratingJobId(null);
    }
  };

  const counts = useMemo(() => ({
    All: summary?.total ?? 0,
    Draft: summary?.draft ?? 0,
    Sent: summary?.sent ?? 0,
    Overdue: summary?.overdue ?? 0,
    Paid: summary?.paid ?? 0,
    Disputed: summary?.disputed ?? 0,
    Cancelled: summary?.cancelled ?? 0,
  }), [summary]);

  const paymentCounts = useMemo(() => ({
    All: payments?.total ?? 0,
    unpaid: payments?.unpaid ?? 0,
    partially_paid: payments?.partially_paid ?? 0,
    paid: payments?.paid ?? 0,
    overdue: payments?.overdue ?? 0,
    disputed: payments?.disputed ?? 0,
    refunded: payments?.refunded ?? 0,
  }), [payments]);

  const financeRail = (
    <aside className="driver-filter-rail" aria-label="Finance summary">
      <div className="driver-filter-rail__header">Invoice & Payment</div>
      <div className="driver-filter-rail__body">
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice state</div>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="driver-account-link"
            data-active={activeTab === tab.id ? 'true' : 'false'}
            onClick={() => setActiveTab(tab.id)}
          >
            <span><strong>{tab.label}</strong><small>{counts[tab.id]} invoice{counts[tab.id] === 1 ? '' : 's'}</small></span>
            <span>{counts[tab.id]}</span>
          </button>
        ))}
        <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payment state</div>
        {PAYMENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="driver-account-link"
            data-active={paymentTab === tab.id ? 'true' : 'false'}
            onClick={() => setPaymentTab(tab.id)}
          >
            <span><strong>{tab.label}</strong><small>{paymentCounts[tab.id]} record{paymentCounts[tab.id] === 1 ? '' : 's'}</small></span>
            <span>{paymentCounts[tab.id]}</span>
          </button>
        ))}
        {canGenerateInvoices && <ActionButton tone="primary" onClick={openJobPicker}>{showJobPicker ? 'Close generator' : 'Generate Invoice'}</ActionButton>}
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell
        subtitle="Track invoice lifecycle and payment state separately. Company owners and admins can generate invoices from completed jobs."
        headerActions={canGenerateInvoices ? <ActionButton tone="primary" onClick={openJobPicker}>+ Generate Invoice</ActionButton> : undefined}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {generateError && <AlertBanner tone="danger">{generateError}</AlertBanner>}

        <div className="driver-board-layout driver-finance-board">
          {financeRail}
          <main className="driver-board-main">
            <div className="workspace-record-meta" style={{ justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap' }}>
              <span>Gross <strong>{money(values?.gross ?? 0)}</strong> · Net <strong>{money(values?.net ?? 0)}</strong> · VAT <strong>{money(values?.vat ?? 0)}</strong></span>
              <span>Recorded paid <strong>{money(values?.paid ?? 0)}</strong> · Outstanding <strong>{money(values?.outstanding ?? 0)}</strong></span>
            </div>
            <div className="driver-tab-strip" role="tablist" aria-label="Invoice states">
              {STATUS_TABS.map((tab) => (
                <button key={tab.id} type="button" data-active={activeTab === tab.id ? 'true' : 'false'} onClick={() => setActiveTab(tab.id)}>
                  {tab.label} <span>{counts[tab.id]}</span>
                </button>
              ))}
            </div>
            <div className="driver-tab-strip" role="tablist" aria-label="Payment states">
              {PAYMENT_TABS.map((tab) => (
                <button key={tab.id} type="button" data-active={paymentTab === tab.id ? 'true' : 'false'} onClick={() => setPaymentTab(tab.id)}>
                  {tab.label} <span>{paymentCounts[tab.id]}</span>
                </button>
              ))}
            </div>

            {showJobPicker && canGenerateInvoices && (
              <section className="driver-row-details" aria-label="Generate invoice from completed job">
                <div className="driver-detail-tabs"><strong>Completed jobs ready for invoicing</strong></div>
                {jobsLoading ? (
                  <EmptyState compact title="Loading completed jobs…" />
                ) : eligibleJobs.length === 0 ? (
                  <EmptyState compact title="No eligible jobs" description="No delivered or completed jobs are currently available for invoice generation." />
                ) : (
                  <div className="driver-load-list">
                    {eligibleJobs.map((job) => {
                      const commercialAmount = job.invoice?.amount ?? job.agreed_amount ?? job.direct_invoice_amount;
                      const commercialLabel = job.invoice
                        ? 'Invoice total'
                        : job.commercial_mode === 'marketplace'
                          ? 'Agreed carrier rate'
                          : 'Invoice amount';
                      return (
                        <article key={job.id} className="driver-load-row">
                          <div className="driver-load-row__top">
                            <div className="driver-load-cell"><span className="driver-cell-label">Route</span><strong className="driver-cell-primary">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong><span className="driver-cell-secondary">{date(job.pickup_datetime)}</span></div>
                            <div className="driver-load-cell"><span className="driver-cell-label">Customer</span><strong className="driver-cell-primary">{job.client_name ?? 'Marketplace customer'}</strong><span className="driver-cell-secondary">{job.customer_reference ?? `JOB-${job.id.slice(0, 8).toUpperCase()}`}</span></div>
                            <div className="driver-load-cell"><span className="driver-cell-label">{commercialLabel}</span><strong className="driver-cell-primary">{commercialAmount == null ? 'TBC' : money(commercialAmount, job.currency)}</strong><span className="driver-cell-secondary">{job.status}</span></div>
                            <div className="driver-load-cell"><span className="driver-cell-label">Invoice</span><strong className="driver-cell-primary">{job.invoice?.invoice_number ?? 'Not generated'}</strong><span className="driver-cell-secondary">{job.invoice?.status ?? 'Ready for draft'}</span></div>
                          </div>
                          <div className="driver-load-row__meta">
                            <span>Job #{job.id.slice(0, 8).toUpperCase()}</span>
                            <div className="driver-row-actions">
                              <ActionButton tone="primary" disabled={generatingJobId === job.id} onClick={() => void generateInvoice(job.id)}>
                                {generatingJobId === job.id ? 'Preparing…' : job.invoice ? 'Open / refresh invoice' : 'Create draft invoice'}
                              </ActionButton>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <div className="driver-board-summary">
              <span>{invoices.length} invoice{invoices.length === 1 ? '' : 's'} in this view</span>
              <ActionButton tone="secondary" onClick={() => void loadInvoices()} disabled={loading}>Refresh</ActionButton>
            </div>

            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading invoices…" /></div>
            ) : invoices.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No invoices in this view" description={canGenerateInvoices ? 'Generate an invoice from a completed job or choose another invoice/payment filter.' : 'Choose another invoice/payment filter or refresh the register.'} /></div>
            ) : (
              <div className="driver-load-list">
                {invoices.map((invoice) => (
                  <article key={invoice.id} className="driver-load-row" data-state={invoice.status.toLowerCase()}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">Invoice</span><strong className="driver-cell-primary">{invoice.invoice_number}</strong><span className="driver-cell-secondary">{date(invoice.invoice_date)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Customer</span><strong className="driver-cell-primary">{invoice.client_name}</strong><span className="driver-cell-secondary">Job {invoice.job_ref}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Due</span><strong className="driver-cell-primary">{date(invoice.due_date)}</strong><span className="driver-cell-secondary">Invoice due date</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Total</span><strong className="driver-cell-primary">{money(invoice.amount, invoice.currency)}</strong><span className="driver-cell-secondary">Net {money(invoice.net_amount, invoice.currency)} · VAT {money(invoice.vat_amount, invoice.currency)}</span></div>
                    </div>
                    <div className="driver-load-row__meta">
                      <span>{invoice.job_id ? `Job #${invoice.job_id.slice(0, 8).toUpperCase()}` : invoice.job_ref}</span>
                      <span>Invoice: <StatusBadge value={invoice.status} tone={statusTone(invoice.status)} /></span>
                      <span>Payment: <StatusBadge value={invoice.payment_status.replace(/_/g, ' ')} tone={paymentTone(invoice.payment_status)} /></span>
                      <span>Recorded paid {money(invoice.paid_amount, invoice.currency)} · Outstanding {money(invoice.outstanding_amount, invoice.currency)}</span>
                      <div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => router.push(`/driver/finance/invoices/${invoice.id}`)}>Open invoice</ActionButton></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
