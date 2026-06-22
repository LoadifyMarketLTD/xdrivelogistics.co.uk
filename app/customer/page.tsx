'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType } from '../../lib/types/database';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import { loadCompanySettings } from '../../lib/companySettings';
import type { InvoiceData } from '../components/InvoiceTemplate';
import {
  toCanonicalInvoiceStatusWithDueDate,
  type CanonicalInvoiceStatus,
} from '../../lib/invoiceStatus';

type CustomerJob = {
  id: string;
  status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  delivery_photos: string[] | null;
  created_at: string;
  updated_at: string;
};

type CustomerInvoice = {
  id: string;
  invoice_number: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: CanonicalInvoiceStatus;
  amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: 0 | 5 | 20;
  payment_terms: string;
  late_fee: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  pickup_location: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_datetime: string | null;
  delivery_recipient: string | null;
  service_description: string | null;
  pod_photos: string[] | null;
  signature: string | null;
  recipient_name: string | null;
  created_at: string;
};

type CustomerTab = 'dashboard' | 'post' | 'loads' | 'quotes' | 'deliveries' | 'pod' | 'invoices' | 'account';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];
const CARGO_TYPES: CargoType[] = ['documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#e0f2fe', text: '#075985' },
  accepted: { bg: '#d1fae5', text: '#065f46' },
  declined: { bg: '#fee2e2', text: '#991b1b' },
  posted: { bg: '#dbeafe', text: '#1d4ed8' },
  awarded: { bg: '#f3e8ff', text: '#6d28d9' },
  allocated: { bg: '#e0f2fe', text: '#0c4a6e' },
  collected: { bg: '#fef3c7', text: '#92400e' },
  in_transit: { bg: '#ede9fe', text: '#5b21b6' },
  delivered: { bg: '#dcfce7', text: '#166534' },
  invoiced: { bg: '#cffafe', text: '#155e75' },
  paid: { bg: '#dcfce7', text: '#14532d' },
  Draft: { bg: '#fef3c7', text: '#92400e' },
  Sent: { bg: '#e0e7ff', text: '#3730a3' },
  Overdue: { bg: '#fee2e2', text: '#991b1b' },
  Paid: { bg: '#d1fae5', text: '#065f46' },
  Disputed: { bg: '#fce7f3', text: '#9d174d' },
  Cancelled: { bg: '#e2e8f0', text: '#475569' },
};

const dateDisplay = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-GB');
};

const toInvoiceData = (invoice: CustomerInvoice): InvoiceData => ({
  id: invoice.id,
  invoiceNumber: invoice.invoice_number,
  jobRef: invoice.job_id ? invoice.job_id.slice(0, 8).toUpperCase() : invoice.invoice_number,
  date: invoice.invoice_date,
  dueDate: invoice.due_date,
  status: toCanonicalInvoiceStatusWithDueDate(invoice.status, invoice.due_date),
  clientName: invoice.client_name,
  clientAddress: invoice.client_address ?? '',
  clientEmail: invoice.client_email ?? '',
  pickupLocation: invoice.pickup_location ?? '',
  pickupDateTime: invoice.pickup_datetime ?? '',
  deliveryLocation: invoice.delivery_location ?? '',
  deliveryDateTime: invoice.delivery_datetime ?? '',
  deliveryRecipient: invoice.delivery_recipient ?? '',
  serviceDescription: invoice.service_description ?? '',
  amount: Number(invoice.amount ?? 0),
  netAmount: Number(invoice.net_amount ?? invoice.amount ?? 0),
  vatAmount: Number(invoice.vat_amount ?? 0),
  vatRate: invoice.vat_rate,
  paymentTerms: invoice.payment_terms === 'Pay now' || invoice.payment_terms === '30 days' ? invoice.payment_terms : '14 days',
  lateFee: invoice.late_fee ?? '',
  podPhotos: invoice.pod_photos ?? undefined,
  signature: invoice.signature ?? undefined,
  recipientName: invoice.recipient_name ?? undefined,
});

