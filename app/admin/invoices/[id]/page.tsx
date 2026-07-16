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
import { saveInvoiceWithSchemaCompat } from '../../../../lib/supabaseSchemaCompat';
import {
  CANONICAL_INVOICE_STATUSES,
  toCanonicalInvoiceStatus,
  toCanonicalInvoiceStatusWithDueDate,
  toLegacyInvoiceStatusForDb,
  type CanonicalInvoiceStatus,
} from '../../../../lib/invoiceStatus';

type InvoiceStatusHistoryItem = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
};

type InvoicePaymentHistoryItem = {
  id: string;
  amount: number;
  currency: string;
  paid_at: string;
  settlement_method: string;
  external_reference: string | null;
  note: string | null;
};

/** Map InvoiceData (UI shape) → Supabase invoice row (DB shape) */
function invoiceDataToDb(inv: InvoiceData, companyId: string, jobId: string | null, userId?: string | null): Omit<Invoice, 'created_at' | 'updated_at'> {
  const canonicalStatus = toCanonicalInvoiceStatus(inv.status);
  return {
    id: inv.id,
    company_id: companyId,
    created_by: userId ?? null,
    invoice_number: inv.invoiceNumber,
    job_ref: inv.jobRef,
    job_id: jobId,
    invoice_date: inv.date,
    due_date: inv.dueDate,
    status: toLegacyInvoiceStatusForDb(canonicalStatus),
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
    invoice_origin: 'manual',
    late_fee: inv.lateFee || null,
    pod_photos: inv.podPhotos ?? null,
    signature: inv.signature ?? null,
    recipient_name: inv.recipientName ?? null,
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    disputed_at: null,
    paid_at: null,
  };
}

