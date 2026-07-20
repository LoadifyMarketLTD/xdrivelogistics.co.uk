'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
} from '../../components/workspace/WorkspaceUI';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { toCanonicalInvoiceStatusWithDueDate, type CanonicalInvoiceStatus } from '../../../lib/invoiceStatus';

type InvoiceRow = {
  id: string;
  invoice_number: string;
  job_ref: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: CanonicalInvoiceStatus;
  client_name: string;
  amount: number;
  currency: string;
  payment_status?: string | null;
};

type InvoiceableJob = {
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

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';

export default function DriverFinancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [invoiceableJobs, setInvoiceableJobs] = useState<InvoiceableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) return;
    setLoading(true);
    setError('');
    const token = await getToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/driver/finance/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        rows?: InvoiceRow[];
        summary?: FinanceSummary;
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
  }, [getToken, user?.id]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const loadInvoiceableJobs = async () => {
    if (!user?.id) return;
    setJobsLoading(true);
    setError('');
    try {
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id, company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (driverError) throw driverError;
      if (!driver?.company_id) throw new Error('Driver company context is missing.');

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, pickup_location, delivery_location, pickup_datetime, budget_amount, client_name, status')
        .or(`company_id.eq.${driver.company_id},assigned_company_id.eq.${driver.company_id},awarded_carrier_company_id.eq.${driver.company_id}`)
        .in('status', ['delivered', 'completed'])
        .order('updated_at', { ascending: false })
        .limit(100);
      if (jobsError) throw jobsError;

      const { data: existing, error: invoiceError } = await supabase
        .from('invoices')
        .select('job_id')
        .eq('company_id', driver.company_id)
        .not('job_id', 'is', null);
      if (invoiceError) throw invoiceError;

      const invoiced = new Set((existing ?? []).map((row: { job_id: string | null }) => row.job_id).filter(Boolean));
      setInvoiceableJobs(((jobs ?? []) as InvoiceableJob[]).filter((job) => !invoiced.has(job.id)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load completed jobs.');
      setInvoiceableJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  const openJobPicker = () => {
    setShowJobs(true);
    void loadInvoiceableJobs();
  };

  const generateInvoice = async (jobId: string) => {
    setGeneratingJobId(jobId);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired.');
      const response = await fetch(`/api/driver/finance/jobs/${jobId}/generate-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; invoice?: { id: string } } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to generate invoice.');
      if (payload?.invoice?.id) {
        router.push(`/driver/finance/invoices/${payload.invoice.id}`);
        return;
      }
      setShowJobs(false);
      await loadInvoices();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to generate invoice.');
    } finally {
      setGeneratingJobId(null);
    }
  };

  const outstanding = useMemo(
    () => invoices.filter((invoice) => invoice.payment_status !== 'paid' && invoice.status !== 'Paid').reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    [invoices]
  );

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell>
        <PageFrame>
          <PageHeader
            eyebrow="Driver finance"
            title="Finance Workspace"
            description="Create invoices from delivered work, issue them to the customer and track the payment lifecycle from one place."
            actions={
              <>
                <ActionButton tone="success" onClick={openJobPicker}>Generate invoice</ActionButton>
                <ActionButton tone="secondary" onClick={() => void loadInvoices()}>Refresh</ActionButton>
              </>
            }
          />

          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          <KpiGrid>
            <KpiCard label="All invoices" value={summary?.total ?? invoices.length} />
            <KpiCard label="Draft" value={summary?.draft ?? 0} tone="orange" />
            <KpiCard label="Sent" value={summary?.sent ?? 0} tone="blue" />
            <KpiCard label="Overdue" value={summary?.overdue ?? 0} tone="red" />
            <KpiCard label="Paid" value={summary?.paid ?? 0} tone="green" />
            <KpiCard label="Outstanding value" value={money(outstanding)} tone="navy" />
          </KpiGrid>

          <TwoColumn rightWidth="minmax(330px, 0.75fr)">
            <Panel title="Invoice register" description="Open an invoice to review documents, disputes and payment records.">
              {loading ? (
                <EmptyState title="Loading invoices…" />
              ) : (
                <DataTable
                  columns={['Invoice', 'Customer', 'Amount', 'Due', 'Status']}
                  rows={invoices.map((invoice) => [
                    <button key="invoice" type="button" onClick={() => router.push(`/driver/finance/invoices/${invoice.id}`)} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{invoice.invoice_number}</button>,
                    invoice.client_name || 'Customer',
                    money(Number(invoice.amount ?? 0), invoice.currency),
                    date(invoice.due_date),
                    <StatusBadge key="status" value={invoice.status} />,
                  ])}
                  empty={<EmptyState title="No invoices yet" description="Generate an invoice after a job is delivered." action={<ActionButton tone="success" onClick={openJobPicker}>Generate invoice</ActionButton>} />}
                />
              )}
            </Panel>

            <Panel title="Delivered work ready to invoice" description="Marketplace work is included when your company is the awarded carrier.">
              {!showJobs ? (
                <EmptyState title="Choose completed work" description="Open the invoice selector to see delivered jobs without an existing invoice." action={<ActionButton tone="secondary" onClick={openJobPicker}>Show jobs</ActionButton>} />
              ) : jobsLoading ? (
                <EmptyState title="Loading delivered jobs…" />
              ) : invoiceableJobs.length === 0 ? (
                <EmptyState title="Nothing waiting for an invoice" description="All visible delivered jobs already have an invoice." />
              ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  {invoiceableJobs.map((job) => (
                    <div key={job.id} style={{ border: '1px solid #d7e0ea', borderRadius: 9, padding: '0.75rem', background: '#f8fafc' }}>
                      <strong style={{ display: 'block', color: '#0f172a' }}>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>
                      <span style={{ display: 'block', margin: '0.25rem 0 0.55rem', color: '#64748b', fontSize: '0.75rem' }}>{date(job.pickup_datetime)} · {job.client_name ?? 'Customer'} · {job.budget_amount ? money(job.budget_amount) : 'Agreement rate'}</span>
                      <ActionButton tone="success" disabled={generatingJobId === job.id} onClick={() => void generateInvoice(job.id)}>{generatingJobId === job.id ? 'Creating…' : 'Create invoice'}</ActionButton>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </TwoColumn>
        </PageFrame>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
