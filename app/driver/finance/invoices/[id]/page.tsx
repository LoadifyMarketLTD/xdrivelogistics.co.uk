'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { useAuth } from '../../../../components/AuthContext';
import DriverWorkspaceShell from '../../../_components/DriverWorkspaceShell';
import DriverInvoiceEmailPanel from './DriverInvoiceEmailPanel';
import { supabase, isSupabaseConfigured } from '../../../../../lib/supabaseClient';
import {
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
  type CanonicalInvoiceStatus,
  type CanonicalPaymentStatus,
} from '../../../../../lib/invoiceStatus';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../../../components/workspace/WorkspaceUI';

type InvoiceStatus = CanonicalInvoiceStatus;
type InvoiceDetail = {
  id: string;
  invoice_number: string;
  job_ref: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  payment_status: CanonicalPaymentStatus;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  pickup_location: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_datetime: string | null;
  service_description: string | null;
  amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: number;
  currency: string;
  payment_terms: string;
  submitted_at: string | null;
  approved_at: string | null;
  disputed_at: string | null;
  paid_at: string | null;
  created_at: string;
};
type StatusHistoryItem = { id: string; from_status: string | null; to_status: string; note: string | null; changed_at: string };
type PaymentRecord = { id: string; amount: number; currency: string; paid_at: string; settlement_method: string; external_reference: string | null; note: string | null };
type DisputeRecord = { id: string; reason: string; details: string | null; status: string; resolution_note: string | null; created_at: string; resolved_at: string | null };
type DocumentRecord = { id: string; doc_type: string; file_url: string; file_name: string | null; file_size_bytes: number | null; created_at: string };

const fmtCurrency = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount ?? 0));
const fmtDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function displayServiceDescription(value: string | null) {
  const raw = value?.trim() ?? '';
  if (!raw) return 'Transport service';
  if (!raw.startsWith('{') && !raw.startsWith('[')) return raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const vehicle = typeof parsed.vehicle === 'string' ? parsed.vehicle.trim() : '';
    const cargo = typeof parsed.cargo === 'string' ? parsed.cargo.trim() : '';
    return ['Transport service', vehicle, cargo].filter(Boolean).join(' · ');
  } catch {
    return 'Transport service';
  }
}

function invoiceTone(status: InvoiceStatus): 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' {
  if (status === 'Paid') return 'green';
  if (status === 'Sent') return 'blue';
  if (status === 'Overdue') return 'red';
  if (status === 'Disputed') return 'purple';
  if (status === 'Cancelled') return 'grey';
  return 'orange';
}

function paymentTone(status: CanonicalPaymentStatus): 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' {
  if (status === 'paid') return 'green';
  if (status === 'partially_paid') return 'blue';
  if (status === 'overdue') return 'red';
  if (status === 'disputed') return 'purple';
  if (status === 'refunded') return 'grey';
  return 'orange';
}

