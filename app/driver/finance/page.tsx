'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  toCanonicalInvoiceStatusWithDueDate,
  type CanonicalInvoiceStatus,
} from '../../../lib/invoiceStatus';

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
};

type EligibleJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  budget_amount: number | null;
  client_name: string | null;
  customer_reference: string | null;
  status: string;
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
  Draft: { bg: '#fef3c7', text: '#92400e' },
  Sent: { bg: '#e0e7ff', text: '#3730a3' },
  Overdue: { bg: '#fee2e2', text: '#991b1b' },
  Paid: { bg: '#d1fae5', text: '#065f46' },
  Disputed: { bg: '#fce7f3', text: '#9d174d' },
  Cancelled: { bg: '#e2e8f0', text: '#475569' },
};

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

export default function DriverFinancePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InvoiceStatus | 'All'>('All');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
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
      if (activeTab !== 'All') params.set('status', activeTab);
      const response = await fetch(`/api/driver/finance/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as {
        rows?: InvoiceRow[];
        summary?: FinanceSummary;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to load invoices.');

      setInvoices((payload?.rows ?? []).map((row) => ({
        ...row,
        status: toCanonicalInvoiceStatusWithDueDate(row.status, row.due_date),
      })));
      setSummary(payload?.summary ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);

  const loadEligibleJobs = async () => {
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
      const payload = (await response.json().catch(() => null)) as {
        rows?: EligibleJob[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to load completed jobs.');
      setEligibleJobs(payload?.rows ?? []);
    } catch (reason) {
      setGenerateError(reason instanceof Error ? reason.message : 'Failed to load completed jobs.');
    } finally {
      setJobsLoading(false);
    }
  };

  const openJobPicker = () => {
    setShowJobPicker(true);
    void loadEligibleJobs();
  };

  const generateInvoice = async (jobId: string) => {
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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      const payload = (await response.json().catch(() => null)) as {
        invoice?: { id: string };
        error?: string;
      } | null;
      if (!response.ok || !payload?.invoice?.id) {
        throw new Error(payload?.error ?? 'Invoice could not be generated.');
      }

      setShowJobPicker(false);
      router.push(`/driver/finance/invoices/${payload.invoice.id}`);
    } catch (reason) {
      setGenerateError(reason instanceof Error ? reason.message : 'Invoice could not be generated.');
    } finally {
      setGeneratingJobId(null);
    }
  };

  const card: CSSProperties = {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #d7e0ea',
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
  };

  const summaryCards = summary
    ? [
        ['Total', summary.total],
        ['Draft', summary.draft],
        ['Sent', summary.sent],
        ['Overdue', summary.overdue],
        ['Paid', summary.paid],
        ['Disputed', summary.disputed],
        ['Cancelled', summary.cancelled],
      ]
    : [];

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell
        subtitle="Create accurate invoices from completed jobs and track delivery and payment status."
        headerActions={
          <button onClick={openJobPicker} style={primaryButton}>+ Generate Invoice</button>
        }
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 750, color: '#1e293b', margin: '0 0 1.1rem' }}>
          Finance Workspace
        </h2>

        {error && <div style={errorBox}>{error}</div>}

        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
            {summaryCards.map(([label, value]) => (
              <div key={String(label)} style={{ ...card, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.45rem', fontWeight: 850, color: '#0b2f6b' }}>{value}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.42rem 0.8rem',
                borderRadius: 7,
                border: '1px solid #d7e0ea',
                background: activeTab === tab.id ? '#1d4ed8' : '#fff',
                color: activeTab === tab.id ? '#fff' : '#475569',
                fontWeight: 750,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={card}>
          {loading ? (
            <div style={emptyBox}>Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div style={emptyBox}>No invoices found for this company.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                <thead>
                  <tr>
                    {['Invoice', 'Customer', 'Job reference', 'Date', 'Due', 'Status', 'Total', 'Action'].map((heading) => (
                      <th key={heading} style={th}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const tone = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.Draft;
                    return (
                      <tr key={invoice.id}>
                        <td style={td}><strong>{invoice.invoice_number}</strong></td>
                        <td style={td}>{invoice.client_name}</td>
                        <td style={td}>{invoice.job_ref}</td>
                        <td style={td}>{date(invoice.invoice_date)}</td>
                        <td style={td}>{date(invoice.due_date)}</td>
                        <td style={td}><span style={{ background: tone.bg, color: tone.text, padding: '0.2rem 0.48rem', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800 }}>{invoice.status}</span></td>
                        <td style={td}>{money(invoice.amount, invoice.currency)}</td>
                        <td style={td}><button onClick={() => router.push(`/driver/finance/invoices/${invoice.id}`)} style={secondaryButton}>Open</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showJobPicker && (
          <div style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowJobPicker(false); }}>
            <div style={modal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>Completed jobs</h3>
                  <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.78rem' }}>
                    Marketplace invoices are built from the accepted quote and customer company record.
                  </p>
                </div>
                <button onClick={() => setShowJobPicker(false)} style={closeButton}>×</button>
              </div>

              {generateError && <div style={{ ...errorBox, marginTop: '0.8rem' }}>{generateError}</div>}

              <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.65rem', maxHeight: '62vh', overflowY: 'auto' }}>
                {jobsLoading ? (
                  <div style={emptyBox}>Loading completed jobs…</div>
                ) : eligibleJobs.length === 0 ? (
                  <div style={emptyBox}>No delivered or completed jobs are available.</div>
                ) : eligibleJobs.map((job) => (
                  <div key={job.id} style={{ border: '1px solid #d7e0ea', borderRadius: 9, padding: '0.75rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: '#0f172a', fontSize: '0.82rem' }}>
                          {job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}
                        </strong>
                        <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                          {job.customer_reference ?? `JOB-${job.id.slice(0, 8).toUpperCase()}`} · {date(job.pickup_datetime)} · {job.status}
                        </div>
                        {job.invoice && (
                          <div style={{ color: Number(job.invoice.amount ?? 0) > 0 ? '#166534' : '#b91c1c', fontSize: '0.7rem', marginTop: '0.25rem', fontWeight: 700 }}>
                            Existing {job.invoice.invoice_number ?? 'invoice'} · {job.invoice.status} · {money(Number(job.invoice.amount ?? 0))}
                          </div>
                        )}
                      </div>
                      <button
                        disabled={generatingJobId === job.id}
                        onClick={() => void generateInvoice(job.id)}
                        style={{ ...primaryButton, opacity: generatingJobId === job.id ? 0.6 : 1 }}
                      >
                        {generatingJobId === job.id
                          ? 'Preparing…'
                          : job.invoice
                            ? 'Open / refresh invoice'
                            : 'Create draft invoice'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

const primaryButton: CSSProperties = {
  padding: '0.52rem 0.85rem',
  background: '#1d4ed8',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  fontSize: '0.75rem',
  fontWeight: 800,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  padding: '0.35rem 0.62rem',
  background: '#fff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  borderRadius: 7,
  fontSize: '0.7rem',
  fontWeight: 800,
  cursor: 'pointer',
};

const errorBox: CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  padding: '0.7rem 0.8rem',
  borderRadius: 8,
  fontSize: '0.78rem',
  marginBottom: '0.8rem',
};

const emptyBox: CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
  color: '#64748b',
  fontSize: '0.8rem',
};

const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.65rem 0.7rem',
  color: '#475569',
  fontSize: '0.65rem',
  fontWeight: 850,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #d7e0ea',
  background: '#f8fafc',
};

const td: CSSProperties = {
  padding: '0.7rem',
  color: '#0f172a',
  fontSize: '0.76rem',
  borderBottom: '1px solid #edf2f7',
};

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.58)',
  display: 'grid',
  placeItems: 'center',
  padding: '1rem',
  zIndex: 1000,
};

const modal: CSSProperties = {
  width: 'min(780px, 100%)',
  maxHeight: '88vh',
  overflow: 'hidden',
  background: '#fff',
  borderRadius: 12,
  padding: '1rem',
  boxShadow: '0 24px 60px rgba(15,23,42,0.3)',
};

const closeButton: CSSProperties = {
  border: 0,
  background: '#f1f5f9',
  color: '#475569',
  borderRadius: 8,
  width: 34,
  height: 34,
  fontSize: '1.25rem',
  cursor: 'pointer',
};
