'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { AGING_BUCKET_LABELS, type AgingBucket } from '../../../lib/finance/accounts';
import { AlertBanner, StatusBadge } from './WorkspaceUI';
import styles from './InvoiceProFinance.module.css';

type Role = 'carrier' | 'broker' | 'customer';
type View = 'dashboard' | 'all' | 'receivable' | 'payable' | 'ready' | 'awaiting' | 'overdue' | 'paid' | 'customers' | 'counterparties' | 'aging' | 'archive' | 'statements';
type Invoice = {
  id: string;
  invoiceNumber: string;
  jobId: string | null;
  counterpartyName: string;
  direction: 'receivable' | 'payable';
  lifecycle: 'draft' | 'awaiting_payment' | 'overdue' | 'paid' | 'archive';
  invoiceStatus: string;
  paymentStatus: string;
  currency: string;
  net: number;
  vat: number;
  gross: number;
  paidAmount: number;
  outstandingAmount: number;
  vatRate: number;
  invoiceDate: string | null;
  dueDate: string | null;
  agingBucket: AgingBucket;
};
type ReadyJob = { id: string; pickupLocation: string | null; deliveryLocation: string | null; clientName: string | null; updatedAt: string | null };
type Counterparty = {
  id: string;
  name: string;
  customerId: string;
  receivable: number;
  payable: number;
  overdue: number;
  invoices: number;
  totalInvoicedCount: number;
  totalInvoicedNet: number;
  totalInvoicedGross: number;
  paymentsReceivedCount: number;
  paymentsReceivedNet: number;
  paymentsReceivedGross: number;
};
type Payload = {
  invoices: Invoice[];
  readyToInvoice: ReadyJob[];
  counterparties: Counterparty[];
  summary: { receivableOutstanding: number; payableOutstanding: number; overdueCount: number; overdueValue: number; paidValue: number; readyToInvoiceCount: number; receivableAging: Record<AgingBucket, number>; payableAging: Record<AgingBucket, number> };
  generatedAt?: string;
  note?: string;
  error?: string;
};

