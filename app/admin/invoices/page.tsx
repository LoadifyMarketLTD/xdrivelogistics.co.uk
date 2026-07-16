'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {
  WorkspaceShell,
  WorkspaceAside,
  WorkspaceMain,
  WorkspaceHeader,
  WorkspaceContent,
  WorkspaceTable,
  WorkspaceTableTr,
  WorkspaceTableTd,
  WorkspaceStatusBadge,
  WorkspaceFieldLabel,
  LoadingCard,
  EmptyCard,
  ErrorBanner,
  wsInputStyle,
  wsBtnPrimary,
  wsBtnSecondary,
  wsBtnAction,
  type WorkspaceTab,
} from '../../components/workspace';
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

type InvoiceListItem = InvoiceData & { jobId: string | null; paymentStatus: string | null };

function dbToInvoiceData(row: Record<string, unknown>, fallbackId: string): InvoiceListItem {
  const invoiceDate =
    typeof row.invoice_date === 'string'
      ? row.invoice_date
      : typeof row.created_at === 'string'
        ? row.created_at
        : new Date().toISOString();
  const dueDate = typeof row.due_date === 'string' ? row.due_date : invoiceDate;
  const paymentTerms = row.payment_terms === 'Pay now' || row.payment_terms === '30 days' ? row.payment_terms : '14 days';
  const status =
    toCanonicalInvoiceDisplayStatus(
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

const INVOICE_STATUS_TABS = ['All', 'Draft', 'Sent', 'Overdue', 'Paid', 'Disputed', 'Cancelled'] as const;

const getStatusColors = (status: string) => {
  switch (status) {
    case 'Paid':
      return { bg: '#F4F6F8', color: '#0B2F6B' };
    case 'Draft':
      return { bg: '#F4F6F8', color: '#1A1F2B' };
    case 'Sent':
      return { bg: '#F4F6F8', color: '#1D57D8' };
    case 'Overdue':
      return { bg: '#F4F6F8', color: '#1A1F2B' };
    case 'Disputed':
      return { bg: '#F4F6F8', color: '#1A1F2B' };
    case 'Cancelled':
      return { bg: '#F4F6F8', color: '#0B2F6B' };
    default:
      return { bg: '#F4F6F8', color: '#1A1F2B' };
  }
};

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | CanonicalInvoiceStatus>('All');
  const INVOICES_PER_PAGE = 12;
  const [invoicePage, setInvoicePage] = useState(0);
  const loadRequestRef = useRef(0);

  const calculateStatus = (dueDate: string, currentStatus: string): CanonicalInvoiceStatus =>
    toCanonicalInvoiceStatusWithDueDate(currentStatus, dueDate);

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
      'vat_rate', 'currency', 'payment_terms', 'late_fee', 'pod_photos', 'signature', 'recipient_name', 'created_at',
      'updated_at',
    ];
    const { rows, error: queryError } = await loadInvoicesWithSchemaCompat(supabase, companyId, activeColumns);

    if (requestId !== loadRequestRef.current) return;

    if (!queryError) {
      const mapped = rows.map((row, index) => {
        const inv = dbToInvoiceData(row, `invoice-${index}`);
        return { ...inv, status: calculateStatus(inv.dueDate, inv.status) };
      });
      setInvoices(mapped);
      setLoadError('');
    } else {
      console.error('Failed to load invoices from Supabase:', queryError.message);
      setLoadError(queryError.message ?? 'Failed to load invoices.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.jobRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setInvoicePage(0);
  }, [searchTerm, statusFilter, invoices.length]);

  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE));
  const safeInvoicePage = Math.min(invoicePage, totalInvoicePages - 1);
  const paginatedInvoices = filteredInvoices.slice(
    safeInvoicePage * INVOICES_PER_PAGE,
    (safeInvoicePage + 1) * INVOICES_PER_PAGE,
  );

  const invoiceTabs: WorkspaceTab[] = INVOICE_STATUS_TABS.map((status) => ({
    id: status,
    label: status,
    count: status === 'All' ? invoices.length : invoices.filter((invoice) => invoice.status === status).length,
  }));

  return (
    <ProtectedRoute>
      <WorkspaceShell>
        <WorkspaceAside title="Filters">
          <WorkspaceFieldLabel>Search</WorkspaceFieldLabel>
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={wsInputStyle}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={() => void loadInvoices()} style={{ ...wsBtnPrimary, flex: 1 }}>
              Refresh
            </button>
            <button onClick={() => setSearchTerm('')} style={wsBtnSecondary}>
              Clear
            </button>
          </div>

          <div style={{ borderTop: '1px solid rgba(11, 47, 107, 0.16)', paddingTop: '0.9rem' }}>
            <WorkspaceFieldLabel>Results</WorkspaceFieldLabel>
            <div style={{ color: '#1A1F2B', fontWeight: 700, marginBottom: '0.85rem' }}>
              {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? '' : 's'}
            </div>
            <WorkspaceFieldLabel>Total Amount</WorkspaceFieldLabel>
            <div style={{ color: '#1A1F2B', fontWeight: 700 }}>
              GBP {filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
            </div>
          </div>
        </WorkspaceAside>
        <WorkspaceMain>
          <WorkspaceHeader
            tabs={invoiceTabs}
            activeTab={statusFilter}
            onTabChange={(id) => setStatusFilter(id as 'All' | CanonicalInvoiceStatus)}
            action={(
              <button
                onClick={() => router.push('/admin/invoices/new')}
                style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.45rem 0.85rem' }}
              >
                + Create Invoice
              </button>
            )}
          />
          <WorkspaceContent>
            <div style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 700, color: '#1A1F2B' }}>Invoices</h1>
                <p style={{ margin: '0.4rem 0 0', color: '#0B2F6B' }}>Search, review, and manage company invoices.</p>
              </div>
              <button onClick={() => void loadInvoices()} style={wsBtnAction}>↻ Refresh</button>
            </div>

            {loadError && <ErrorBanner msg={loadError} />}

            {loading ? (
              <LoadingCard text="Loading invoices..." />
            ) : filteredInvoices.length === 0 ? (
              <div>
                <EmptyCard
                  icon="🧾"
                  text={searchTerm || statusFilter !== 'All' ? 'Try adjusting your search or filters.' : 'Get started by creating your first invoice.'}
                />
                {!searchTerm && statusFilter === 'All' && (
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => router.push('/admin/invoices/new')}
                      style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.75rem 1.5rem' }}
                    >
                      Create First Invoice
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <WorkspaceTable
                columns={['Invoice #', 'Job Ref', 'Client', 'Date', 'Due Date', 'Amount', 'Status', 'Actions']}
                minWidth="980px"
                pagination={{
                  page: safeInvoicePage,
                  total: filteredInvoices.length,
                  perPage: INVOICES_PER_PAGE,
                  onPrev: () => setInvoicePage((prev) => Math.max(prev - 1, 0)),
                  onNext: () => setInvoicePage((prev) => Math.min(prev + 1, totalInvoicePages - 1)),
                }}
              >
                {paginatedInvoices.map((invoice, index) => {
                  const statusColors = getStatusColors(invoice.status);
                  return (
                    <WorkspaceTableTr
                      key={invoice.id}
                      last={index === paginatedInvoices.length - 1}
                      onClick={() => router.push(`/admin/invoices/${invoice.id}`)}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                      style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                    >
                      <WorkspaceTableTd style={{ fontSize: '0.9rem', color: '#0B2F6B', fontWeight: '500' }}>
                        {invoice.invoiceNumber}
                      </WorkspaceTableTd>
                      <WorkspaceTableTd style={{ fontSize: '0.9rem', color: '#0B2F6B' }}>{invoice.jobRef}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ fontSize: '0.9rem', color: '#0B2F6B' }}>{invoice.clientName}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ fontSize: '0.9rem', color: '#0B2F6B' }}>
                        {new Date(invoice.date).toLocaleDateString('en-GB')}
                      </WorkspaceTableTd>
                      <WorkspaceTableTd style={{ fontSize: '0.9rem', color: '#0B2F6B' }}>
                        {new Date(invoice.dueDate).toLocaleDateString('en-GB')}
                      </WorkspaceTableTd>
                      <WorkspaceTableTd style={{ fontSize: '0.9rem', color: '#0B2F6B', fontWeight: '600', textAlign: 'right' }}>
                        GBP {invoice.amount.toFixed(2)}
                      </WorkspaceTableTd>
                      <WorkspaceTableTd style={{ textAlign: 'center' }}>
                        <WorkspaceStatusBadge bg={statusColors.bg} color={statusColors.color}>
                          {invoice.status}
                        </WorkspaceStatusBadge>
                      </WorkspaceTableTd>
                      <WorkspaceTableTd style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/invoices/${invoice.id}`);
                            }}
                            style={{ ...wsBtnAction, backgroundColor: '#F4F6F8', color: '#1D57D8', border: '1px solid rgba(11, 47, 107, 0.16)' }}
                          >
                            View
                          </button>
                          {toCanonicalPaymentStatus(invoice.paymentStatus) !== 'paid' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/invoices/${invoice.id}`);
                              }}
                              style={{ ...wsBtnAction, backgroundColor: '#F4F6F8', color: '#1D57D8', border: '1px solid rgba(11, 47, 107, 0.16)' }}
                            >
                              Record Payment
                            </button>
                          )}
                        </div>
                      </WorkspaceTableTd>
                    </WorkspaceTableTr>
                  );
                })}
              </WorkspaceTable>
            )}
          </WorkspaceContent>
        </WorkspaceMain>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
