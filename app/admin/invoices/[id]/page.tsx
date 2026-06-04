'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import InvoiceTemplate, { InvoiceData } from '../../../components/InvoiceTemplate';
import { COMPANY_CONFIG } from '../../../config/company';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { useAuth } from '../../../components/AuthContext';
import {
  DEFAULT_COMPANY_SETTINGS,
  hasConfiguredBankDetails,
  loadCompanySettings,
  type CompanySettingsValues,
} from '../../../../lib/companySettings';
import { downloadInvoicePdf } from '../../../../lib/invoicePdf';
import { resolveActiveCompanyId } from '../../../../lib/activeCompany';
import type { Invoice } from '../../../../lib/types/database';

/** Map InvoiceData (UI shape) → Supabase invoice row (DB shape) */
function invoiceDataToDb(inv: InvoiceData, companyId: string, userId?: string | null): Omit<Invoice, 'created_at' | 'updated_at'> {
  return {
    id: inv.id,
    company_id: companyId,
    created_by: userId ?? null,
    invoice_number: inv.invoiceNumber,
    job_ref: inv.jobRef,
    job_id: null,
    invoice_date: inv.date,
    due_date: inv.dueDate,
    status: inv.status,
    client_name: inv.clientName,
    client_address: inv.clientAddress || null,
    client_email: inv.clientEmail || null,
    pickup_location: inv.pickupLocation || null,
    pickup_datetime: inv.pickupDateTime || null,
    delivery_location: inv.deliveryLocation || null,
    delivery_datetime: inv.deliveryDateTime || null,
    delivery_recipient: inv.deliveryRecipient || null,
    service_description: inv.serviceDescription || null,
    amount: inv.amount,
    net_amount: inv.netAmount,
    vat_amount: inv.vatAmount,
    vat_rate: inv.vatRate,
    currency: 'GBP',
    payment_terms: inv.paymentTerms,
    late_fee: inv.lateFee || null,
    pod_photos: inv.podPhotos ?? null,
    signature: inv.signature ?? null,
    recipient_name: inv.recipientName ?? null,
  };
}

