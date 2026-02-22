'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../../components/AuthContext';
import type { Invoice } from '../../../lib/types/database';

type InvoiceStatus = 'All' | 'Paid' | 'Pending' | 'Overdue';

function calculateStatus(dueDate: string, currentStatus: string): 'Paid' | 'Pending' | 'Overdue' {
  if (currentStatus === 'Paid') return 'Paid';
  const today = new Date();
  const due = new Date(dueDate);
  return today > due ? 'Overdue' : 'Pending';
}

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('All');
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      const updated = (data as Invoice[]).map((inv) => ({
        ...inv,
        status: calculateStatus(inv.due_date, inv.status),
      }));
      setInvoices(updated);
    }
    setLoading(false);
  };

  useEffect(() => { loadInvoices(); }, [user]); // eslint-disable-line react-hooks/set-state-in-effect

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.job_ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase());
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
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#1e293b',
          color: 'white',
          padding: '1.5rem 2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
                  Invoices
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>
                  Manage and track all invoices
                </p>
              </div>
              <button
                onClick={() => router.push('/admin')}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              >
                ← Back to Admin
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          {/* Controls */}
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '250px',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus)}
                  style={{
                    padding: '0.75rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
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
                  transition: 'background-color 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                + Create New Invoice
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#6b7280' }}>Loading invoices…</div>
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
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Invoice #</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Job Ref</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Client</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Date</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Due Date</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Amount</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Actions</th>
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
                        <td style={{ padding: '1rem', fontSize: '0.95rem', color: '#1f2937', fontWeight: '500' }}>{invoice.invoice_number}</td>
                        <td style={{ padding: '1rem', fontSize: '0.95rem', color: '#1f2937' }}>{invoice.job_ref}</td>
                        <td style={{ padding: '1rem', fontSize: '0.95rem', color: '#1f2937' }}>{invoice.client_name}</td>
                        <td style={{ padding: '1rem', fontSize: '0.95rem', color: '#6b7280' }}>{new Date(invoice.date).toLocaleDateString('en-GB')}</td>
                        <td style={{ padding: '1rem', fontSize: '0.95rem', color: '#6b7280' }}>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td>
                        <td style={{ padding: '1rem', fontSize: '0.95rem', color: '#1f2937', fontWeight: '600', textAlign: 'right' }}>£{invoice.amount.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={getStatusStyle(invoice.status)}>{invoice.status}</span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/admin/invoices/${invoice.id}`); }}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
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
                padding: '1.25rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Invoices</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                  {filteredInvoices.length}
                </div>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '1.25rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
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
