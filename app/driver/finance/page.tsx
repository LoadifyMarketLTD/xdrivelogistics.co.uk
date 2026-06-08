'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  toCanonicalInvoiceStatusWithDueDate,
  type CanonicalInvoiceStatus,
} from '../../../lib/invoiceStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = CanonicalInvoiceStatus;

type InvoiceRow = {
  id: string;
  invoice_number: string;
  job_ref: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  client_name: string;
  amount: number;
  currency: string;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type CompletedJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  budget_amount: number | null;
  client_name: string | null;
  status: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_TABS: Array<{ id: InvoiceStatus | 'All'; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Disputed', label: 'Disputed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  Draft:     { bg: '#fef3c7', text: '#92400e' },
  Sent:      { bg: '#e0e7ff', text: '#3730a3' },
  Overdue:   { bg: '#fee2e2', text: '#991b1b' },
  Paid:      { bg: '#d1fae5', text: '#065f46' },
  Disputed:  { bg: '#fce7f3', text: '#9d174d' },
  Cancelled: { bg: '#e2e8f0', text: '#475569' },
};

const fmtCurrency = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Component ─────────────────────────────────────────────────────────────────

export default function DriverFinancePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<InvoiceStatus | 'All'>('All');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Generate invoice from job modal state
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState('');

  const loadInvoices = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { setLoading(false); return; }

    try {
      const params = new URLSearchParams();
      if (activeTab !== 'All') params.set('status', activeTab);
      const res = await fetch(`/api/driver/finance/invoices?${params.toString()}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        setError(e.error ?? 'Failed to load invoices.');
        setLoading(false);
        return;
      }
      const json = await res.json() as { rows: InvoiceRow[]; summary: FinanceSummary };
      const normalizedRows = (json.rows ?? []).map((row) => ({
        ...row,
        status: toCanonicalInvoiceStatusWithDueDate(row.status, row.due_date),
      }));
      setInvoices(normalizedRows);
      setSummary(json.summary ?? null);
    } catch {
      setError('Network error loading invoices.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);

  const loadCompletedJobs = async () => {
    if (!isSupabaseConfigured || !user?.id) return;
    setJobsLoading(true);
    setGenerateError('');

    // Get driver row to find company
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id, company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!driverRow) { setJobsLoading(false); return; }

    // Fetch delivered/completed jobs that don't have an invoice yet created by this user
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, pickup_location, delivery_location, pickup_datetime, budget_amount, client_name, status')
      .eq('company_id', driverRow.company_id)
      .in('status', ['delivered', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(50);

    if (jobs && jobs.length > 0) {
      // Filter out jobs already invoiced by this driver
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('job_id')
        .eq('created_by', user.id)
        .not('job_id', 'is', null);

      const invoicedJobIds = new Set((existingInvoices ?? []).map((i: { job_id: string | null }) => i.job_id));
      setCompletedJobs((jobs as CompletedJob[]).filter((j) => !invoicedJobIds.has(j.id)));
    } else {
      setCompletedJobs([]);
    }

    setJobsLoading(false);
  };

  const handleOpenJobPicker = () => {
    setShowJobPicker(true);
    void loadCompletedJobs();
  };

  const handleGenerateInvoice = async (jobId: string) => {
    if (!isSupabaseConfigured || !user?.id) return;
    setGeneratingJobId(jobId);
    setGenerateError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { setGeneratingJobId(null); return; }

    try {
      const res = await fetch(`/api/driver/finance/jobs/${jobId}/generate-invoice`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json() as { invoice?: { id: string }; error?: string };
      if (!res.ok) {
        setGenerateError(json.error ?? 'Failed to generate invoice.');
        setGeneratingJobId(null);
        return;
      }
      setShowJobPicker(false);
      if (json.invoice?.id) {
        router.push(`/driver/finance/invoices/${json.invoice.id}`);
      } else {
        void loadInvoices();
      }
    } catch {
      setGenerateError('Network error generating invoice.');
    } finally {
      setGeneratingJobId(null);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #d7e0ea',
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
  };

  const tabBtnStyle = (active: boolean): CSSProperties => ({
    padding: '0.45rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: active ? '#1d4ed8' : '#f1f5f9',
    color: active ? '#fff' : '#475569',
    fontWeight: active ? 700 : 500,
    fontSize: '0.82rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  // ── Summary stats ────────────────────────────────────────────────────────────

  const summaryCards = summary
    ? [
        { label: 'Total', value: summary.total, color: '#64748b' },
        { label: 'Draft', value: summary.draft, color: STATUS_COLORS.Draft.text },
        { label: 'Sent', value: summary.sent, color: STATUS_COLORS.Sent.text },
        { label: 'Overdue', value: summary.overdue, color: STATUS_COLORS.Overdue.text },
        { label: 'Paid', value: summary.paid, color: STATUS_COLORS.Paid.text },
        { label: 'Disputed', value: summary.disputed, color: STATUS_COLORS.Disputed.text },
        { label: 'Cancelled', value: summary.cancelled, color: STATUS_COLORS.Cancelled.text },
      ]
    : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell
        subtitle="Manage your invoices, track payment records, and review invoice history."
        headerActions={
          <button
            onClick={handleOpenJobPicker}
            style={{
              padding: '0.5rem 1rem',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.83rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Generate Invoice
          </button>
        }
      >
        {/* Page title */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1.25rem' }}>
          💷 Finance Workspace
        </h2>

        {/* Summary stats */}
        {summary && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            {summaryCards.map((s) => (
              <div key={s.label} style={{ ...cardStyle, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={tabBtnStyle(activeTab === tab.id)}
            >
              {tab.label}
              {summary && tab.id !== 'All' && (
                <span style={{ marginLeft: '0.35rem', opacity: 0.75 }}>
                  ({summary[tab.id.toLowerCase() as keyof FinanceSummary] ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Invoice list */}
        <div style={cardStyle}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading invoices…</div>
          ) : error ? (
            <div style={{ padding: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
              <p style={{ margin: 0 }}>No invoices found{activeTab !== 'All' ? ` with status "${activeTab}"` : ''}.</p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem' }}>
                Click <strong>+ Generate Invoice</strong> to create one from a completed job.
              </p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <span>Invoice</span>
                <span>Client</span>
                <span>Amount</span>
                <span>Date</span>
                <span>Status</span>
              </div>
              {invoices.map((inv, i) => {
                const sc = STATUS_COLORS[inv.status] ?? { bg: '#f1f5f9', text: '#475569' };
                return (
                  <button
                    key={inv.id}
                    onClick={() => router.push(`/driver/finance/invoices/${inv.id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                      gap: '0.5rem',
                      padding: '0.8rem 1rem',
                      borderBottom: i < invoices.length - 1 ? '1px solid #f1f5f9' : 'none',
                      background: 'transparent',
                      border: 'none',
                      borderTopWidth: 0,
                      borderRightWidth: 0,
                      borderLeftWidth: 0,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1e293b' }}>
                        {inv.invoice_number}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{inv.job_ref}</div>
                    </div>
                    <div style={{ fontSize: '0.83rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.client_name}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                      {fmtCurrency(Number(inv.amount), inv.currency)}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {fmtDate(inv.invoice_date)}
                    </div>
                    <span
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: sc.bg,
                        color: sc.text,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {inv.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Job picker modal */}
        {showJobPicker && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setShowJobPicker(false)}
          >
            <div
              style={{ ...cardStyle, width: '100%', maxWidth: '580px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                  Generate Invoice from Completed Job
                </h3>
                <button
                  onClick={() => setShowJobPicker(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
                >
                  ×
                </button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem' }}>
                {generateError && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.83rem' }}>
                    {generateError}
                  </div>
                )}
                {jobsLoading ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Loading jobs…</div>
                ) : completedJobs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem', fontSize: '0.875rem' }}>
                    No completed jobs available for invoicing.
                  </div>
                ) : (
                  completedJobs.map((job) => (
                    <div
                      key={job.id}
                      style={{
                        ...cardStyle,
                        padding: '0.75rem 1rem',
                        marginBottom: '0.6rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem' }}>
                          {job.pickup_location ?? '—'} → {job.delivery_location ?? '—'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {job.pickup_datetime ? fmtDate(job.pickup_datetime) : ''}
                          {job.client_name ? ` · ${job.client_name}` : ''}
                          {job.budget_amount ? ` · ${fmtCurrency(job.budget_amount)}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleGenerateInvoice(job.id)}
                        disabled={generatingJobId === job.id}
                        style={{
                          padding: '0.4rem 0.9rem',
                          background: generatingJobId === job.id ? '#93c5fd' : '#1d4ed8',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: generatingJobId === job.id ? 'not-allowed' : 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {generatingJobId === job.id ? 'Creating…' : 'Create Invoice'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
