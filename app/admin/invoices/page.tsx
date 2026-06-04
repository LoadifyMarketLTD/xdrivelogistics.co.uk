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

function dbToInvoiceData(row: Record<string, unknown>, fallbackId: string): InvoiceData {
  const invoiceDate =
    typeof row.invoice_date === 'string'
      ? row.invoice_date
      : typeof row.created_at === 'string'
        ? row.created_at
        : new Date().toISOString();
  const dueDate = typeof row.due_date === 'string' ? row.due_date : invoiceDate;
  const paymentTerms = row.payment_terms === 'Pay now' || row.payment_terms === '30 days' ? row.payment_terms : '14 days';
  const status =
    row.status === 'Paid' || row.status === 'Overdue' || row.status === 'Pending'
      ? row.status
      : 'Pending';
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
  };
}

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  const loadRequestRef = useRef(0);

  const calculateStatus = (dueDate: string, currentStatus: string): 'Paid' | 'Pending' | 'Overdue' => {
    if (currentStatus === 'Paid') return 'Paid';
    const today = new Date();
    const due = new Date(dueDate);
    return today > due ? 'Overdue' : 'Pending';
  };

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
      'id', 'company_id', 'created_by', 'invoice_number', 'job_ref', 'job_id', 'invoice_date', 'due_date', 'status',
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

  const getStatusStyle = (status: string) => {
    const baseStyle: React.CSSProperties = {
      padding: '0.375rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.875rem',
      fontWeight: '600',
      display: 'inline-block',
    };

    switch (status) {
      case 'Paid':
        return { ...baseStyle, backgroundColor: '#d1fae5', color: '#065f46' };
      case 'Pending':
        return { ...baseStyle, backgroundColor: '#fef3c7', color: '#92400e' };
      case 'Overdue':
        return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' };
      default:
        return { ...baseStyle, backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1rem' }}>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: 0, color: '#111827' }}>Invoices</h1>
              <p style={{ margin: '0.35rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>Manage invoice lifecycle and payment status.</p>
            </div>
            <button
              onClick={() => router.push('/admin/invoices/new')}
              style={{ padding: '0.65rem 1.2rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Create Invoice
            </button>
          </div>
          {loadError && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.9rem 1rem', marginBottom: '1rem', color: '#b91c1c' }}>
              {loadError}
            </div>
          )}

          {/* Controls */}
          <div style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '250px',
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Paid' | 'Pending' | 'Overdue')}
                  style={{
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    outline: 'none'
                  }}
                >
                  <option value="All">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <button onClick={() => void loadInvoices()} style={{ padding: '0.65rem 0.9rem', backgroundColor: 'white', color: '#1f2937', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Refresh</button>
            </div>
          </div>

          {/* Invoices Table */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: '#6b7280', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
                Loading invoices...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div style={{
                padding: '3rem 2rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
                <h3 style={{ fontSize: '1.25rem', color: '#1f2937', marginBottom: '0.5rem' }}>
                  No invoices found
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                  {searchTerm || statusFilter !== 'All'
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating your first invoice'}
                </p>
                {!searchTerm && statusFilter === 'All' && (
                  <button
                    onClick={() => router.push('/admin/invoices/new')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    Create First Invoice
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Invoice #
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Job Ref
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Client
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Date
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Due Date
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Amount
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Status
                      </th>
                      <th style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background-color 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        onClick={() => router.push(`/admin/invoices/${invoice.id}`)}
                      >
                        <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#1f2937', fontWeight: '500' }}>
                          {invoice.invoiceNumber}
                        </td>
                        <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#1f2937' }}>
                          {invoice.jobRef}
                        </td>
                        <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#1f2937' }}>
                          {invoice.clientName}
                        </td>
                        <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#6b7280' }}>
                          {new Date(invoice.date).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#6b7280' }}>
                          {new Date(invoice.dueDate).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#1f2937', fontWeight: '600', textAlign: 'right' }}>
                          £{invoice.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                          <span style={getStatusStyle(invoice.status)}>
                            {invoice.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/invoices/${invoice.id}`);
                            }}
                            style={{
                              padding: '0.4rem 0.8rem',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          {filteredInvoices.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Invoices</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                  {filteredInvoices.length}
                </div>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                borderLeft: '4px solid #10b981'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Amount</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                  £{filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
