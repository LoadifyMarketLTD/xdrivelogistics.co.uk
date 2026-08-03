'use client';

import { useState, useEffect, useRef } from 'react';
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
import {
  ActionButton,
  AlertBanner,
  ExchangeKpiStrip,
  KpiCard,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';
import styles from '../../components/workspace/WorkspaceUI.module.css';

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
      typeof row.payment_status === 'string' ? row.payment_status : null
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

  return (
    <ProtectedRoute>
      {/* Page background — contract Section 1: #f4f6f8, 12px padding */}
      <div style={{ background: '#f4f6f8', padding: '12px' }}>

        {/* Page header — Section 4: title 20px/26px/600; subtitle 12px/16px */}
        <PageHeader
          eyebrow="Invoices"
          title="Invoice Register"
          description="Manage, send and track all company invoices."
          actions={
            <ActionButton tone="success" onClick={() => router.push('/admin/invoices/new')}>
              + Create Invoice
            </ActionButton>
          }
        />

        {loadError && <AlertBanner tone="danger">{loadError}</AlertBanner>}

        {/* Status tabs — Section 9: 36px row, 26px tab height, border-bottom indicator */}
        <div className={styles.jobsStatusTabs} role="tablist" aria-label="Filter invoices by status" style={{ marginBottom: '8px' }}>
          {(['All', 'Draft', 'Sent', 'Overdue', 'Paid', 'Disputed', 'Cancelled'] as const).map((s) => {
            const isActive = statusFilter === s;
            const count = s === 'All' ? invoices.length : invoices.filter(i => i.status === s).length;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.jobsStatusTab} ${isActive ? styles.jobsStatusTabActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
                {count > 0 && (
                  <span style={{ marginLeft: '4px', background: isActive ? '#dbeafe' : '#f1f5f9', color: isActive ? '#1d57d8' : '#64748b', borderRadius: '999px', padding: '0 4px', fontSize: '10px', fontWeight: 700 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search toolbar — Section 5: 40px height, 4px v-pad, 8px h-pad, 32px controls */}
        <div className={styles.jobsToolbar} role="search" aria-label="Filter invoices" style={{ marginBottom: '8px' }}>
          <input
            type="search"
            placeholder="Search invoices…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.jobsToolbarInput}
            style={{ flex: '1 1 220px' }}
            aria-label="Search invoices"
          />
          <ActionButton tone="secondary" onClick={() => void loadInvoices()}>Refresh</ActionButton>
        </div>

        {/* Invoice table — Section 9+10: header 36px; rows 42px; radius 4px */}
        <div className={styles.operationalTableContainer}>
          {loading ? (
            <div className={styles.jobsEmptyTableCell} style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              Loading invoices…
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#1a1f2b' }}>No invoices found</p>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                {searchTerm || statusFilter !== 'All'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first invoice'}
              </p>
              {!searchTerm && statusFilter === 'All' && (
                <ActionButton tone="success" onClick={() => router.push('/admin/invoices/new')}>
                  Create First Invoice
                </ActionButton>
              )}
            </div>
          ) : (
            <div className={styles.operationalTableScroll}>
              <table className={styles.operationalTable}>
                <caption className={styles.operationalTableCaption}>Invoice register</caption>
                <thead>
                  <tr className={styles.operationalTableHeaderRow}>
                    <th scope="col" className={styles.operationalTableHeadCell}>Invoice #</th>
                    <th scope="col" className={styles.operationalTableHeadCell}>Job Ref</th>
                    <th scope="col" className={styles.operationalTableHeadCell}>Client</th>
                    <th scope="col" className={styles.operationalTableHeadCell}>Date</th>
                    <th scope="col" className={styles.operationalTableHeadCell}>Due Date</th>
                    <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.operationalTableActionHeadCell}`} style={{ textAlign: 'right' }}>Amount</th>
                    <th scope="col" className={styles.operationalTableHeadCell}>Status</th>
                    <th scope="col" className={`${styles.operationalTableHeadCell} ${styles.operationalTableActionHeadCell}`}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className={`${styles.operationalTableRow} xdrive-table-row`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/admin/invoices/${invoice.id}`)}
                    >
                      <td className={styles.operationalTableCell}>
                        <strong>{invoice.invoiceNumber}</strong>
                      </td>
                      <td className={styles.operationalTableCell}>{invoice.jobRef}</td>
                      <td className={styles.operationalTableCell}>{invoice.clientName}</td>
                      <td className={styles.operationalTableCell}>{new Date(invoice.date).toLocaleDateString('en-GB')}</td>
                      <td className={styles.operationalTableCell}>{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</td>
                      <td className={`${styles.operationalTableCell} ${styles.operationalTableActionCell}`} style={{ textAlign: 'right', fontWeight: 600 }}>
                        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(invoice.amount)}
                      </td>
                      <td className={styles.operationalTableCell}>
                        <StatusBadge value={invoice.status} />
                      </td>
                      <td className={`${styles.operationalTableCell} ${styles.operationalTableActionCell}`}>
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <div style={{ display: 'inline-flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          <ActionButton
                            tone="secondary"
                            onClick={() => router.push(`/admin/invoices/${invoice.id}`)}
                          >
                            View
                          </ActionButton>
                          {toCanonicalPaymentStatus(invoice.paymentStatus) !== 'paid' && (
                            <ActionButton
                              tone="success"
                              onClick={() => router.push(`/admin/invoices/${invoice.id}`)}
                            >
                              Record Payment
                            </ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination — Section 11: 36px controls; 12px/600 text */}
        {!loading && filteredInvoices.length > INVOICES_PER_PAGE && (
          <div className={styles.operationalTableMeta} style={{ marginTop: '8px' }}>
            <span>
              Showing {safeInvoicePage * INVOICES_PER_PAGE + 1}–{Math.min((safeInvoicePage + 1) * INVOICES_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <ActionButton tone="secondary" disabled={safeInvoicePage === 0} onClick={() => setInvoicePage((prev) => Math.max(prev - 1, 0))}>
                Previous
              </ActionButton>
              <ActionButton tone="secondary" disabled={safeInvoicePage >= totalInvoicePages - 1} onClick={() => setInvoicePage((prev) => Math.min(prev + 1, totalInvoicePages - 1))}>
                Next
              </ActionButton>
            </div>
          </div>
        )}

        {/* Summary KPI strip — Section 8: gap 8px, equal-width tiles */}
        {filteredInvoices.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <ExchangeKpiStrip>
              <KpiCard label="Total invoices" value={filteredInvoices.length} tone="navy" />
              <KpiCard
                label="Total amount"
                value={new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0))}
                tone="green"
              />
              <KpiCard
                label="Overdue"
                value={filteredInvoices.filter(i => i.status === 'Overdue').length}
                tone={filteredInvoices.some(i => i.status === 'Overdue') ? 'red' : 'grey'}
              />
              <KpiCard
                label="Pending payment"
                value={filteredInvoices.filter(i => i.status === 'Sent').length}
                tone="blue"
              />
            </ExchangeKpiStrip>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