const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value || 0));
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadCsv(filename: string, columns: unknown[], body: unknown[][]) {
  const csv = [columns, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function downloadRows(rows: Invoice[]) {
  downloadCsv(
    'xdrive-finance-control.csv',
    ['Direction', 'Invoice', 'Job', 'Counterparty', 'Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Currency', 'Due', 'Aging', 'Lifecycle'],
    rows.map((invoice) => [invoice.direction, invoice.invoiceNumber, invoice.jobId ?? '', invoice.counterpartyName, invoice.net, invoice.vat, invoice.gross, invoice.paidAmount, invoice.outstandingAmount, invoice.currency, invoice.dueDate ?? '', AGING_BUCKET_LABELS[invoice.agingBucket], invoice.lifecycle]),
  );
}

function downloadCustomers(rows: Counterparty[]) {
  downloadCsv(
    'xdrive-accounts-receivable-customers.csv',
    ['Customer ID', 'Customer', 'Total invoiced Number', 'Total invoiced Net', 'Total invoiced Gross', 'Payment received Number', 'Payment received Net', 'Payment received Gross'],
    rows.map((customer) => [
      customer.customerId,
      customer.name,
      customer.totalInvoicedCount,
      customer.totalInvoicedNet,
      customer.totalInvoicedGross,
      customer.paymentsReceivedCount,
      customer.paymentsReceivedNet,
      customer.paymentsReceivedGross,
    ]),
  );
}

const detailHref = (role: Role, invoice: Invoice) => {
  if (role === 'customer') return `/customer/invoices/${invoice.id}`;
  if (role === 'broker') return invoice.direction === 'receivable'
    ? `/broker/customer-invoices/${invoice.id}`
    : `/broker/carrier-costs/${invoice.id}`;
  return `/admin/invoices/${invoice.id}`;
};

export function WorkspaceFinanceControl({ role }: { role: Role }) {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError('Your session has expired. Please sign in again.'); setLoading(false); return; }
    try {
      const response = await fetch('/api/workspace/finance/control', { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => null) as Payload | null;
      if (!response.ok || !body) throw new Error(body?.error ?? 'Finance control could not be loaded.');
      setPayload(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Finance control could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invoices = useMemo(() => payload?.invoices ?? [], [payload?.invoices]);
  const visibleInvoices = useMemo(() => {
    const scoped = role === 'carrier'
      ? invoices.filter((invoice) => invoice.direction === 'receivable')
      : invoices;
    if (view === 'dashboard' || view === 'all' || view === 'customers' || view === 'counterparties' || view === 'ready' || view === 'aging' || view === 'statements') return scoped;
    if (view === 'receivable') return invoices.filter((invoice) => invoice.direction === 'receivable');
    if (view === 'payable') return invoices.filter((invoice) => invoice.direction === 'payable');
    if (view === 'awaiting') return scoped.filter((invoice) => invoice.lifecycle === 'awaiting_payment' || invoice.lifecycle === 'overdue');
    return scoped.filter((invoice) => invoice.lifecycle === view);
  }, [invoices, role, view]);
  const summary = payload?.summary;
  const customers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    return (payload?.counterparties ?? [])
      .filter((counterparty) => counterparty.totalInvoicedCount > 0)
      .filter((counterparty) => !query
        || counterparty.name.toLowerCase().includes(query)
        || counterparty.customerId.toLowerCase().includes(query));
  }, [customerQuery, payload?.counterparties]);
  const showReceivables = role !== 'customer';
  const tabs: Array<[View, string]> = role === 'carrier'
    ? [
      ['dashboard', 'Dashboard'], ['all', 'All'], ['ready', 'Ready to Invoice'], ['awaiting', 'Awaiting Payment'],
      ['paid', 'Paid'], ['customers', 'Customers'], ['archive', 'Archive'], ['statements', 'Statements'],
    ]
    : [
      ['dashboard', 'Dashboard'], ['all', 'All'],
      ...(role === 'customer' ? [] : [['receivable', 'Accounts Receivable'] as [View, string]]),
      ['payable', 'Accounts Payable'],
      ...(role === 'customer' ? [] : [['ready', 'Ready to Invoice'] as [View, string]]),
      ['awaiting', 'Awaiting Payment'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['aging', 'Aging'],
      ['counterparties', 'Counterparties'], ['archive', 'Archive'], ['statements', 'Statements'],
    ];

  return (
    <div data-testid={'workspace-finance-control-' + role} className={styles.surface}>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      <nav className={styles.nav} aria-label="Finance navigation">
        {tabs.map(([id, label]) => (
          <button key={id} className={styles.navButton} data-active={view === id} onClick={() => setView(id)}>{label}</button>
        ))}
      </nav>

      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Finance overview</div>
          <h1 className={styles.title}>{role === 'customer' ? 'Control your payables.' : 'Command your cashflow.'}</h1>
          <p className={styles.subtitle}>{role === 'customer' ? 'Supplier invoices, due dates and settlement performance  without the noise.' : 'Receivables, billing readiness and payment performance  without the noise.'}</p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.button} onClick={() => setView('statements')}>Statements</button>
          <button className={styles.button} onClick={() => void load()} disabled={loading}>Refresh</button>
          <button className={styles.button} onClick={() => downloadRows(visibleInvoices)} disabled={!visibleInvoices.length}>Export CSV</button>
          {role !== 'customer' && <button className={[styles.button, styles.buttonPrimary].join(' ')} onClick={() => setView('ready')}>+ Create invoice</button>}
        </div>
      </header>

      <section className={styles.metrics}>
        <article className={[styles.metric, styles.metricGold].join(' ')}>
          <div className={styles.metricLabel}>{role === 'customer' ? 'Accounts payable' : 'Ready to invoice'}</div>
          <div className={styles.metricValue}>{role === 'customer' ? money(summary?.payableOutstanding ?? 0) : String(summary?.readyToInvoiceCount ?? 0)}</div>
          <div className={styles.metricSub}>{role === 'customer' ? 'Open supplier balance' : (summary?.readyToInvoiceCount ?? 0) + ' jobs'}</div>
        </article>
        <article className={[styles.metric, styles.metricBlue].join(' ')}>
          <div className={styles.metricLabel}>{role === 'customer' ? 'Outstanding' : 'Awaiting payment'}</div>
          <div className={styles.metricValue}>{money(role === 'customer' ? summary?.payableOutstanding ?? 0 : summary?.receivableOutstanding ?? 0)}</div>
          <div className={styles.metricSub}>{summary?.overdueCount ?? 0} overdue</div>
        </article>
        <article className={[styles.metric, styles.metricGreen].join(' ')}>
          <div className={styles.metricLabel}>Paid</div>
          <div className={styles.metricValue}>{money(summary?.paidValue ?? 0)}</div>
          <div className={styles.metricSub}>Recorded settlements</div>
        </article>
        <article className={[styles.metric, styles.metricNavy].join(' ')}>
          <div className={styles.metricLabel}>Currency</div>
          <div className={styles.metricValue}>GBP</div>
          <div className={styles.metricSub}>Primary finance ledger</div>
        </article>
      </section>

      {view === 'dashboard' && (
        <section className={styles.dashboard}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><div className={styles.panelKicker}>Cashflow workspace</div><h2 className={styles.panelTitle}>{role === 'customer' ? 'Payables flow' : 'Receivables flow'}</h2></div>
              <button className={styles.button} onClick={() => setView('all')}>Open register </button>
            </div>
            <div className={styles.flow}>
              <div className={styles.flowRow}><span className={[styles.dot, styles.dotGold].join(' ')} /><div><div className={styles.flowLabel}>{role === 'customer' ? 'Accounts payable' : 'Ready to invoice'}</div><div className={styles.flowSub}>{role === 'customer' ? 'Supplier invoices waiting for settlement' : 'Approved work waiting to be billed'}</div></div><strong className={styles.flowValue}>{role === 'customer' ? money(summary?.payableOutstanding ?? 0) : String(summary?.readyToInvoiceCount ?? 0)}</strong></div>
              <div className={styles.flowRow}><span className={[styles.dot, styles.dotBlue].join(' ')} /><div><div className={styles.flowLabel}>Awaiting payment</div><div className={styles.flowSub}>Issued invoices still open</div></div><strong className={styles.flowValue}>{money(role === 'customer' ? summary?.payableOutstanding ?? 0 : summary?.receivableOutstanding ?? 0)}</strong></div>
              <div className={styles.flowRow}><span className={[styles.dot, styles.dotGreen].join(' ')} /><div><div className={styles.flowLabel}>Paid</div><div className={styles.flowSub}>Completed settlements</div></div><strong className={styles.flowValue}>{money(summary?.paidValue ?? 0)}</strong></div>
            </div>
          </article>
          <aside className={styles.panel}>
            <div className={styles.panelHeader}><div><div className={styles.panelKicker}>Action centre</div><h2 className={styles.panelTitle}>What needs you</h2></div><span className={styles.registerMeta}>{summary?.overdueCount ?? 0} items</span></div>
            {(summary?.overdueCount ?? 0) === 0 ? <div className={styles.clear}><span className={styles.clearIcon}></span><div><div className={styles.actionLabel}>All clear</div><div className={styles.actionSub}>No finance items need your attention.</div></div></div> : <div className={styles.actionCard}><strong>{summary?.overdueCount ?? 0} overdue  {money(summary?.overdueValue ?? 0)}</strong></div>}
            {role !== 'customer' && <button className={styles.actionButton} onClick={() => setView('ready')}><span className={styles.actionIcon}></span><span><span className={styles.actionLabel}>Create invoice</span><span className={styles.actionSub}>Start from completed work</span></span><span className={styles.arrow}></span></button>}
            <button className={styles.actionButton} onClick={() => setView(role === 'carrier' ? 'customers' : 'counterparties')}><span className={styles.actionIcon}></span><span><span className={styles.actionLabel}>{role === 'customer' ? 'Suppliers' : 'Customers'}</span><span className={styles.actionSub}>Review account performance</span></span><span className={styles.arrow}></span></button>
            <button className={styles.actionButton} onClick={() => setView('statements')}><span className={styles.actionIcon}></span><span><span className={styles.actionLabel}>Statements</span><span className={styles.actionSub}>Review finance summaries</span></span><span className={styles.arrow}></span></button>
          </aside>
        </section>
      )}

      {view === 'ready' && (
        <section className={styles.register}>
          <div className={styles.registerHead}><div><div className={styles.panelKicker}>Invoice readiness</div><div className={styles.registerTitle}>Ready to Invoice</div></div><span className={styles.registerMeta}>{payload?.readyToInvoice?.length ?? 0} jobs</span></div>
          {(payload?.readyToInvoice ?? []).length === 0 ? <div className={styles.empty}><strong>{loading ? 'Loading invoice readiness' : 'No completed jobs waiting for an invoice'}</strong></div> : (
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Job</th><th>Customer</th><th>Route</th><th>Updated</th><th>Action</th></tr></thead><tbody>{(payload?.readyToInvoice ?? []).map((job) => <tr key={job.id}><td>{'XDL-' + job.id.slice(0,8).toUpperCase()}</td><td>{job.clientName ?? 'Customer'}</td><td>{job.pickupLocation ?? 'Collection'}  {job.deliveryLocation ?? 'Delivery'}</td><td>{date(job.updatedAt)}</td><td><button className={styles.button} onClick={() => router.push(role === 'broker' ? '/broker/jobs' : '/admin/jobs/' + job.id)}>Open job</button></td></tr>)}</tbody></table></div>
          )}
        </section>
      )}

      {view === 'customers' && role === 'carrier' && (
        <section className={styles.register}>
          <div className={styles.registerHead}><div><div className={styles.panelKicker}>Account performance</div><div className={styles.registerTitle}>Customers</div></div><button className={styles.button} onClick={() => downloadCustomers(customers)} disabled={!customers.length}>Export CSV</button></div>
          <div style={{padding:14,borderBottom:'1px solid #e4eaf1'}}><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Customer name or ID" style={{minHeight:38,width:'min(360px,100%)',border:'1px solid #cbd5e1',borderRadius:8,padding:'0 12px'}} /></div>
          {customers.length === 0 ? <div className={styles.empty}><strong>{loading ? 'Loading customers' : 'No customer invoice activity'}</strong></div> : (
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Customer ID</th><th>Customer</th><th>Invoices</th><th>Net</th><th>Gross</th><th>Payments</th><th>Paid gross</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td>{customer.customerId || ''}</td><td><strong>{customer.name}</strong></td><td>{customer.totalInvoicedCount}</td><td>{money(customer.totalInvoicedNet)}</td><td>{money(customer.totalInvoicedGross)}</td><td>{customer.paymentsReceivedCount}</td><td>{money(customer.paymentsReceivedGross)}</td></tr>)}</tbody></table></div>
          )}
        </section>
      )}

      {(view === 'aging' || view === 'statements') && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.panelKicker}>{view === 'statements' ? 'Statements' : 'Aging'}</div><h2 className={styles.panelTitle}>{view === 'statements' ? 'Finance statement' : 'Aging analysis'}</h2></div></div>
          <div className={styles.flow}>
            {(Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]).map((bucket) => <div className={styles.flowRow} key={bucket}><span className={styles.dot} /><div><div className={styles.flowLabel}>{AGING_BUCKET_LABELS[bucket]}</div><div className={styles.flowSub}>{showReceivables ? 'Receivable / payable exposure' : 'Payable exposure'}</div></div><strong className={styles.flowValue}>{showReceivables ? money(summary?.receivableAging?.[bucket] ?? 0) : money(summary?.payableAging?.[bucket] ?? 0)}</strong></div>)}
          </div>
        </section>
      )}

      {view === 'counterparties' && (
        <section className={styles.register}>
          <div className={styles.registerHead}><div><div className={styles.panelKicker}>Accounts</div><div className={styles.registerTitle}>Counterparties</div></div></div>
          {(payload?.counterparties ?? []).length === 0 ? <div className={styles.empty}><strong>{loading ? 'Loading counterparties' : 'No counterparty finance activity'}</strong></div> : (
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Counterparty</th><th>Invoices</th><th>Receivable</th><th>Payable</th><th>Overdue</th></tr></thead><tbody>{(payload?.counterparties ?? []).map((counterparty) => <tr key={counterparty.id}><td><strong>{counterparty.name}</strong></td><td>{counterparty.invoices}</td><td>{money(counterparty.receivable)}</td><td>{money(counterparty.payable)}</td><td>{money(counterparty.overdue)}</td></tr>)}</tbody></table></div>
          )}
        </section>
      )}

      {!['dashboard','ready','customers','aging','statements','counterparties'].includes(view) && (
        <section className={styles.register}>
          <div className={styles.registerHead}><div><div className={styles.panelKicker}>Invoice operations</div><div className={styles.registerTitle}>{view === 'receivable' ? 'Accounts Receivable' : view === 'payable' ? 'Accounts Payable' : 'Invoice register'}</div></div><span className={styles.registerMeta}>{visibleInvoices.length} records</span></div>
          {visibleInvoices.length === 0 ? <div className={styles.empty}><strong>{loading ? 'Loading finance control' : 'No finance records in this view'}</strong></div> : (
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Direction</th><th>Invoice</th><th>Counterparty</th><th>Net</th><th>VAT</th><th>Gross</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Aging</th><th>State</th><th>Action</th></tr></thead><tbody>{visibleInvoices.map((invoice) => <tr key={invoice.id}><td><StatusBadge value={invoice.direction === 'receivable' ? 'AR' : 'AP'} tone={invoice.direction === 'receivable' ? 'blue' : 'orange'} /></td><td><strong>{invoice.invoiceNumber}</strong></td><td>{invoice.counterpartyName}</td><td>{money(invoice.net, invoice.currency)}</td><td>{money(invoice.vat, invoice.currency)}</td><td>{money(invoice.gross, invoice.currency)}</td><td>{money(invoice.paidAmount, invoice.currency)}</td><td>{money(invoice.outstandingAmount, invoice.currency)}</td><td>{date(invoice.dueDate)}</td><td>{AGING_BUCKET_LABELS[invoice.agingBucket]}</td><td><StatusBadge value={invoice.lifecycle.replace(/_/g,' ')} tone={invoice.lifecycle === 'paid' ? 'green' : invoice.lifecycle === 'overdue' ? 'red' : invoice.lifecycle === 'archive' ? 'grey' : 'orange'} /></td><td><button className={styles.button} onClick={() => router.push(detailHref(role, invoice))}>Open</button></td></tr>)}</tbody></table></div>
          )}
        </section>
      )}

      {payload?.note ? <div className={styles.registerMeta}>{payload.note}</div> : null}
    </div>
  );
}
