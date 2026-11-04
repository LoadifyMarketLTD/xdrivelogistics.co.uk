'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { AlertBanner, StatusBadge } from '../../../components/workspace/WorkspaceUI';
import { getAuthHeader } from '../../_lib/getAuthHeader';
import { InvoiceProDashboard, InvoiceProHero, InvoiceProMetrics, InvoiceProMasterTabs, InvoiceProRegister, InvoiceProSurface } from '../../../components/workspace/InvoiceProMasterFrame';
import styles from '../../../components/workspace/InvoiceProFinance.module.css';

type GlobalInvoice = {
  id: string;
  invoice_number: string | null;
  company_name: string | null;
  client_name: string | null;
  status: string | null;
  payment_status: string | null;
  amount: number | null;
  currency: string | null;
  invoice_date: string | null;
  due_date: string | null;
};
type View = 'dashboard' | 'all' | 'overdue' | 'paid' | 'archive';
const currencyAmount = (value: number | null, currency: string | null) => {
  if (value == null) return 'Not supplied';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(value); }
  catch { return `${currency ?? 'Currency unknown'} ${value.toFixed(2)}`; }
};
const shortDate = (value: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString('en-GB');
};

export default function SuperAdminInvoicesPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('dashboard');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GlobalInvoice[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      const auth = await getAuthHeader();
      if (!auth) { if (!cancelled) { setRows([]); setError('No active session.'); setLoading(false); } return; }
      try {
        const response = await fetch(`/api/super-admin/finance?section=invoices&page=${page}&limit=100`, { headers: { Authorization: auth }, cache: 'no-store' });
        const body = await response.json().catch(() => null) as { rows?: GlobalInvoice[]; pagination?: { total?: number; hasNextPage?: boolean }; error?: string } | null;
        if (!response.ok) throw new Error(body?.error ?? 'The invoice ledger is unavailable.');
        if (!cancelled) {
          setRows(Array.isArray(body?.rows) ? body.rows : []);
          setTotal(typeof body?.pagination?.total === 'number' ? body.pagination.total : null);
          setHasNext(body?.pagination?.hasNextPage === true);
        }
      } catch (reason) {
        if (!cancelled) { setRows([]); setTotal(null); setHasNext(false); setError(reason instanceof Error ? reason.message : 'Unable to load invoices.'); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [page, refreshKey]);

  const visible = useMemo(() => rows.filter((row) => {
    const status = String(row.status ?? '').toLowerCase();
    if (view === 'overdue') return status === 'overdue';
    if (view === 'paid') return status === 'paid';
    if (view === 'archive') return ['cancelled', 'void', 'refunded'].includes(status);
    return true;
  }), [rows, view]);
  const pageCompanies = new Set(rows.map((row) => row.company_name).filter(Boolean)).size;
  const pageCurrencies = new Set(rows.map((row) => row.currency).filter(Boolean)).size;
  const overdue = rows.filter((row) => String(row.status).toLowerCase() === 'overdue').length;
  const paid = rows.filter((row) => String(row.status).toLowerCase() === 'paid').length;
  const open = (id: string) => router.push(`/super-admin/finance/invoices/${encodeURIComponent(id)}`);

  return <ProtectedRoute allowedRoles={['owner']}>
    <InvoiceProSurface data-testid="approved-super-admin-invoices">
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      <InvoiceProMasterTabs label="Invoice navigation" tabs={([
        ['dashboard', 'Dashboard'], ['all', 'All'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['archive', 'Archive'],
      ] as const).map(([id, label]) => ({ id, label, active: view === id, onSelect: () => setView(id) }))} />
      <InvoiceProHero>
        <div><div className={styles.eyebrow}>Finance overview</div><h1 className={styles.title}>Platform invoices.</h1>
          <p className={styles.subtitle}>Cross-company invoice oversight. Monetary totals are not combined across currencies.</p></div>
        <div className={styles.heroActions}>
          <button className={styles.button} type="button" onClick={() => setView('all')}>Invoice register</button>
          <button className={styles.button} type="button" disabled={loading} onClick={refresh}>Refresh</button>
        </div>
      </InvoiceProHero>
      <InvoiceProMetrics aria-label="Verified invoice metrics">
        <article className={[styles.metric, styles.metricGold].join(' ')}><div className={styles.metricLabel}>Platform invoices</div><div className={styles.metricValue}>{total ?? '—'}</div><div className={styles.metricSub}>Exact backend record count</div></article>
        <article className={[styles.metric, styles.metricBlue].join(' ')}><div className={styles.metricLabel}>Companies</div><div className={styles.metricValue}>{pageCompanies}</div><div className={styles.metricSub}>Represented on this page</div></article>
        <article className={[styles.metric, styles.metricGreen].join(' ')}><div className={styles.metricLabel}>Paid</div><div className={styles.metricValue}>{paid}</div><div className={styles.metricSub}>On this page only</div></article>
        <article className={[styles.metric, styles.metricNavy].join(' ')}><div className={styles.metricLabel}>Currencies</div><div className={styles.metricValue}>{pageCurrencies}</div><div className={styles.metricSub}>On this page only</div></article>
      </InvoiceProMetrics>
      {view === 'dashboard' && <InvoiceProDashboard>
        <article className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.panelKicker}>Platform finance</div><h2 className={styles.panelTitle}>Invoice oversight</h2></div><button className={styles.button} onClick={() => setView('all')}>Open register</button></div>
          <div className={styles.flow}><div className={styles.flowRow}><span className={[styles.dot, styles.dotGold].join(' ')} /><div><div className={styles.flowLabel}>Verified invoice records</div><div className={styles.flowSub}>Across platform companies</div></div><strong className={styles.flowValue}>{total ?? 'Unavailable'}</strong></div>
            <div className={styles.flowRow}><span className={[styles.dot, styles.dotBlue].join(' ')} /><div><div className={styles.flowLabel}>Overdue</div><div className={styles.flowSub}>On current page</div></div><strong className={styles.flowValue}>{overdue}</strong></div>
            <div className={styles.flowRow}><span className={[styles.dot, styles.dotGreen].join(' ')} /><div><div className={styles.flowLabel}>Paid</div><div className={styles.flowSub}>On current page</div></div><strong className={styles.flowValue}>{paid}</strong></div></div>
        </article>
        <aside className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.panelKicker}>Action centre</div><h2 className={styles.panelTitle}>Review invoices</h2></div></div>
          <button className={styles.actionButton} onClick={() => setView('overdue')}><span className={styles.actionIcon} /><span><span className={styles.actionLabel}>Overdue invoices</span><span className={styles.actionSub}>Review current-page records</span></span><span className={styles.arrow}>›</span></button>
          <button className={styles.actionButton} onClick={() => setView('all')}><span className={styles.actionIcon} /><span><span className={styles.actionLabel}>Company invoice ledger</span><span className={styles.actionSub}>Open invoice details and reconciliation</span></span><span className={styles.arrow}>›</span></button>
        </aside>
      </InvoiceProDashboard>}
      {view !== 'dashboard' && <InvoiceProRegister>
        <div className={styles.registerHead}><div><div className={styles.panelKicker}>Invoice operations</div><div className={styles.registerTitle}>{view === 'all' ? 'Invoice register' : view === 'overdue' ? 'Overdue invoices' : view === 'paid' ? 'Paid invoices' : 'Archived invoices'}</div></div><span className={styles.registerMeta}>{visible.length} on this page</span></div>
        {loading ? <div className={styles.empty}><strong>Loading verified invoices</strong></div> : visible.length === 0 ? <div className={styles.empty}><strong>No invoices in this view</strong></div> :
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Invoice</th><th>Company</th><th>Customer</th><th>Amount</th><th>Due</th><th>Invoice state</th><th>Payment</th><th>Action</th></tr></thead><tbody>
            {visible.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</strong></td><td>{invoice.company_name ?? 'Not supplied'}</td><td>{invoice.client_name ?? 'Not supplied'}</td><td>{currencyAmount(invoice.amount, invoice.currency)}</td><td>{shortDate(invoice.due_date)}</td><td><StatusBadge value={invoice.status ?? 'Not supplied'} /></td><td><StatusBadge value={invoice.payment_status ?? 'Not supplied'} /></td><td><div className={styles.heroActions}><button className={styles.button} onClick={() => open(invoice.id)}>Open</button><button className={styles.button} onClick={() => open(invoice.id)} aria-label={`Reconcile invoice ${invoice.invoice_number ?? invoice.id}`}>Reconcile</button></div></td></tr>)}
          </tbody></table></div>}
        <div className={styles.registerHead}><span className={styles.registerMeta}>Page {page}{total == null ? '' : ` · ${total} platform invoices`}</span><div className={styles.heroActions}><button className={styles.button} disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className={styles.button} disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </InvoiceProRegister>}
    </InvoiceProSurface>
  </ProtectedRoute>;
}
