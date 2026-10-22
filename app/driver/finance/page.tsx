'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { sendGeneratedInvoice } from '../../../lib/client/invoiceDelivery';
import {
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
  type CanonicalInvoiceStatus,
  type CanonicalPaymentStatus,
} from '../../../lib/invoiceStatus';
import { AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';
import styles from '../../components/workspace/InvoiceProFinance.module.css';

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
type FinanceSection = 'dashboard' | 'register' | 'ready' | 'customers' | 'statements';

const STATUS_TABS: Array<{ id: InvoiceStatus | 'All'; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Disputed', label: 'Disputed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

const money = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount ?? 0));

const date = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not set';

const getToken = async () => readRouteAuthAccessToken();

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
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const financeView = searchParams.get('view') === 'payables' ? 'payables' : 'receivables';
  const canGenerateInvoices = (user?.membershipRole === 'owner' || user?.membershipRole === 'admin') && financeView === 'receivables';
  const [activeTab, setActiveTab] = useState<InvoiceStatus | 'All'>('All');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [values, setValues] = useState<ValueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [section, setSection] = useState<FinanceSection>('dashboard');
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
      params.set('view', financeView);
      if (activeTab !== 'All') params.set('invoice_status', activeTab);
      const response = await fetch(`/api/driver/finance/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as {
        rows?: InvoiceRow[];
        invoiceSummary?: FinanceSummary;
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
      setValues(payload?.valueSummary ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, financeView]);

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
      await sendGeneratedInvoice(payload.invoice.id, token);
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

  const selectSection = (next: FinanceSection, tab: InvoiceStatus | 'All' = 'All') => {
    setSection(next);
    setActiveTab(tab);
    if (next === 'ready' && canGenerateInvoices) void loadEligibleJobs();
  };

  const customers = useMemo(() => {
    const map = new Map<string, { name: string; invoices: number; billed: number; outstanding: number }>();
    for (const invoice of invoices) {
      const key = invoice.client_name || 'Unknown customer';
      const current = map.get(key) ?? { name: key, invoices: 0, billed: 0, outstanding: 0 };
      current.invoices += 1;
      current.billed += Number(invoice.amount || 0);
      current.outstanding += Number(invoice.outstanding_amount || 0);
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
  }, [invoices]);

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell hideHeader>
        <div className={styles.surface} data-testid="invoice-pro-driver-finance">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}
          {generateError && <AlertBanner tone="danger">{generateError}</AlertBanner>}

          <nav className={styles.nav} aria-label="Finance navigation">
            <button className={styles.navButton} data-active={section === 'dashboard'} onClick={() => selectSection('dashboard')}>Dashboard</button>
            <button className={styles.navButton} data-active={section === 'register' && activeTab === 'All'} onClick={() => selectSection('register', 'All')}>All</button>
            {financeView === 'receivables' && <button className={styles.navButton} data-active={section === 'ready'} onClick={() => selectSection('ready')}>Ready To Invoice</button>}
            <button className={styles.navButton} data-active={section === 'register' && activeTab === 'Sent'} onClick={() => selectSection('register', 'Sent')}>Awaiting Payment</button>
            <button className={styles.navButton} data-active={section === 'register' && activeTab === 'Paid'} onClick={() => selectSection('register', 'Paid')}>Paid</button>
            <button className={styles.navButton} data-active={section === 'customers'} onClick={() => selectSection('customers', 'All')}>{financeView === 'payables' ? 'Suppliers' : 'Customers'}</button>
            <button className={styles.navButton} data-active={section === 'register' && activeTab === 'Cancelled'} onClick={() => selectSection('register', 'Cancelled')}>Archive</button>
            <button className={styles.navButton} data-active={section === 'statements'} onClick={() => selectSection('statements', 'All')}>Statements</button>
          </nav>

          <header className={styles.hero}>
            <div>
              <div className={styles.eyebrow}>Finance overview</div>
              <h1 className={styles.title}>{financeView === 'payables' ? 'Control your payables.' : 'Command your cashflow.'}</h1>
              <p className={styles.subtitle}>{financeView === 'payables' ? 'Supplier invoices, settlement readiness and payment control  without the noise.' : 'Receivables, billing readiness and payment performance  without the noise.'}</p>
            </div>
            <div className={styles.heroActions}>
              <button className={styles.button} onClick={() => setSection('statements')}>Statements</button>
              <button className={styles.button} onClick={() => router.push(financeView === 'receivables' ? '/driver/finance?view=payables' : '/driver/finance')}>{financeView === 'receivables' ? 'Accounts Payable' : 'Accounts Receivable'}</button>
              {canGenerateInvoices && <button className={[styles.button, styles.buttonPrimary].join(' ')} onClick={() => selectSection('ready')}>+ Create invoice</button>}
            </div>
          </header>

          <section className={styles.metrics} aria-label="Finance summary">
            <article className={[styles.metric, styles.metricGold].join(' ')}>
              <div className={styles.metricLabel}>{financeView === 'receivables' ? 'Ready to invoice' : 'Open payables'}</div>
              <div className={styles.metricValue}>{financeView === 'receivables' ? money(eligibleJobs.reduce((sum, job) => sum + Number(job.invoice?.amount ?? job.agreed_amount ?? job.direct_invoice_amount ?? 0), 0)) : money(values?.outstanding ?? 0)}</div>
              <div className={styles.metricSub}>{financeView === 'receivables' ? eligibleJobs.length + ' jobs' : (counts.All - counts.Paid - counts.Cancelled) + ' invoices'}</div>
            </article>
            <article className={[styles.metric, styles.metricBlue].join(' ')}>
              <div className={styles.metricLabel}>Awaiting payment</div>
              <div className={styles.metricValue}>{money(values?.outstanding ?? 0)}</div>
              <div className={styles.metricSub}>{counts.Sent + counts.Overdue + counts.Disputed} invoices</div>
            </article>
            <article className={[styles.metric, styles.metricGreen].join(' ')}>
              <div className={styles.metricLabel}>Paid</div>
              <div className={styles.metricValue}>{money(values?.paid ?? 0)}</div>
              <div className={styles.metricSub}>{counts.Paid} invoices</div>
            </article>
            <article className={[styles.metric, styles.metricNavy].join(' ')}>
              <div className={styles.metricLabel}>Currency</div>
              <div className={styles.metricValue}>GBP</div>
              <div className={styles.metricSub}>Primary finance ledger</div>
            </article>
          </section>

          {section === 'dashboard' && (
            <section className={styles.dashboard}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><div className={styles.panelKicker}>Cashflow workspace</div><h2 className={styles.panelTitle}>{financeView === 'receivables' ? 'Receivables flow' : 'Payables flow'}</h2></div>
                  <button className={styles.button} onClick={() => selectSection('register', 'All')}>Open register </button>
                </div>
                <div className={styles.flow}>
                  <div className={styles.flowRow}><span className={[styles.dot, styles.dotGold].join(' ')} /><div><div className={styles.flowLabel}>{financeView === 'receivables' ? 'Ready to invoice' : 'Open payables'}</div><div className={styles.flowSub}>{financeView === 'receivables' ? 'POD-complete work waiting to be billed' : 'Supplier invoices awaiting settlement'}</div></div><strong className={styles.flowValue}>{financeView === 'receivables' ? money(eligibleJobs.reduce((sum, job) => sum + Number(job.invoice?.amount ?? job.agreed_amount ?? job.direct_invoice_amount ?? 0), 0)) : money(values?.outstanding ?? 0)}</strong></div>
                  <div className={styles.flowRow}><span className={[styles.dot, styles.dotBlue].join(' ')} /><div><div className={styles.flowLabel}>Awaiting payment</div><div className={styles.flowSub}>Issued invoices still open</div></div><strong className={styles.flowValue}>{money(values?.outstanding ?? 0)}</strong></div>
                  <div className={styles.flowRow}><span className={[styles.dot, styles.dotGreen].join(' ')} /><div><div className={styles.flowLabel}>Paid</div><div className={styles.flowSub}>Completed settlements</div></div><strong className={styles.flowValue}>{money(values?.paid ?? 0)}</strong></div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:14,flexWrap:'wrap'}}>
                  <span className={styles.registerMeta}>Gross {money(values?.gross ?? 0)}  Net {money(values?.net ?? 0)}  VAT {money(values?.vat ?? 0)}</span>
                  <span className={styles.registerMeta}>Outstanding {money(values?.outstanding ?? 0)}</span>
                </div>
              </article>

              <aside className={styles.panel}>
                <div className={styles.panelHeader}><div><div className={styles.panelKicker}>Action centre</div><h2 className={styles.panelTitle}>What needs you</h2></div><span className={styles.registerMeta}>{counts.Overdue + counts.Disputed} items</span></div>
                {counts.Overdue + counts.Disputed === 0 ? (
                  <div className={styles.clear}><span className={styles.clearIcon}></span><div><div className={styles.actionLabel}>All clear</div><div className={styles.actionSub}>No finance items need your attention.</div></div></div>
                ) : (
                  <div className={styles.actionCard}><strong>{counts.Overdue} overdue  {counts.Disputed} disputed</strong></div>
                )}
                {canGenerateInvoices && <button className={styles.actionButton} onClick={() => selectSection('ready')}><span className={styles.actionIcon}></span><span><span className={styles.actionLabel}>Create invoice</span><span className={styles.actionSub}>Start from a completed POD job</span></span><span className={styles.arrow}></span></button>}
                <button className={styles.actionButton} onClick={() => selectSection('customers', 'All')}><span className={styles.actionIcon}></span><span><span className={styles.actionLabel}>{financeView === 'payables' ? 'Suppliers' : 'Customers'}</span><span className={styles.actionSub}>Review account performance</span></span><span className={styles.arrow}></span></button>
                <button className={styles.actionButton} onClick={() => setSection('statements')}><span className={styles.actionIcon}></span><span><span className={styles.actionLabel}>Statements</span><span className={styles.actionSub}>Review finance summaries</span></span><span className={styles.arrow}></span></button>
              </aside>
            </section>
          )}

          {section === 'ready' && financeView === 'receivables' && (
            <section className={styles.register}>
              <div className={styles.registerHead}><div><div className={styles.panelKicker}>Direct settlements</div><div className={styles.registerTitle}>POD-complete jobs ready to invoice</div></div><button className={styles.button} onClick={() => void loadEligibleJobs()} disabled={jobsLoading}>Refresh</button></div>
              {jobsLoading ? <div className={styles.empty}><strong>Loading completed jobs</strong></div> : eligibleJobs.length === 0 ? (
                <div className={styles.empty}><strong>No eligible invoices</strong><span>No delivered jobs with completed POD are currently available.</span></div>
              ) : (
                <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Job</th><th>Route</th><th>Customer</th><th>Amount</th><th>Invoice</th><th>Action</th></tr></thead><tbody>{eligibleJobs.map((job) => {
                  const commercialAmount = job.invoice?.amount ?? job.agreed_amount ?? job.direct_invoice_amount;
                  return <tr key={job.id}><td>{'JOB-' + job.id.slice(0,8).toUpperCase()}</td><td>{job.pickup_location ?? 'Collection'}  {job.delivery_location ?? 'Delivery'}</td><td>{job.client_name ?? 'Marketplace customer'}</td><td>{commercialAmount == null ? 'TBC' : money(commercialAmount, job.currency)}</td><td>{job.invoice?.invoice_number ?? 'Ready for draft'}</td><td><button className={[styles.button, styles.buttonPrimary].join(' ')} disabled={generatingJobId === job.id} onClick={() => void generateInvoice(job.id)}>{generatingJobId === job.id ? 'Preparing' : job.invoice ? 'Open invoice' : 'Create invoice'}</button></td></tr>;
                })}</tbody></table></div>
              )}
            </section>
          )}

          {section === 'customers' && (
            <section className={styles.register}>
              <div className={styles.registerHead}><div><div className={styles.panelKicker}>Account performance</div><div className={styles.registerTitle}>{financeView === 'payables' ? 'Suppliers' : 'Customers'}</div></div><span className={styles.registerMeta}>{customers.length} accounts</span></div>
              {loading ? <div className={styles.empty}><strong>Loading accounts</strong></div> : customers.length === 0 ? <div className={styles.empty}><strong>No account activity yet</strong></div> : (
                <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Account</th><th>Invoices</th><th>Billed</th><th>Outstanding</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.name}><td><strong>{customer.name}</strong></td><td>{customer.invoices}</td><td>{money(customer.billed)}</td><td>{money(customer.outstanding)}</td></tr>)}</tbody></table></div>
              )}
            </section>
          )}

          {section === 'statements' && (
            <section className={styles.panel}>
              <div className={styles.panelKicker}>Statements</div><h2 className={styles.panelTitle}>Finance statement</h2>
              <div className={styles.flow} style={{marginTop:14}}>
                <div className={styles.flowRow}><span className={[styles.dot, styles.dotBlue].join(' ')} /><div><div className={styles.flowLabel}>Gross invoiced</div><div className={styles.flowSub}>Current company finance view</div></div><strong className={styles.flowValue}>{money(values?.gross ?? 0)}</strong></div>
                <div className={styles.flowRow}><span className={[styles.dot, styles.dotGreen].join(' ')} /><div><div className={styles.flowLabel}>Recorded paid</div><div className={styles.flowSub}>Verified payment history</div></div><strong className={styles.flowValue}>{money(values?.paid ?? 0)}</strong></div>
                <div className={styles.flowRow}><span className={[styles.dot, styles.dotGold].join(' ')} /><div><div className={styles.flowLabel}>Outstanding</div><div className={styles.flowSub}>Open balance</div></div><strong className={styles.flowValue}>{money(values?.outstanding ?? 0)}</strong></div>
              </div>
            </section>
          )}

          {section === 'register' && (
            <section className={styles.register}>
              <div className={styles.registerHead}><div><div className={styles.panelKicker}>Invoice operations</div><div className={styles.registerTitle}>{financeView === 'payables' ? 'Accounts Payable' : 'Accounts Receivable'}</div></div><div className={styles.heroActions}><span className={styles.registerMeta}>{invoices.length} invoices</span><button className={styles.button} onClick={() => void loadInvoices()} disabled={loading}>Refresh</button></div></div>
              <div className={styles.tabStrip} role="tablist" aria-label="Invoice states">{STATUS_TABS.map((tab) => <button key={tab.id} className={styles.tabButton} data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label} {counts[tab.id]}</button>)}</div>
              {loading ? <div className={styles.empty}><strong>Loading invoices</strong></div> : invoices.length === 0 ? (
                <div className={styles.empty}><strong>No invoices in this view</strong><span>{canGenerateInvoices ? 'Create an invoice from a completed job or choose another filter.' : 'Choose another invoice/payment filter or refresh the register.'}</span></div>
              ) : (
                <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Invoice</th><th>{financeView === 'payables' ? 'Supplier / job' : 'Customer / job'}</th><th>Due</th><th>Total</th><th>Invoice state</th><th>Payment</th><th>Outstanding</th><th>Action</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong><div className={styles.registerMeta}>{date(invoice.invoice_date)}</div></td><td><strong>{invoice.client_name}</strong><div className={styles.registerMeta}>{invoice.job_id ? 'Job #' + invoice.job_id.slice(0,8).toUpperCase() : invoice.job_ref}</div></td><td>{date(invoice.due_date)}</td><td><strong>{money(invoice.amount, invoice.currency)}</strong><div className={styles.registerMeta}>Net {money(invoice.net_amount, invoice.currency)}  VAT {money(invoice.vat_amount, invoice.currency)}</div></td><td><StatusBadge value={invoice.status} tone={statusTone(invoice.status)} /></td><td><StatusBadge value={invoice.payment_status.replace(/_/g,' ')} tone={paymentTone(invoice.payment_status)} /></td><td>{money(invoice.outstanding_amount, invoice.currency)}</td><td><button className={styles.button} onClick={() => router.push('/driver/finance/invoices/' + invoice.id)}>Open</button></td></tr>)}</tbody></table></div>
              )}
            </section>
          )}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