export default function CustomerPage() {
  const { user, logout } = useAuth();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [activeTab, setActiveTab] = useState<CustomerTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    pickup_location: '',
    delivery_location: '',
    pickup_datetime: '',
    vehicle_type: 'van_large' as VehicleType,
    cargo_type: 'packages' as CargoType,
    notes: '',
  });
  const [formData, setFormData] = useState({
    pickup_location: '',
    delivery_location: '',
    vehicle_type: 'van_large' as VehicleType,
    cargo_type: 'packages' as CargoType,
    customer_phone: '',
  });

  useEffect(() => {
    let cancelled = false;
    const resolveCompanyId = async () => {
      if (!isSupabaseConfigured || !user?.id) {
        if (!cancelled) setResolvedCompanyId(user?.companyId ?? null);
        return;
      }
      if (user.companyId) {
        if (!cancelled) setResolvedCompanyId(user.companyId);
        return;
      }
      const { data: membership } = await supabase
        .from('company_memberships')
        .select('company_id')
        .eq('user_id', user.id)
        .neq('status', 'suspended')
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setResolvedCompanyId((membership?.company_id as string) ?? null);
      }
    };
    void resolveCompanyId();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.companyId]);

  const loadPortalData = async () => {
    setLoading(true);
    setPageMessage('');
    if (!isSupabaseConfigured || !user?.email) {
      setLoading(false);
      return;
    }
    if (!resolvedCompanyId) {
      setQuotes([]);
      setJobs([]);
      setInvoices([]);
      setPageMessage('Your customer account is not linked to a company yet. Portal data is unavailable until a company invites you.');
      setLoading(false);
      return;
    }

    const [quoteRes, jobsRes, invoicesRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, company_id, created_by, customer_name, customer_email, customer_phone, pickup_location, delivery_location, vehicle_type, cargo_type, amount, currency, status, created_at')
        .eq('company_id', resolvedCompanyId)
        .eq('customer_email', user.email)
        .order('created_at', { ascending: false }),
      supabase
        .from('jobs')
        .select('id, status, pickup_location, delivery_location, pickup_datetime, delivery_datetime, delivery_photos, created_at, updated_at')
        .eq('company_id', resolvedCompanyId)
        .eq('client_email', user.email)
        .order('updated_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, job_id, invoice_date, due_date, status, amount, net_amount, vat_amount, vat_rate, payment_terms, late_fee, client_name, client_email, client_address, pickup_location, pickup_datetime, delivery_location, delivery_datetime, delivery_recipient, service_description, pod_photos, signature, recipient_name, created_at')
        .eq('company_id', resolvedCompanyId)
        .eq('client_email', user.email)
        .order('created_at', { ascending: false }),
    ]);

    if (quoteRes.error || jobsRes.error || invoicesRes.error) {
      const message = quoteRes.error?.message ?? jobsRes.error?.message ?? invoicesRes.error?.message ?? 'Unable to load portal data.';
      setPageMessage(`Unable to load portal data: ${message}`);
      setQuotes([]);
      setJobs([]);
      setInvoices([]);
      setLoading(false);
      return;
    }

    setQuotes((quoteRes.data ?? []) as Quote[]);
    setJobs((jobsRes.data ?? []) as CustomerJob[]);
    const normalizedInvoices = ((invoicesRes.data ?? []) as CustomerInvoice[]).map((invoice) => ({
      ...invoice,
      status: toCanonicalInvoiceStatusWithDueDate(invoice.status, invoice.due_date),
    }));
    setInvoices(normalizedInvoices);
    setLoading(false);
  };

  useEffect(() => {
    void loadPortalData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, resolvedCompanyId]);

  const handleRequestQuote = async () => {
    setFormError('');
    if (!formData.pickup_location.trim()) { setFormError('Pickup location is required'); return; }
    if (!formData.delivery_location.trim()) { setFormError('Delivery location is required'); return; }
    if (!isSupabaseConfigured || !user?.email || !resolvedCompanyId) { setFormError('Your account is not linked to a company yet. Quote requests are unavailable.'); return; }

    const { error } = await supabase.from('quotes').insert([{
      company_id: resolvedCompanyId,
      customer_name: user.email.split('@')[0],
      customer_email: user.email,
      customer_phone: formData.customer_phone || null,
      pickup_location: formData.pickup_location,
      delivery_location: formData.delivery_location,
      vehicle_type: formData.vehicle_type,
      cargo_type: formData.cargo_type,
      currency: 'GBP',
      status: 'draft',
    }]);

    if (error) { setFormError(error.message); return; }

    setShowModal(false);
    setFormData({ pickup_location: '', delivery_location: '', vehicle_type: 'van_large', cargo_type: 'packages', customer_phone: '' });
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 4000);
    void loadPortalData();
  };

  const handleDownloadInvoice = async (invoice: CustomerInvoice) => {
    if (!resolvedCompanyId) return;
    setDownloadingInvoiceId(invoice.id);
    try {
      const companySettings = await loadCompanySettings(supabase, resolvedCompanyId);
      await downloadInvoicePdf({
        invoice: toInvoiceData(invoice),
        companySettings,
      });
    } catch (error) {
      setPageMessage(error instanceof Error ? `Unable to download invoice PDF: ${error.message}` : 'Unable to download invoice PDF.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleBookDelivery = async () => {
    setBookingError('');
    setBookingSuccess(false);
    if (!bookingForm.pickup_location.trim()) { setBookingError('Pickup location is required'); return; }
    if (!bookingForm.delivery_location.trim()) { setBookingError('Delivery location is required'); return; }
    setBookingLoading(true);

    // When the customer has a linked company, insert directly as a job
    if (isSupabaseConfigured && user?.id && resolvedCompanyId) {
      const { error } = await supabase.from('jobs').insert([{
        company_id: resolvedCompanyId,
        created_by: user.id,
        status: 'draft',
        pickup_location: bookingForm.pickup_location,
        delivery_location: bookingForm.delivery_location,
        pickup_datetime: bookingForm.pickup_datetime || null,
        vehicle_type: bookingForm.vehicle_type,
        cargo_type: bookingForm.cargo_type,
        notes: bookingForm.notes || null,
      }]);
      setBookingLoading(false);
      if (error) { setBookingError(error.message); return; }
      setBookingSuccess(true);
      setBookingForm({ pickup_location: '', delivery_location: '', pickup_datetime: '', vehicle_type: 'van_large', cargo_type: 'packages', notes: '' });
      await loadPortalData();
      return;
    }

    // Fallback: no company linked — submit via the public quote-request endpoint
    // This ensures new customers can always request a delivery even before being invited to a company.
    const res = await fetch('/api/public/quote-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: user?.email?.split('@')[0] ?? 'Customer',
        email: user?.email ?? '',
        phone: '',
        pickupLocation: bookingForm.pickup_location,
        deliveryLocation: bookingForm.delivery_location,
        cargoType: (['pallets', 'furniture', 'documents', 'other'].includes(bookingForm.cargo_type)
          ? bookingForm.cargo_type
          : 'other') as 'pallets' | 'furniture' | 'documents' | 'other',
        quantity: '',
        notes: [
          bookingForm.pickup_datetime ? `Requested pickup: ${bookingForm.pickup_datetime}` : null,
          `Vehicle: ${bookingForm.vehicle_type.replace(/_/g, ' ')}`,
          bookingForm.notes || null,
        ].filter(Boolean).join(' | '),
      }),
    });
    setBookingLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setBookingError(body.error ?? 'Failed to submit booking. Please try again.');
      return;
    }
    setBookingSuccess(true);
    setBookingForm({ pickup_location: '', delivery_location: '', pickup_datetime: '', vehicle_type: 'van_large', cargo_type: 'packages', notes: '' });
  };

  const tabCounts = useMemo(() => ({
    openLoads: jobs.filter((job) => ['draft', 'posted'].includes(job.status)).length,
    quotesWaiting: quotes.filter((quote) => ['draft', 'sent', 'submitted', 'received'].includes(quote.status)).length,
    activeDeliveries: jobs.filter((job) => ['allocated', 'collected', 'in_transit'].includes(job.status)).length,
    completedThisMonth: jobs.filter((job) => {
      if (job.status !== 'delivered') return false;
      const updated = new Date(job.updated_at);
      const now = new Date();
      return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
    }).length,
    unpaidInvoices: invoices.filter((invoice) => invoice.status !== 'Paid').length,
    quotes: quotes.length,
    jobs: jobs.length,
    invoices: invoices.length,
  }), [quotes, jobs, invoices]);

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 50 }}>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.72rem', margin: 0, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Shipper workspace</p>
            <h1 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Customer Dashboard</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('post')} style={{ padding: '0.55rem 0.95rem', backgroundColor: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              Post Load
            </button>
            <span style={{ color: '#64748b', fontSize: '0.8rem', wordBreak: 'break-word' }}>{user?.email}</span>
            <button onClick={() => logout()} style={{ padding: '0.5rem 0.85rem', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              Sign out
            </button>
          </div>
        </header>

        <main style={{ width: '100%', padding: '1rem' }}>
          {pageMessage && <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem 1.5rem', marginBottom: '1.5rem', color: '#92400e', fontWeight: '600' }}>{pageMessage}</div>}

          {submitSuccess && <div style={{ backgroundColor: '#dcfce7', border: '1px solid #1F7A3D', borderRadius: '8px', padding: '1rem 1.5rem', marginBottom: '1.5rem', color: '#14532d', fontWeight: '600' }}>✅ Your quote request has been submitted. We&apos;ll be in touch shortly.</div>}

          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap' }}>
            {([
              ['dashboard', 'Dashboard'],
              ['post', 'Post Load'],
              ['loads', `My Loads (${tabCounts.openLoads})`],
              ['quotes', `Quotes Received (${tabCounts.quotes})`],
              ['deliveries', `Active Deliveries (${tabCounts.activeDeliveries})`],
              ['pod', 'POD'],
              ['invoices', `Invoices (${tabCounts.invoices})`],
              ['account', 'Account'],
            ] as Array<[CustomerTab, string]>).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent',
                  background: 'none',
                  padding: '0.75rem 1rem',
                  color: activeTab === tab ? '#1d4ed8' : '#64748b',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'dashboard' && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
                {[
                  ['Open loads', tabCounts.openLoads],
                  ['Quotes waiting', tabCounts.quotesWaiting],
                  ['Active deliveries', tabCounts.activeDeliveries],
                  ['Completed this month', tabCounts.completedThisMonth],
                  ['Unpaid invoices', tabCounts.unpaidInvoices],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f172a' }}>Recent posted loads</h2>
                  {jobs.slice(0, 4).map((job) => (
                    <div key={job.id} style={{ borderTop: '1px solid #f1f5f9', padding: '0.65rem 0', fontSize: '0.86rem', color: '#334155' }}>
                      <strong>{job.pickup_location || 'Pickup TBC'}</strong> to <strong>{job.delivery_location || 'Delivery TBC'}</strong>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{job.status} - {dateDisplay(job.updated_at)}</div>
                    </div>
                  ))}
                  {jobs.length === 0 && <div style={{ color: '#64748b', fontSize: '0.86rem' }}>No posted loads yet.</div>}
                </section>
                <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                  <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#0f172a' }}>Quotes received</h2>
                  {quotes.slice(0, 4).map((quote) => (
                    <div key={quote.id} style={{ borderTop: '1px solid #f1f5f9', padding: '0.65rem 0', fontSize: '0.86rem', color: '#334155' }}>
                      <strong>{quote.pickup_location || 'Pickup TBC'}</strong> to <strong>{quote.delivery_location || 'Delivery TBC'}</strong>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{quote.amount ? `£${quote.amount.toFixed(2)}` : 'Awaiting price'} - {quote.status}</div>
                    </div>
                  ))}
                  {quotes.length === 0 && <div style={{ color: '#64748b', fontSize: '0.86rem' }}>No quotes received yet.</div>}
                </section>
              </div>
            </div>
          )}

          {activeTab === 'quotes' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>Quotes Received</h2>
                <button onClick={() => setShowModal(true)} disabled={!resolvedCompanyId} style={{ padding: '0.7rem 1.2rem', backgroundColor: resolvedCompanyId ? '#1F7A3D' : '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: resolvedCompanyId ? 'pointer' : 'not-allowed' }}>
                  + Request a Quote
                </button>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div> : quotes.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No quote requests yet.</div> : (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{['Pickup', 'Delivery', 'Vehicle', 'Cargo', 'Amount', 'Status', 'Date'].map((h) => <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {quotes.map((q, i) => {
                          const sc = STATUS_COLORS[q.status] ?? STATUS_COLORS.draft;
                          return (
                            <tr key={q.id} style={{ borderBottom: i < quotes.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '1rem' }}>{q.pickup_location || '—'}</td>
                              <td style={{ padding: '1rem' }}>{q.delivery_location || '—'}</td>
                              <td style={{ padding: '1rem', color: '#6b7280' }}>{q.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                              <td style={{ padding: '1rem', color: '#6b7280' }}>{q.cargo_type || '—'}</td>
                              <td style={{ padding: '1rem', fontWeight: 700 }}>{q.amount ? `£${q.amount.toFixed(2)}` : '—'}</td>
                              <td style={{ padding: '1rem' }}><span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{q.status}</span></td>
                              <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.85rem' }}>{new Date(q.created_at).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {(['loads', 'deliveries', 'pod'] as CustomerTab[]).includes(activeTab) && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading jobs…</div> : jobs.length === 0 ? <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.2rem', color: '#6b7280' }}>No jobs found for your account yet.</div> : jobs.map((job) => {
                const color = STATUS_COLORS[job.status] ?? STATUS_COLORS.draft;
                return (
                  <div key={job.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{job.pickup_location || '—'} → {job.delivery_location || '—'}</div>
                      <span style={{ background: color.bg, color: color.text, padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.78rem' }}>{job.status}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.7rem' }}>
                      <div style={{ fontSize: '0.83rem', color: '#475569' }}>Pickup: {dateDisplay(job.pickup_datetime)}</div>
                      <div style={{ fontSize: '0.83rem', color: '#475569' }}>Delivery: {dateDisplay(job.delivery_datetime)}</div>
                    </div>
                    <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#94a3b8' }}>Last update: {dateDisplay(job.updated_at)}</div>
                    <div style={{ marginTop: '0.7rem' }}>
                      <strong style={{ fontSize: '0.83rem', color: '#334155' }}>Proof of delivery</strong>
                      {job.delivery_photos && job.delivery_photos.length > 0 ? (
                        <div style={{ marginTop: '0.55rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.55rem' }}>
                          {job.delivery_photos.map((photo, index) => (
                            <a key={`${job.id}-${index}`} href={photo} target="_blank" rel="noreferrer" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem', textDecoration: 'none', color: '#1d4ed8', fontSize: '0.8rem', background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              POD photo {index + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>No POD uploaded yet.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'post' && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', maxWidth: '560px' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Post Load / Create Transport Job</h2>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: '#64748b' }}>Create a transport request, receive quotes, award a carrier and track the delivery.</p>
              {!resolvedCompanyId && (
                <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.86rem', color: '#854d0e' }}>
                  ℹ️ Your account isn&apos;t linked to a company yet. Bookings submitted here will be handled by the XDrive operations team and you&apos;ll be contacted to confirm.
                </div>
              )}
              {bookingSuccess && <div style={{ background: '#dcfce7', border: '1px solid #1F7A3D', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', color: '#14532d', fontWeight: 600 }}>✅ Booking submitted! Our team will be in touch to confirm your delivery.{resolvedCompanyId ? ' Check the Jobs tab to track progress.' : ''}</div>}
              {bookingError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem' }}>{bookingError}</div>}
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Pickup Location *</label>
                  <input style={inputStyle} value={bookingForm.pickup_location} onChange={e => setBookingForm({...bookingForm, pickup_location: e.target.value})} placeholder="e.g. London, SW1A 1AA" />
                </div>
                <div>
                  <label style={labelStyle}>Delivery Location *</label>
                  <input style={inputStyle} value={bookingForm.delivery_location} onChange={e => setBookingForm({...bookingForm, delivery_location: e.target.value})} placeholder="e.g. Manchester, M1 1AE" />
                </div>
                <div>
                  <label style={labelStyle}>Requested Pickup Date & Time</label>
                  <input style={inputStyle} type="datetime-local" value={bookingForm.pickup_datetime} onChange={e => setBookingForm({...bookingForm, pickup_datetime: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Vehicle Type</label>
                    <select style={inputStyle} value={bookingForm.vehicle_type} onChange={e => setBookingForm({...bookingForm, vehicle_type: e.target.value as VehicleType})}>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cargo Type</label>
                    <select style={inputStyle} value={bookingForm.cargo_type} onChange={e => setBookingForm({...bookingForm, cargo_type: e.target.value as CargoType})}>
                      {CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Additional Notes</label>
                  <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={bookingForm.notes} onChange={e => setBookingForm({...bookingForm, notes: e.target.value})} placeholder="Any special instructions, fragile items, access restrictions…" />
                </div>
                <button
                  onClick={() => { void handleBookDelivery(); }}
                  disabled={bookingLoading}
                  style={{ padding: '0.85rem', background: bookingLoading ? '#9ca3af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: bookingLoading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}
                >
                  {bookingLoading ? 'Submitting…' : 'Submit Booking'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading invoices…</div> : invoices.length === 0 ? <div style={{ padding: '1.4rem', textAlign: 'center', color: '#6b7280' }}>No invoices available for your account.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                        {['Invoice #', 'Job Ref', 'Date', 'Due', 'Amount', 'Status', 'Actions'].map((h) => (
                          <th key={h} style={{ padding: '0.8rem', textAlign: h === 'Amount' ? 'right' : 'left', fontSize: '0.8rem', color: '#64748b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice, index) => {
                        const color = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.Draft;
                        return (
                          <tr key={invoice.id} style={{ borderBottom: index < invoices.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <td style={{ padding: '0.8rem', fontWeight: 600 }}>{invoice.invoice_number}</td>
                            <td style={{ padding: '0.8rem' }}>{invoice.job_id ? invoice.job_id.slice(0, 8).toUpperCase() : '—'}</td>
                            <td style={{ padding: '0.8rem' }}>{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</td>
                            <td style={{ padding: '0.8rem' }}>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td>
                            <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: 700 }}>£{Number(invoice.amount ?? 0).toFixed(2)}</td>
                            <td style={{ padding: '0.8rem' }}><span style={{ background: color.bg, color: color.text, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{invoice.status}</span></td>
                            <td style={{ padding: '0.8rem' }}>
                              <button
                                onClick={() => void handleDownloadInvoice(invoice)}
                                disabled={downloadingInvoiceId === invoice.id}
                                style={{ padding: '0.35rem 0.7rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '6px', cursor: downloadingInvoiceId === invoice.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.78rem' }}
                              >
                                {downloadingInvoiceId === invoice.id ? 'Preparing…' : 'Download PDF'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.25rem', maxWidth: '620px' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: '#0f172a' }}>Account</h2>
              <div style={{ display: 'grid', gap: '0.7rem', fontSize: '0.9rem', color: '#334155' }}>
                <div><strong>Email:</strong> {user?.email ?? 'Not available'}</div>
                <div><strong>Workspace:</strong> Customer / shipper</div>
                <div><strong>Access:</strong> Post loads, review quotes, track deliveries, download POD and invoices.</div>
              </div>
            </div>
          )}
        </main>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>Request a Quote</h2>
                <button onClick={() => { setShowModal(false); setFormError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                {formError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem', color: '#dc2626', fontSize: '0.9rem' }}>{formError}</div>}
                <div>
                  <label style={labelStyle}>Pickup Location *</label>
                  <input style={inputStyle} value={formData.pickup_location} onChange={e => setFormData({...formData, pickup_location: e.target.value})} placeholder="e.g. London, SW1A 1AA" />
                </div>
                <div>
                  <label style={labelStyle}>Delivery Location *</label>
                  <input style={inputStyle} value={formData.delivery_location} onChange={e => setFormData({...formData, delivery_location: e.target.value})} placeholder="e.g. Manchester, M1 1AE" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Vehicle Type</label>
                    <select style={inputStyle} value={formData.vehicle_type} onChange={e => setFormData({...formData, vehicle_type: e.target.value as VehicleType})}>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cargo Type</label>
                    <select style={inputStyle} value={formData.cargo_type} onChange={e => setFormData({...formData, cargo_type: e.target.value as CargoType})}>
                      {CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <input style={inputStyle} type="tel" value={formData.customer_phone} onChange={e => setFormData({...formData, customer_phone: e.target.value})} placeholder="07123 456789" />
                </div>
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setShowModal(false); setFormError(''); }} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleRequestQuote} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Submit Request</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