/** Map Supabase Invoice row → InvoiceData used by the UI */
function dbToInvoiceData(row: Invoice): InvoiceData {
  const status = toCanonicalInvoiceStatusWithDueDate(row.status, row.due_date);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    jobRef: row.job_ref,
    date: row.invoice_date,
    dueDate: row.due_date,
    status,
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
  const prefillJobId = searchParams?.get('jobId');

  const [formData, setFormData] = useState<InvoiceData>({
    id: '',
    invoiceNumber: '',
    jobRef: prefillJobRef,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'Draft',
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
  const [statusHistory, setStatusHistory] = useState<InvoiceStatusHistoryItem[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<InvoicePaymentHistoryItem[]>([]);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [linkedJobId, setLinkedJobId] = useState<string | null>(prefillJobId);
  const [paymentInput, setPaymentInput] = useState({
    amount: '',
    method: 'bank_transfer',
    paidAt: new Date().toISOString().slice(0, 16),
    reference: '',
    note: '',
  });

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

  const loadInvoiceLedger = async (targetInvoiceId: string, targetCompanyId: string) => {
    if (!isSupabaseConfigured || !hasSupabaseSession || !targetInvoiceId || !targetCompanyId) return;

    const [{ data: statusRows }, { data: paymentRows }] = await Promise.all([
      supabase
        .from('invoice_status_history')
        .select('id, from_status, to_status, note, changed_at')
        .eq('invoice_id', targetInvoiceId)
        .eq('company_id', targetCompanyId)
        .order('changed_at', { ascending: false }),
      supabase
        .from('invoice_payment_history')
        .select('id, amount, currency, paid_at, settlement_method, external_reference, note')
        .eq('invoice_id', targetInvoiceId)
        .eq('company_id', targetCompanyId)
        .order('paid_at', { ascending: false }),
    ]);

    setStatusHistory((statusRows ?? []) as InvoiceStatusHistoryItem[]);
    setPaymentHistory((paymentRows ?? []) as InvoicePaymentHistoryItem[]);
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
        .select('id, company_id, created_by, invoice_number, job_ref, job_id, invoice_date, due_date, status, payment_status, client_name, client_address, client_email, pickup_location, pickup_datetime, delivery_location, delivery_datetime, delivery_recipient, service_description, amount, net_amount, vat_amount, vat_rate, currency, payment_terms, late_fee, pod_photos, signature, recipient_name, created_at, updated_at')
        .eq('id', invoiceId)
        .eq('company_id', companyId)
        .single();
      if (!error && data) {
        setFormData(dbToInvoiceData(data as unknown as Invoice));
        setLinkedJobId(typeof data.job_id === 'string' ? data.job_id : null);
        await loadInvoiceLedger(invoiceId, companyId);
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
      const row = invoiceDataToDb(formData, companyId, linkedJobId, user?.id);
      const { id: _id, company_id: _companyId, created_by: _createdBy, ...updateFields } = row;
      const { error } = await saveInvoiceWithSchemaCompat(supabase, {
        isNew,
        invoiceId,
        companyId,
        insertRow: {
          ...row,
          invoice_origin: 'manual',
        } as Record<string, unknown>,
        updateFields: {
          ...updateFields,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>,
      });
      if (!error) {
        setSaveMessage('Invoice saved successfully!');
        if (!isNew) {
          await loadInvoiceLedger(invoiceId, companyId);
        }
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

  const handleRecordPayment = async () => {
    if (isNew || !companyId || !invoiceId) {
      setSaveMessage('Save the invoice first before recording payments.');
      return;
    }

    const amount = Number(paymentInput.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSaveMessage('Enter a valid payment amount.');
      return;
    }

    setRecordingPayment(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      setSaveMessage('A live Supabase session is required to record payments safely.');
      setRecordingPayment(false);
      return;
    }

    const response = await fetch(`/api/admin/invoices/${invoiceId}/payment-history`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'GBP',
        paid_at: new Date(paymentInput.paidAt).toISOString(),
        settlement_method: paymentInput.method,
        external_reference: paymentInput.reference.trim() || null,
        note: paymentInput.note.trim() || null,
        idempotency_key: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Failed to record payment.' })) as { error?: string };
      setSaveMessage(`Error recording payment: ${payload.error ?? 'Failed to record payment.'}`);
      setRecordingPayment(false);
      return;
    }

    await loadInvoice();
    setPaymentInput({
      amount: '',
      method: 'bank_transfer',
      paidAt: new Date().toISOString().slice(0, 16),
      reference: '',
      note: '',
    });
    setSaveMessage('Payment recorded successfully.');
    setRecordingPayment(false);
  };

  const handleMarkAsPaid = async () => {
    if (isNew || !companyId || !invoiceId || outstandingBalance <= 0 || markingPaid) return;
    setMarkingPaid(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      setSaveMessage('A live Supabase session is required to record payments safely.');
      setMarkingPaid(false);
      return;
    }

    const response = await fetch(`/api/admin/invoices/${invoiceId}/payment-history`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(outstandingBalance.toFixed(2)),
        currency: 'GBP',
        paid_at: new Date().toISOString(),
        settlement_method: paymentInput.method,
        external_reference: paymentInput.reference.trim() || null,
        note: paymentInput.note.trim() || 'Recorded as full settlement from admin invoice detail.',
        idempotency_key: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Failed to settle invoice.' })) as { error?: string };
      setSaveMessage(`Error settling invoice: ${payload.error ?? 'Failed to settle invoice.'}`);
      setMarkingPaid(false);
      return;
    }

    await loadInvoice();
    setSaveMessage('Invoice settled successfully.');
    setMarkingPaid(false);
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
    border: '2px solid rgba(11, 47, 107, 0.16)',
    borderRadius: '6px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#1A1F2B',
    marginBottom: '0.5rem',
  };
  const totalPaid = paymentHistory.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const outstandingBalance = Math.max(0, Number(formData.amount || 0) - totalPaid);

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#F4F6F8' }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: '#0B2F6B',
            color: 'white',
            padding: '1.5rem 2rem',
            boxShadow: '0 2px 8px rgba(26, 31, 43, 0.1)',
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
                  boxShadow: '0 2px 8px rgba(26, 31, 43, 0.1)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSave}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#1D57D8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D57D8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1D57D8')}
                  >
                    💾 Save Invoice
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#1D57D8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D57D8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1D57D8')}
                  >
                    👁️ {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                  <button
                    onClick={() => void handleDownloadPdf()}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#0B2F6B',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                      opacity: downloadingPdf ? 0.7 : 1,
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0B2F6B')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0B2F6B')}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? '⏳ Preparing PDF…' : '⬇️ Download PDF'}
                  </button>
                  {!isNew && outstandingBalance > 0 && (
                    <button
                      onClick={() => void handleMarkAsPaid()}
                      disabled={markingPaid}
                      style={{
                        padding: '0.75rem 1.25rem',
                        backgroundColor: '#1D57D8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: markingPaid ? 'not-allowed' : 'pointer',
                        opacity: markingPaid ? 0.7 : 1,
                        transition: 'background-color 0.2s',
                      }}
                    >
                      {markingPaid ? '⏳ Updating…' : '✅ Settle Outstanding Balance'}
                    </button>
                  )}
                  <button
                    onClick={handleWhatsAppShare}
                    style={{
                      padding: '0.75rem 1.25rem',
                      backgroundColor: '#1D57D8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D57D8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1D57D8')}
                  >
                    📱 WhatsApp
                  </button>
                </div>
                {saveMessage && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: saveMessage.includes('Error') ? '#F4F6F8' : '#F4F6F8',
                      color: saveMessage.includes('Error') ? '#F5A300' : '#0B2F6B',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textAlign: 'center',
                    }}
                  >
                    {saveMessage}
                  </div>
                )}

                {!isNew && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(11, 47, 107, 0.16)', paddingTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#0B2F6B' }}>Finance Tracking (recording only)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount (£)"
                        value={paymentInput.amount}
                        onChange={(e) => setPaymentInput((prev) => ({ ...prev, amount: e.target.value }))}
                        style={inputStyle}
                      />
                      <input
                        type="datetime-local"
                        value={paymentInput.paidAt}
                        onChange={(e) => setPaymentInput((prev) => ({ ...prev, paidAt: e.target.value }))}
                        style={inputStyle}
                      />
                      <select
                        value={paymentInput.method}
                        onChange={(e) => setPaymentInput((prev) => ({ ...prev, method: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="other">Other / external reference</option>
                        <option value="cash">Cash</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Reference"
                        value={paymentInput.reference}
                        onChange={(e) => setPaymentInput((prev) => ({ ...prev, reference: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <textarea
                      placeholder="Payment note (optional)"
                      value={paymentInput.note}
                      onChange={(e) => setPaymentInput((prev) => ({ ...prev, note: e.target.value }))}
                      rows={2}
                      style={inputStyle}
                    />
                    <button
                      onClick={() => void handleRecordPayment()}
                      disabled={recordingPayment}
                      style={{
                        padding: '0.625rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#1D57D8',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        cursor: recordingPayment ? 'not-allowed' : 'pointer',
                        opacity: recordingPayment ? 0.7 : 1,
                      }}
                    >
                      {recordingPayment ? '⏳ Recording…' : 'Record Payment'}
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ backgroundColor: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Status timeline</strong>
                        {statusHistory.length === 0 ? (
                          <div style={{ color: '#0B2F6B', fontSize: '0.875rem' }}>No status history yet.</div>
                        ) : (
                          statusHistory.map((item) => (
                            <div key={item.id} style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1D57D8' }}>
                              <div>
                                {item.from_status ?? '—'} → <strong>{item.to_status}</strong>
                              </div>
                              <div style={{ color: '#0B2F6B' }}>{new Date(item.changed_at).toLocaleString('en-GB')}</div>
                            </div>
                          ))
                        )}
                      </div>
                      <div style={{ backgroundColor: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Payment history</strong>
                        {paymentHistory.length === 0 ? (
                          <div style={{ color: '#0B2F6B', fontSize: '0.875rem' }}>No payments recorded yet.</div>
                        ) : (
                          paymentHistory.map((item) => (
                            <div key={item.id} style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1D57D8' }}>
                              <div>
                                <strong>£{Number(item.amount).toFixed(2)}</strong> — payment record method: {item.settlement_method}
                              </div>
                              <div style={{ color: '#0B2F6B' }}>{new Date(item.paid_at).toLocaleString('en-GB')}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Invoice Details Form */}
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(26, 31, 43, 0.1)',
                }}
              >
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0B2F6B', marginBottom: '1.5rem' }}>
                  Invoice Details
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Invoice Number</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#FFFFFF', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Job Reference</label>
                    <input
                      type="text"
                      value={formData.jobRef}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#FFFFFF', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
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
                      style={{ ...inputStyle, backgroundColor: '#FFFFFF', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as CanonicalInvoiceStatus })}
                      style={inputStyle}
                    >
                      {CANONICAL_INVOICE_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0B2F6B', marginTop: '1.5rem', marginBottom: '1rem' }}>
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0B2F6B', marginTop: '1.5rem', marginBottom: '1rem' }}>
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Pickup Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.pickupDateTime}
                      onChange={(e) => setFormData({ ...formData, pickupDateTime: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0B2F6B', marginTop: '1.5rem', marginBottom: '1rem' }}>
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Delivery Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.deliveryDateTime}
                      onChange={(e) => setFormData({ ...formData, deliveryDateTime: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0B2F6B', marginTop: '1.5rem', marginBottom: '1rem' }}>
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
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
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#1D57D8')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#F4F6F8')}
                      />
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(11, 47, 107, 0.16)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', fontSize: '0.95rem' }}>
                      <div>
                        <span style={{ color: '#0B2F6B', fontWeight: '500' }}>Net Amount:</span>
                        <span style={{ fontWeight: '600', color: '#0B2F6B', marginLeft: '0.5rem' }}>
                          £{formData.netAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#0B2F6B', fontWeight: '500' }}>VAT ({formData.vatRate}%):</span>
                        <span style={{ fontWeight: '600', color: '#0B2F6B', marginLeft: '0.5rem' }}>
                          £{formData.vatAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#0B2F6B', fontWeight: '500' }}>Total:</span>
                        <span style={{ fontWeight: '700', color: '#1D57D8', marginLeft: '0.5rem' }}>
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
                    boxShadow: '0 2px 8px rgba(26, 31, 43, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '1.5rem', borderBottom: '2px solid rgba(11, 47, 107, 0.16)', backgroundColor: '#FFFFFF' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0B2F6B', margin: 0 }}>
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