export default function DriverInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const financeOperator = ['owner', 'admin', 'dispatcher', 'finance'].includes(String(user?.membershipRole ?? ''));
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [openingDispute, setOpeningDispute] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  const [showDocForm, setShowDocForm] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'invoice_pdf' | 'pod_photo' | 'pod_signature' | 'other'>('invoice_pdf');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState('');

  useEffect(() => { void params.then((resolved) => setInvoiceId(resolved.id)); }, [params]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const loadDetail = useCallback(async () => {
    if (!isSupabaseConfigured || !invoiceId) return;
    setLoading(true);
    setLoadError('');
    const token = await getToken();
    if (!token) {
      setLoadError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/driver/finance/invoices/${invoiceId}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = (await response.json().catch(() => ({}))) as {
        invoice?: Omit<InvoiceDetail, 'status' | 'payment_status'> & { status: string; payment_status: string | null };
        statusHistory?: StatusHistoryItem[];
        payments?: PaymentRecord[];
        disputes?: DisputeRecord[];
        documents?: DocumentRecord[];
        error?: string;
      };
      if (!response.ok || !payload.invoice) throw new Error(payload.error ?? 'Failed to load invoice.');
      setInvoice({
        ...payload.invoice,
        status: toCanonicalInvoiceStatusWithDueDate(payload.invoice.status, payload.invoice.due_date),
        payment_status: toCanonicalPaymentStatus(payload.invoice.payment_status),
      });
      setStatusHistory(payload.statusHistory ?? []);
      setPayments(payload.payments ?? []);
      setDisputes(payload.disputes ?? []);
      setDocuments(payload.documents ?? []);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const handleRecordPayment = async () => {
    if (!financeOperator || !invoiceId || !payAmount || Number(payAmount) <= 0) return;
    setRecordingPayment(true);
    setPaymentError('');
    const token = await getToken();
    if (!token) { setRecordingPayment(false); return; }
    const response = await fetch(`/api/driver/finance/invoices/${invoiceId}/payment-history`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(payAmount), settlement_method: payMethod, external_reference: payRef || null, note: payNote || null, idempotency_key: crypto.randomUUID() }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setPaymentError(payload.error ?? 'Failed to record payment.');
    } else {
      setShowPaymentForm(false);
      setPayAmount(''); setPayMethod('bank_transfer'); setPayRef(''); setPayNote('');
      await loadDetail();
    }
    setRecordingPayment(false);
  };

  const handleOpenDispute = async () => {
    if (!invoiceId || !disputeReason.trim()) return;
    setOpeningDispute(true);
    setDisputeError('');
    const token = await getToken();
    if (!token) { setOpeningDispute(false); return; }
    const response = await fetch(`/api/driver/finance/invoices/${invoiceId}/disputes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: disputeReason.trim(), details: disputeDetails.trim() || null }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setDisputeError(payload.error ?? 'Failed to open dispute.');
    } else {
      setShowDisputeForm(false); setDisputeReason(''); setDisputeDetails('');
      await loadDetail();
    }
    setOpeningDispute(false);
  };

  const handleSaveDoc = async () => {
    if (!invoiceId || !docUrl.trim()) return;
    setSavingDoc(true);
    setDocError('');
    const token = await getToken();
    if (!token) { setSavingDoc(false); return; }
    const response = await fetch(`/api/driver/finance/invoices/${invoiceId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: docType, file_url: docUrl.trim(), file_name: docName.trim() || null }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setDocError(payload.error ?? 'Failed to save document.');
    } else {
      setShowDocForm(false); setDocUrl(''); setDocName(''); setDocType('invoice_pdf');
      await loadDetail();
    }
    setSavingDoc(false);
  };

  const totalPaid = useMemo(() => payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0), [payments]);
  const balance = invoice ? Math.max(0, Number(invoice.amount) - totalPaid) : 0;

  if (loading || !invoiceId) {
    return <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}><DriverWorkspaceShell><div className="driver-load-row"><EmptyState compact title="Loading invoice…" /></div></DriverWorkspaceShell></ProtectedRoute>;
  }

  if (loadError || !invoice) {
    return (
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
        <DriverWorkspaceShell headerActions={<ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>← Finance</ActionButton>}>
          <AlertBanner tone="danger">{loadError || 'Invoice not found.'}</AlertBanner>
        </DriverWorkspaceShell>
      </ProtectedRoute>
    );
  }

  const rail = (
    <aside className="driver-filter-rail" aria-label="Invoice summary">
      <div className="driver-filter-rail__header">Invoice Summary</div>
      <div className="driver-filter-rail__body">
        <div className="driver-detail-item"><span>Invoice</span><strong>{invoice.invoice_number}</strong></div>
        <div className="driver-detail-item"><span>Invoice state</span><strong><StatusBadge value={invoice.status} tone={invoiceTone(invoice.status)} /></strong></div>
        <div className="driver-detail-item"><span>Payment</span><strong><StatusBadge value={invoice.payment_status.replace(/_/g, ' ')} tone={paymentTone(invoice.payment_status)} /></strong></div>
        <div className="driver-detail-item"><span>Total</span><strong>{fmtCurrency(invoice.amount, invoice.currency)}</strong></div>
        <div className="driver-detail-item"><span>Received</span><strong>{fmtCurrency(totalPaid, invoice.currency)}</strong></div>
        <div className="driver-detail-item"><span>Outstanding</span><strong>{fmtCurrency(balance, invoice.currency)}</strong></div>
        <div className="driver-detail-item"><span>Due</span><strong>{fmtDate(invoice.due_date)}</strong></div>
        {financeOperator && invoice.status === 'Draft' && <ActionButton tone="secondary" onClick={() => router.push(`/driver/finance/invoices/${invoice.id}/edit`)}>Edit draft</ActionButton>}
        <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>← Finance</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell subtitle={`Invoice ${invoice.invoice_number}`} headerActions={<ActionButton tone="secondary" onClick={() => void loadDetail()}>Refresh</ActionButton>}>
        <div className="driver-board-layout driver-invoice-detail-board">
          {rail}
          <main className="driver-board-main">
            <section className="driver-row-details">
              <div className="driver-detail-tabs"><strong>Invoice & Booking</strong></div>
              <div className="driver-detail-grid">
                <div className="driver-detail-item"><span>Client</span><strong>{invoice.client_name}</strong></div>
                <div className="driver-detail-item"><span>Client email</span><strong>{invoice.client_email ?? '—'}</strong></div>
                <div className="driver-detail-item"><span>Job ref</span><strong>{invoice.job_ref}</strong></div>
                <div className="driver-detail-item"><span>Invoice date</span><strong>{fmtDate(invoice.invoice_date)}</strong></div>
                <div className="driver-detail-item"><span>Due date</span><strong>{fmtDate(invoice.due_date)}</strong></div>
                <div className="driver-detail-item"><span>Terms</span><strong>{invoice.payment_terms || '—'}</strong></div>
                <div className="driver-detail-item"><span>Net</span><strong>{fmtCurrency(invoice.net_amount, invoice.currency)}</strong></div>
                <div className="driver-detail-item"><span>VAT</span><strong>{fmtCurrency(invoice.vat_amount, invoice.currency)} ({invoice.vat_rate}%)</strong></div>
                <div className="driver-detail-item"><span>Route</span><strong>{invoice.pickup_location ?? 'Collection'} → {invoice.delivery_location ?? 'Delivery'}</strong></div>
                <div className="driver-detail-item"><span>Service</span><strong>{displayServiceDescription(invoice.service_description)}</strong></div>
              </div>
            </section>

            {financeOperator && (
              <DriverInvoiceEmailPanel
                invoiceId={invoiceId}
                invoice={{ invoiceNumber: invoice.invoice_number, jobReference: invoice.job_ref, clientName: invoice.client_name, clientEmail: invoice.client_email, invoiceDate: invoice.invoice_date, amount: Number(invoice.amount), currency: invoice.currency, status: invoice.status }}
                onSent={loadDetail}
              />
            )}

            <section className="driver-row-details">
              <div className="driver-detail-tabs"><strong>Payment</strong></div>
              <div className="driver-detail-grid">
                <div className="driver-detail-item"><span>Invoice total</span><strong>{fmtCurrency(invoice.amount, invoice.currency)}</strong></div>
                <div className="driver-detail-item"><span>Total received</span><strong>{fmtCurrency(totalPaid, invoice.currency)}</strong></div>
                <div className="driver-detail-item"><span>Outstanding</span><strong>{fmtCurrency(balance, invoice.currency)}</strong></div>
                <div className="driver-detail-item"><span>Payment status</span><strong><StatusBadge value={invoice.payment_status.replace(/_/g, ' ')} tone={paymentTone(invoice.payment_status)} /></strong></div>
              </div>
              {financeOperator && invoice.payment_status !== 'paid' && (
                <div className="driver-row-actions" style={{ marginTop: 5 }}><ActionButton tone="secondary" onClick={() => setShowPaymentForm((value) => !value)}>{showPaymentForm ? 'Cancel' : '+ Record Payment'}</ActionButton></div>
              )}
              {showPaymentForm && financeOperator && (
                <div className="driver-detail-grid" style={{ marginTop: 5 }}>
                  {paymentError && <div className="driver-diary-text-block"><strong>Error</strong><span>{paymentError}</span></div>}
                  <label className="driver-filter-field">Amount (GBP)<input type="number" min="0.01" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} /></label>
                  <label className="driver-filter-field">Method<select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}><option value="bank_transfer">Bank Transfer</option><option value="faster_payments">Faster Payments</option><option value="bacs">BACS</option><option value="chaps">CHAPS</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="card">Card</option><option value="paypal">PayPal</option><option value="other">Other</option></select></label>
                  <label className="driver-filter-field">Reference<input value={payRef} onChange={(event) => setPayRef(event.target.value)} /></label>
                  <label className="driver-filter-field">Note<input value={payNote} onChange={(event) => setPayNote(event.target.value)} /></label>
                  <div className="driver-row-actions"><ActionButton tone="primary" disabled={recordingPayment || !payAmount || Number(payAmount) <= 0} onClick={() => void handleRecordPayment()}>{recordingPayment ? 'Saving…' : 'Save Payment'}</ActionButton></div>
                </div>
              )}
              {payments.length > 0 && <div className="driver-load-list" style={{ marginTop: 5 }}>{payments.map((payment) => <div key={payment.id} className="driver-load-row"><div className="driver-load-row__meta"><strong>{fmtCurrency(payment.amount, payment.currency)}</strong><span>{payment.settlement_method}</span>{payment.external_reference && <span>Ref: {payment.external_reference}</span>}<span>{fmtDate(payment.paid_at)}</span></div></div>)}</div>}
            </section>

            <section className="driver-row-details">
              <div className="driver-detail-tabs"><strong>Status Timeline</strong></div>
              {statusHistory.length === 0 ? <EmptyState compact title="No status history yet" /> : <div className="driver-diary-history-list">{statusHistory.map((item) => <div key={item.id} className="driver-diary-history-row"><strong>{item.from_status ? `${item.from_status} → ${item.to_status}` : item.to_status}</strong><span>{fmtDateTime(item.changed_at)}</span><span>{item.note ?? 'Invoice status update'}</span></div>)}</div>}
            </section>

            <section className="driver-row-details">
              <div className="driver-detail-tabs"><strong>Documents</strong><ActionButton tone="secondary" onClick={() => setShowDocForm((value) => !value)}>{showDocForm ? 'Cancel' : '+ Add Document'}</ActionButton></div>
              {showDocForm && (
                <div className="driver-detail-grid" style={{ marginTop: 5 }}>
                  {docError && <div className="driver-diary-text-block"><strong>Error</strong><span>{docError}</span></div>}
                  <label className="driver-filter-field">Document URL<input value={docUrl} onChange={(event) => setDocUrl(event.target.value)} placeholder="https://…" /></label>
                  <label className="driver-filter-field">File name<input value={docName} onChange={(event) => setDocName(event.target.value)} /></label>
                  <label className="driver-filter-field">Type<select value={docType} onChange={(event) => setDocType(event.target.value as typeof docType)}><option value="invoice_pdf">Invoice PDF</option><option value="pod_photo">POD Photo</option><option value="pod_signature">POD Signature</option><option value="other">Other</option></select></label>
                  <div className="driver-row-actions"><ActionButton tone="primary" disabled={savingDoc || !docUrl.trim()} onClick={() => void handleSaveDoc()}>{savingDoc ? 'Saving…' : 'Save Document'}</ActionButton></div>
                </div>
              )}
              {documents.length === 0 ? <EmptyState compact title="No documents attached" /> : <div className="driver-load-list" style={{ marginTop: 5 }}>{documents.map((document) => <div key={document.id} className="driver-load-row"><div className="driver-load-row__meta"><a href={document.file_url} target="_blank" rel="noopener noreferrer">{document.file_name ?? 'Document'}</a><span>{document.doc_type}</span><span>{fmtDate(document.created_at)}</span></div></div>)}</div>}
            </section>

            <section className="driver-row-details">
              <div className="driver-detail-tabs"><strong>Disputes</strong>{invoice.payment_status !== 'paid' && <ActionButton tone="danger" onClick={() => setShowDisputeForm((value) => !value)}>{showDisputeForm ? 'Cancel' : 'Open Dispute'}</ActionButton>}</div>
              {showDisputeForm && (
                <div className="driver-detail-grid" style={{ marginTop: 5 }}>
                  {disputeError && <div className="driver-diary-text-block"><strong>Error</strong><span>{disputeError}</span></div>}
                  <label className="driver-filter-field">Reason<input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} /></label>
                  <label className="driver-filter-field">Details<textarea value={disputeDetails} onChange={(event) => setDisputeDetails(event.target.value)} /></label>
                  <div className="driver-row-actions"><ActionButton tone="danger" disabled={openingDispute || !disputeReason.trim()} onClick={() => void handleOpenDispute()}>{openingDispute ? 'Opening…' : 'Open Dispute'}</ActionButton></div>
                </div>
              )}
              {disputes.length === 0 ? <EmptyState compact title="No disputes raised" /> : <div className="driver-load-list" style={{ marginTop: 5 }}>{disputes.map((dispute) => <article key={dispute.id} className="driver-load-row" data-state={dispute.status}><div className="driver-load-row__top"><div className="driver-load-cell"><span className="driver-cell-label">Reason</span><strong className="driver-cell-primary">{dispute.reason}</strong><span className="driver-cell-secondary">{dispute.details ?? 'No additional detail'}</span></div><div className="driver-load-cell"><span className="driver-cell-label">Opened</span><strong className="driver-cell-primary">{fmtDateTime(dispute.created_at)}</strong><span className="driver-cell-secondary">{dispute.resolved_at ? `Resolved ${fmtDate(dispute.resolved_at)}` : 'Open'}</span></div><div className="driver-load-cell"><span className="driver-cell-label">Resolution</span><strong className="driver-cell-primary">{dispute.resolution_note ?? '—'}</strong></div><div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary"><StatusBadge value={dispute.status} tone={dispute.status === 'resolved' ? 'green' : 'red'} /></strong></div></div></article>)}</div>}
            </section>
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
