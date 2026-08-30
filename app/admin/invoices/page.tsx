'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import type { InvoiceData } from '../../components/InvoiceTemplate';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  loadInvoicesWithSchemaCompat,
  resolveInvoiceClientName,
} from '../../../lib/supabaseSchemaCompat';
import {
  toCanonicalInvoiceDisplayStatus,
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
  type CanonicalInvoiceStatus,
} from '../../../lib/invoiceStatus';
import { OperationalSignalStrip } from '../../components/workspace/OperationalConvergence';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';
import './invoice-register-exchange.css';

type InvoiceListItem = InvoiceData & { jobId: string | null; paymentStatus: string | null };
type InvoiceFilter = 'All' | CanonicalInvoiceStatus;

const FILTERS: InvoiceFilter[] = ['All', 'Draft', 'Sent', 'Overdue', 'Paid', 'Disputed', 'Cancelled'];
const INVOICES_PER_PAGE = 25;

function dbToInvoiceData(row: Record<string, unknown>, fallbackId: string): InvoiceListItem {
  const invoiceDate = typeof row.invoice_date === 'string'
    ? row.invoice_date
    : typeof row.created_at === 'string'
      ? row.created_at
      : new Date().toISOString();
  const dueDate = typeof row.due_date === 'string' ? row.due_date : invoiceDate;
  const paymentTerms = row.payment_terms === 'Pay now' || row.payment_terms === '30 days' ? row.payment_terms : '14 days';
  const status = toCanonicalInvoiceDisplayStatus(
    typeof row.status === 'string' ? row.status : null,
    dueDate,
    typeof row.payment_status === 'string' ? row.payment_status : null,
  );

  return {
    id: typeof row.id === 'string' ? row.id : fallbackId,
    invoiceNumber: typeof row.invoice_number === 'string' ? row.invoice_number : `Invoice-${fallbackId.slice(0, 8)}`,
    jobRef: typeof row.job_ref === 'string' ? row.job_ref : '',
    date: invoiceDate,
    dueDate,
    status,
    clientName: resolveInvoiceClientName(row) ?? 'Client pending',
    clientAddress: typeof row.client_address === 'string' ? row.client_address : '',
    clientEmail: typeof row.client_email === 'string' ? row.client_email : '',
    pickupLocation: typeof row.pickup_location === 'string' ? row.pickup_location : '',
    pickupDateTime: typeof row.pickup_datetime === 'string' ? row.pickup_datetime : '',
    deliveryLocation: typeof row.delivery_location === 'string' ? row.delivery_location : '',
    deliveryDateTime: typeof row.delivery_datetime === 'string' ? row.delivery_datetime : '',
    deliveryRecipient: typeof row.delivery_recipient === 'string' ? row.delivery_recipient : '',
    serviceDescription: typeof row.service_description === 'string' ? row.service_description : '',
    amount: Number(row.amount ?? 0),
    netAmount: Number(row.net_amount ?? row.amount ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    vatRate: row.vat_rate === 5 || row.vat_rate === 20 ? row.vat_rate : 0,
    paymentTerms,
    lateFee: typeof row.late_fee === 'string' ? row.late_fee : '',
    podPhotos: Array.isArray(row.pod_photos) ? row.pod_photos as string[] : undefined,
    signature: typeof row.signature === 'string' ? row.signature : undefined,
    recipientName: typeof row.recipient_name === 'string' ? row.recipient_name : undefined,
    jobId: typeof row.job_id === 'string' ? row.job_id : null,
    paymentStatus: typeof row.payment_status === 'string' ? row.payment_status : null,
  };
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number.isFinite(value) ? value : 0);
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleDateString('en-GB');
}