/** Map Supabase Invoice row → InvoiceData used by the UI */
function dbToInvoiceData(row: Invoice): InvoiceData {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    jobRef: row.job_ref,
    date: row.invoice_date,
    dueDate: row.due_date,
    status: row.status,
    clientName: row.client_name,
    clientAddress: row.client_address ?? '',
    clientEmail: row.client_email ?? '',
    pickupLocation: row.pickup_location ?? '',
    pickupDateTime: row.pickup_datetime ?? '',
    deliveryLocation: row.delivery_location ?? '',
    deliveryDateTime: row.delivery_datetime ?? '',
    deliveryRecipient: row.delivery_recipient ?? '',
    serviceDescription: row.service_description ?? '',
    amount: Number(row.amount),
    netAmount: Number(row.net_amount),
    vatAmount: Number(row.vat_amount),
    vatRate: row.vat_rate as 0 | 5 | 20,
    paymentTerms: (row.payment_terms as 'Pay now' | '14 days' | '30 days') ?? '14 days',
    lateFee: row.late_fee ?? '',
    podPhotos: row.pod_photos ?? undefined,
    signature: row.signature ?? undefined,
    recipientName: row.recipient_name ?? undefined,
  };
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params?.id as string;
  const isNew = invoiceId === 'new';
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettingsValues>(DEFAULT_COMPANY_SETTINGS);

  // Read optional job pre-fill values from URL search params (no localStorage)
  const prefillJobRef = searchParams?.get('jobRef') ?? '';
  const prefillClientName = searchParams?.get('clientName') ?? '';
  const prefillClientEmail = searchParams?.get('clientEmail') ?? '';
  const prefillPickupLocation = searchParams?.get('pickupLocation') ?? '';
  const prefillPickupDateTime = searchParams?.get('pickupDateTime') ?? '';
  const prefillDeliveryLocation = searchParams?.get('deliveryLocation') ?? '';
  const prefillDeliveryDateTime = searchParams?.get('deliveryDateTime') ?? '';
  const prefillServiceDescription = searchParams?.get('serviceDescription') ?? '';

  const [formData, setFormData] = useState<InvoiceData>({
    id: '',
    invoiceNumber: '',
    jobRef: prefillJobRef,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'Pending',
    clientName: prefillClientName,
    clientAddress: '',
    clientEmail: prefillClientEmail,
    pickupLocation: prefillPickupLocation,
    pickupDateTime: prefillPickupDateTime,
    deliveryLocation: prefillDeliveryLocation,
    deliveryDateTime: prefillDeliveryDateTime,
    deliveryRecipient: '',
    serviceDescription: prefillServiceDescription,
    amount: 0,
    paymentTerms: '14 days',
    lateFee: COMPANY_CONFIG.payment.lateFeeNote,
    vatRate: COMPANY_CONFIG.vat.defaultRate as 0 | 5 | 20,
    netAmount: 0,
    vatAmount: 0,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Load the company ID for the current user (needed to write invoices to Supabase)
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let cancelled = false;
    const fetchCompanyId = async () => {
      if (user.companyId) {
        setCompanyId(user.companyId);
        return;
      }
      const resolvedCompanyId = await resolveActiveCompanyId({
        userId: user.id,
        fallbackCompanyId: null,
      });
      if (cancelled) return;
      if (resolvedCompanyId) {
        setCompanyId(resolvedCompanyId);
        return;
      }
    };
    void fetchCompanyId();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !companyId) return;
    let cancelled = false;

    const fetchSettings = async () => {
      const settings = await loadCompanySettings(supabase, companyId);
      if (!cancelled) {
        setCompanySettings(settings);
      }
    };

    fetchSettings();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Load existing invoice once when invoiceId changes
  useEffect(() => {
    if (!isNew) {
      loadInvoice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, companyId, hasSupabaseSession]);

  // Generate new invoice data once on mount for new invoices;
  // re-run if companyId resolves so we can use the DB sequence number
  useEffect(() => {
    if (isNew) {
      generateNewInvoiceData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, companyId, companySettings.jobRefPrefix, companySettings.invoicePrefix]);

  useEffect(() => {
    if (!isNew) return;
    setFormData((prev) => ({
      ...prev,
      paymentTerms: companySettings.paymentTerms,
      lateFee: COMPANY_CONFIG.payment.lateFeeNote,
      vatRate: companySettings.defaultVatRate as 0 | 5 | 20,
    }));
  }, [companySettings, isNew]);

  useEffect(() => {
    if (formData.date && formData.paymentTerms) {
      const invoiceDate = new Date(formData.date);
      const daysToAdd = formData.paymentTerms === '14 days' ? 14 : 30;
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + daysToAdd);
      setFormData((prev) => ({
        ...prev,
        dueDate: dueDate.toISOString().split('T')[0],
      }));
    }
  }, [formData.date, formData.paymentTerms]);

  // Calculate VAT breakdown whenever amount or VAT rate changes
  useEffect(() => {
    if (formData.amount > 0) {
      const netAmount = formData.amount / (1 + formData.vatRate / 100);
      const vatAmount = formData.amount - netAmount;
      setFormData((prev) => ({
        ...prev,
        netAmount: Number(netAmount.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
      }));
    }
  }, [formData.amount, formData.vatRate]);

  // Generate unique Job Reference using timestamp to prevent collisions
  // Format: DC-YYMMDD-XXXX where XXXX is based on timestamp
  // NOTE: In production, use a proper sequential counter from database
  const generateJobRef = () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    // Use last 4 digits of timestamp + random component for better uniqueness
    const timePart = String(now.getTime()).slice(-3);
    const randomPart = String(Math.floor(Math.random() * 10));
    const xxxx = (timePart + randomPart).padStart(4, '0');
    return `${companySettings.jobRefPrefix}-${yy}${mm}${dd}-${xxxx}`;
  };

  // Generate unique Invoice Number using timestamp
  // Format: INV-YYYYMM-XXX
  // NOTE: In production, use a proper sequential counter from database
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Use last 3 digits of timestamp for better distribution
    const uniqueId = String(now.getTime()).slice(-3);
    return `${companySettings.invoicePrefix}-${year}${month}-${uniqueId}`;
  };

  const generateNewInvoiceData = async () => {
    const tempId = crypto.randomUUID ? crypto.randomUUID() : `invoice_${Date.now()}`;
    let invoiceNumber = generateInvoiceNumber();

    // Use the DB sequence helper when Supabase is available
    if (isSupabaseConfigured && companyId) {
      const { data } = await supabase.rpc('next_invoice_number', { p_company_id: companyId });
      if (data) invoiceNumber = data as string;
      // DB will assign the UUID on insert; keep the locally generated one for the form
    }

    const jobRef = generateJobRef();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    setFormData((prev) => ({
      ...prev,
      id: tempId,
      jobRef,
      invoiceNumber,
      dueDate: dueDate.toISOString().split('T')[0],
    }));
  };

  const loadInvoice = async () => {
    // Try Supabase first
    if (isSupabaseConfigured && hasSupabaseSession) {
      if (!companyId) {
        setSaveMessage('Company profile not loaded. Invoice data is unavailable.');
        return;
      }
      const { data, error } = await supabase
        .from('invoices')
        .select('id, company_id, created_by, invoice_number, job_ref, job_id, invoice_date, due_date, status, client_name, client_address, client_email, pickup_location, pickup_datetime, delivery_location, delivery_datetime, delivery_recipient, service_description, amount, net_amount, vat_amount, vat_rate, currency, payment_terms, late_fee, pod_photos, signature, recipient_name, created_at, updated_at')
        .eq('id', invoiceId)
        .eq('company_id', companyId)
        .single();
      if (!error && data) {
        setFormData(dbToInvoiceData(data as Invoice));
        return;
      }
      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load invoice from Supabase:', error.message);
      }
      setSaveMessage('Invoice not found');
      return;
    }
    setSaveMessage('A live Supabase session is required to access invoice data safely.');
  };

  const handleSave = async () => {
    // Save to Supabase when available
    if (isSupabaseConfigured && companyId) {
      const row = invoiceDataToDb(formData, companyId, user?.id);
      const { id: _id, company_id: _companyId, created_by: _createdBy, ...updateFields } = row;
      const { error } = isNew
        ? await supabase.from('invoices').insert([row])
        : await supabase
            .from('invoices')
            .update({
              ...updateFields,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)
            .eq('company_id', companyId);
      if (!error) {
        setSaveMessage('Invoice saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
        if (isNew) {
          setTimeout(() => router.push(`/admin/invoices/${row.id}`), 1000);
        }
        return;
      }
      console.error('Supabase save error:', error.message);
      setSaveMessage(`Error saving invoice: ${error.message}`);
      setTimeout(() => setSaveMessage(''), 4000);
      return;
    }
    if (isSupabaseConfigured && hasSupabaseSession && !companyId) {
      setSaveMessage('Company profile not loaded. Invoice cannot be saved safely.');
      setTimeout(() => setSaveMessage(''), 4000);
      return;
    }
    setSaveMessage('A live Supabase session is required to save invoices safely.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleWhatsAppShare = () => {
    const paymentLines = [];

    if (hasConfiguredBankDetails(companySettings)) {
      paymentLines.push(
        `Bank Transfer: Sort Code ${companySettings.bankSortCode}, Account ${companySettings.bankAccountNumber}`
      );
    }

    if (companySettings.paypalEmail) {
      paymentLines.push(`PayPal: ${companySettings.paypalEmail}`);
    }

    if (paymentLines.length === 0) {
      paymentLines.push('Payment details available on request.');
    }

    const message = encodeURIComponent(
      `Invoice ${formData.invoiceNumber}\n` +
      `Job Ref: ${formData.jobRef}\n` +
      `Amount: £${formData.amount.toFixed(2)}\n` +
      `Due Date: ${new Date(formData.dueDate).toLocaleDateString('en-GB')}\n\n` +
      `Please make payment via:\n` +
      paymentLines.join('\n')
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await downloadInvoicePdf({ invoice: formData, companySettings });
      setSaveMessage('Invoice PDF downloaded.');
    } catch (error) {
      console.error('Failed to download invoice PDF:', error);
      setSaveMessage('Error downloading invoice PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1e293b',
            color: 'white',
            padding: '1.5rem 2rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
                  {isNew ? 'Create New Invoice' : 'Edit Invoice'}
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>
                  {isNew ? 'Fill in the details below' : `Invoice ${formData.invoiceNumber}`}
                </p>
              </div>
              <button
                onClick={() => router.push('/admin/invoices')}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
              >
                ← Back to Invoices
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: '2rem' }}>
            {/* Form Section */}
            <div>
              {/* Action Buttons */}
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  marginBottom: '1.5rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSave}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
                  >
                    💾 Save Invoice
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                  >
                    👁️ {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                  <button
                    onClick={() => void handleDownloadPdf()}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                      opacity: downloadingPdf ? 0.7 : 1,
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4b5563')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6b7280')}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? '⏳ Preparing PDF…' : '⬇️ Download PDF'}
                  </button>
                  <button
                    onClick={handleWhatsAppShare}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#25d366',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#20ba5a')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#25d366')}
                  >
                    📱 WhatsApp
                  </button>
                </div>
                {saveMessage && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: saveMessage.includes('Error') ? '#fee2e2' : '#d1fae5',
                      color: saveMessage.includes('Error') ? '#991b1b' : '#065f46',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textAlign: 'center',
                    }}
                  >
                    {saveMessage}
                  </div>
                )}
              </div>

              {/* Invoice Details Form */}
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              >
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1.5rem' }}>
                  Invoice Details
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Invoice Number</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Job Reference</label>
                    <input
                      type="text"
                      value={formData.jobRef}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Terms</label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as 'Pay now' | '14 days' | '30 days' })}
                      style={inputStyle}
                    >
                      <option value="Pay now">Pay now</option>
                      <option value="14 days">14 days</option>
                      <option value="30 days">30 days</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Paid' | 'Pending' | 'Overdue' })}
                      style={inputStyle}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Client Details
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Client Name</label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      placeholder="Client Name"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Address</label>
                    <textarea
                      value={formData.clientAddress}
                      onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                      placeholder="Full address"
                      rows={3}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Email</label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      placeholder="client@example.com"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Pickup Details
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Pickup Location</label>
                    <input
                      type="text"
                      value={formData.pickupLocation}
                      onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                      placeholder="Pickup address"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Pickup Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.pickupDateTime}
                      onChange={(e) => setFormData({ ...formData, pickupDateTime: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Delivery Details
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Delivery Location</label>
                    <input
                      type="text"
                      value={formData.deliveryLocation}
                      onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                      placeholder="Delivery address"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Delivery Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.deliveryDateTime}
                      onChange={(e) => setFormData({ ...formData, deliveryDateTime: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Delivery Recipient</label>
                    <input
                      type="text"
                      value={formData.deliveryRecipient}
                      onChange={(e) => setFormData({ ...formData, deliveryRecipient: e.target.value })}
                      placeholder="Recipient name"
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937', marginTop: '1.5rem', marginBottom: '1rem' }}>
                  Service & Payment
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Service Description</label>
                    <textarea
                      value={formData.serviceDescription}
                      onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                      placeholder="Description of courier service provided"
                      rows={3}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>VAT Rate (%)</label>
                      <select
                        value={formData.vatRate}
                        onChange={(e) => setFormData({ ...formData, vatRate: parseInt(e.target.value) as 0 | 5 | 20 })}
                        style={inputStyle}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="20">20%</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Total Amount (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        style={inputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                      />
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', fontSize: '0.95rem' }}>
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Net Amount:</span>
                        <span style={{ fontWeight: '600', color: '#1f2937', marginLeft: '0.5rem' }}>
                          £{formData.netAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>VAT ({formData.vatRate}%):</span>
                        <span style={{ fontWeight: '600', color: '#1f2937', marginLeft: '0.5rem' }}>
                          £{formData.vatAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Total:</span>
                        <span style={{ fontWeight: '700', color: '#10b981', marginLeft: '0.5rem' }}>
                          £{formData.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            {showPreview && (
              <div>
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '1.5rem', borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                      Invoice Preview
                    </h2>
                  </div>
                  <div style={{ padding: '1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }} id="invoice-print-area">
                    <InvoiceTemplate invoice={formData} showPreview={true} companySettings={companySettings} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