function statusTone(status: CanonicalInvoiceStatus): 'green' | 'orange' | 'red' | 'purple' | 'blue' | 'grey' {
  if (status === 'Paid') return 'green';
  if (status === 'Overdue') return 'red';
  if (status === 'Disputed') return 'purple';
  if (status === 'Draft') return 'orange';
  if (status === 'Sent') return 'blue';
  return 'grey';
}

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceFilter>('All');
  const [invoicePage, setInvoicePage] = useState(0);
  const loadRequestRef = useRef(0);

  const loadInvoices = async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError('');

    if (!isSupabaseConfigured || !companyId) {
      if (requestId === loadRequestRef.current) {
        setInvoices([]);
        setLoading(false);
      }
      return;
    }

    const activeColumns = [
      'id', 'company_id', 'created_by', 'invoice_number', 'job_ref', 'job_id', 'invoice_date', 'due_date', 'status', 'payment_status',
      'client_name', 'client_address', 'client_email', 'pickup_location', 'pickup_datetime', 'delivery_location',
      'delivery_datetime', 'delivery_recipient', 'service_description', 'amount', 'net_amount', 'vat_amount',
      'vat_rate', 'currency', 'payment_terms', 'late_fee', 'pod_photos', 'signature', 'recipient_name', 'created_at', 'updated_at',
    ];
    const { rows, error: queryError } = await loadInvoicesWithSchemaCompat(supabase, companyId, activeColumns);
    if (requestId !== loadRequestRef.current) return;

    if (!queryError) {
      setInvoices(rows.map((row, index) => {
        const invoice = dbToInvoiceData(row, `invoice-${index}`);
        return { ...invoice, status: toCanonicalInvoiceStatusWithDueDate(invoice.status, invoice.dueDate) };
      }));
    } else {
      setInvoices([]);
      setLoadError(queryError.message ?? 'Failed to load invoices.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((filter) => [
    filter,
    filter === 'All' ? invoices.length : invoices.filter((invoice) => invoice.status === filter).length,
  ])) as Record<InvoiceFilter, number>, [invoices]);

  const totals = useMemo(() => {
    const unpaid = invoices.filter((invoice) => toCanonicalPaymentStatus(invoice.paymentStatus) !== 'paid' && !['Cancelled', 'Paid'].includes(invoice.status));
    const overdue = invoices.filter((invoice) => invoice.status === 'Overdue');
    const paid = invoices.filter((invoice) => invoice.status === 'Paid' || toCanonicalPaymentStatus(invoice.paymentStatus) === 'paid');
    return {
      outstanding: unpaid.reduce((sum, invoice) => sum + invoice.amount, 0),
      overdue: overdue.reduce((sum, invoice) => sum + invoice.amount, 0),
      paid: paid.reduce((sum, invoice) => sum + invoice.amount, 0),
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesSearch = !needle || [invoice.invoiceNumber, invoice.jobRef, invoice.clientName].join(' ').toLowerCase().includes(needle);
      const matchesStatus = statusFilter === 'All' || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  useEffect(() => { setInvoicePage(0); }, [searchTerm, statusFilter, invoices.length]);

  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE));
  const safeInvoicePage = Math.min(invoicePage, totalInvoicePages - 1);
  const paginatedInvoices = filteredInvoices.slice(safeInvoicePage * INVOICES_PER_PAGE, (safeInvoicePage + 1) * INVOICES_PER_PAGE);

  return (
    <ProtectedRoute>
      <PageFrame>
        <PageHeader
          eyebrow="Accounting / receivables"
          title="Invoices"
          description="Draft, issued, overdue, disputed and settled invoices in one dense accounting register. Payment recording remains in the authoritative invoice detail screen."
          actions={(
            <>
              <ActionButton tone="secondary" disabled={loading} onClick={() => void loadInvoices()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
              <ActionButton tone="success" onClick={() => router.push('/admin/invoices/new')}>Create Invoice</ActionButton>
            </>
          )}
        />

        {loadError && <AlertBanner tone="danger">{loadError}</AlertBanner>}

        <OperationalSignalStrip
          ariaLabel="Invoice lifecycle signals"
          items={[
            { key: 'all', label: 'All invoices', value: counts.All, detail: 'Current company', tone: 'navy', onClick: () => setStatusFilter('All') },
            { key: 'draft', label: 'Draft', value: counts.Draft, detail: 'Not yet issued', tone: counts.Draft ? 'orange' : 'blue', onClick: () => setStatusFilter('Draft') },
            { key: 'sent', label: 'Awaiting payment', value: counts.Sent, detail: 'Issued / sent', tone: counts.Sent ? 'orange' : 'blue', onClick: () => setStatusFilter('Sent') },
            { key: 'overdue', label: 'Overdue', value: counts.Overdue, detail: money(totals.overdue), tone: counts.Overdue ? 'red' : 'green', onClick: () => setStatusFilter('Overdue') },
            { key: 'disputed', label: 'Disputed', value: counts.Disputed, detail: 'Requires review', tone: counts.Disputed ? 'purple' : 'blue', onClick: () => setStatusFilter('Disputed') },
            { key: 'paid', label: 'Paid', value: counts.Paid, detail: money(totals.paid), tone: 'green', onClick: () => setStatusFilter('Paid') },
            { key: 'outstanding', label: 'Outstanding', value: money(totals.outstanding), detail: 'Unpaid value', tone: totals.outstanding > 0 ? 'navy' : 'green' },
          ]}
        />

        <div className="invoice-register-tabs" role="tablist" aria-label="Invoice lifecycle filters">
          {FILTERS.map((filter) => (
            <button key={filter} type="button" role="tab" aria-selected={statusFilter === filter} data-active={statusFilter === filter ? 'true' : 'false'} onClick={() => setStatusFilter(filter)}>
              {filter === 'Sent' ? 'Awaiting Payment' : filter} <span>{counts[filter]}</span>
            </button>
          ))}
        </div>

        <Panel
          title="Invoice register"
          description={`${filteredInvoices.length} invoice${filteredInvoices.length === 1 ? '' : 's'} in the current view.`}
          actions={(
            <div className="invoice-register-search">
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Invoice, job ref or client" aria-label="Search invoices" />
              {searchTerm && <ActionButton tone="secondary" onClick={() => setSearchTerm('')}>Clear</ActionButton>}
            </div>
          )}
          flush
        >
          {loading ? (
            <EmptyState compact title="Loading invoices…" />
          ) : paginatedInvoices.length === 0 ? (
            <EmptyState title="No invoices in this view" description={searchTerm ? 'Clear or adjust the search.' : 'No invoice records match this lifecycle state.'} />
          ) : (
            <DataTable
              columns={['Invoice', 'Job ref', 'Client', 'Issued', 'Due', 'Amount', 'Status', 'Action']}
              rows={paginatedInvoices.map((invoice) => [
                <strong key="invoice">{invoice.invoiceNumber}</strong>,
                invoice.jobRef || '—',
                invoice.clientName,
                date(invoice.date),
                date(invoice.dueDate),
                <strong key="amount">{money(invoice.amount)}</strong>,
                <StatusBadge key="status" value={invoice.status} tone={statusTone(invoice.status)} />,
                <span key="actions" className="invoice-register-actions">
                  <ActionButton tone="secondary" onClick={() => router.push(`/admin/invoices/${invoice.id}`)}>View</ActionButton>
                  {toCanonicalPaymentStatus(invoice.paymentStatus) !== 'paid' && !['Cancelled', 'Draft'].includes(invoice.status) && (
                    <ActionButton tone="secondary" onClick={() => router.push(`/admin/invoices/${invoice.id}`)}>Record Payment</ActionButton>
                  )}
                </span>,
              ])}
            />
          )}
        </Panel>

        {!loading && filteredInvoices.length > INVOICES_PER_PAGE && (
          <div className="invoice-register-pagination">
            <span>Showing {safeInvoicePage * INVOICES_PER_PAGE + 1}-{Math.min((safeInvoicePage + 1) * INVOICES_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length}</span>
            <span>
              <ActionButton tone="secondary" disabled={safeInvoicePage === 0} onClick={() => setInvoicePage((current) => Math.max(0, current - 1))}>Previous</ActionButton>
              <strong>Page {safeInvoicePage + 1} / {totalInvoicePages}</strong>
              <ActionButton tone="secondary" disabled={safeInvoicePage >= totalInvoicePages - 1} onClick={() => setInvoicePage((current) => Math.min(totalInvoicePages - 1, current + 1))}>Next</ActionButton>
            </span>
          </div>
        )}

        <div className="invoice-register-contract-note">
          <strong>Ready to Invoice / external invoice parity</strong>
          <span>The current invoice schema supports draft/issued/payment/dispute lifecycle and payment history. A distinct CX-style Ready to Invoice queue, external invoice upload, batch invoicing and statements/export are not represented as verified register actions here and remain separate parity-ledger items rather than being fabricated.</span>
        </div>
      </PageFrame>
    </ProtectedRoute>
  );
}
