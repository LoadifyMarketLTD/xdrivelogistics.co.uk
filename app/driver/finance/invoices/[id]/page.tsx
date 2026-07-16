'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../../../lib/supabaseClient';
import {
  toCanonicalInvoiceDisplayStatus,
  toCanonicalPaymentStatus,
  type CanonicalInvoiceStatus,
} from '../../../../../lib/invoiceStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = CanonicalInvoiceStatus;

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  job_ref: string;
  job_id: string | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  payment_status: string | null;
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

type StatusHistoryItem = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
};

type PaymentRecord = {
  id: string;
  amount: number;
  currency: string;
  paid_at: string;
  settlement_method: string;
  external_reference: string | null;
  note: string | null;
};

type DisputeRecord = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  commercial_agreement_id?: string | null;
  buyer_company_id?: string | null;
  supplier_company_id?: string | null;
  job_id?: string | null;
  created_at: string;
  resolved_at: string | null;
};

type DocumentRecord = {
  id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  Draft:     { bg: '#F4F6F8', text: '#F5A300' },
  Sent:      { bg: '#F4F6F8', text: '#1D57D8' },
  Cancelled: { bg: '#F4F6F8', text: '#0B2F6B' },
  Paid:      { bg: '#F4F6F8', text: '#0B2F6B' },
  Disputed:  { bg: '#F4F6F8', text: '#F5A300' },
  Overdue:   { bg: '#F4F6F8', text: '#F5A300' },
};

const fmtCurrency = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ── Component ─────────────────────────────────────────────────────────────────

export default function DriverInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setInvoiceId(p.id));
  }, [params]);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Record payment state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Open dispute state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [openingDispute, setOpeningDispute] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  // Record document state
  const [showDocForm, setShowDocForm] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'invoice_pdf' | 'pod_photo' | 'pod_signature' | 'other'>('invoice_pdf');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState('');

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  };

  const loadDetail = useCallback(async () => {
    if (!isSupabaseConfigured || !invoiceId) return;
    setLoading(true);
    setLoadError('');
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(`/api/driver/finance/invoices/${invoiceId}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        setLoadError(e.error ?? 'Failed to load invoice.');
        setLoading(false);
        return;
      }
      const json = await res.json() as {
        invoice: InvoiceDetail;
        statusHistory: StatusHistoryItem[];
        payments: PaymentRecord[];
        disputes: DisputeRecord[];
        documents: DocumentRecord[];
      };
      setInvoice({
        ...json.invoice,
        status: toCanonicalInvoiceDisplayStatus(
          json.invoice.status,
          json.invoice.due_date,
          json.invoice.payment_status
        ),
        payment_status: toCanonicalPaymentStatus(json.invoice.payment_status),
      });
      setStatusHistory(json.statusHistory ?? []);
      setPayments(json.payments ?? []);
      setDisputes(json.disputes ?? []);
      setDocuments(json.documents ?? []);
    } catch {
      setLoadError('Network error loading invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!invoiceId) return;
    setSubmitting(true);
    setSubmitError('');
    const token = await getToken();
    if (!token) { setSubmitting(false); return; }

    const res = await fetch(`/api/driver/finance/invoices/${invoiceId}/submit`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      setSubmitError(e.error ?? 'Failed to submit invoice.');
    } else {
      await loadDetail();
    }
    setSubmitting(false);
  };

  const handleRecordPayment = async () => {
    if (!invoiceId || !payAmount || Number(payAmount) <= 0) return;
    setRecordingPayment(true);
    setPaymentError('');
    const token = await getToken();
    if (!token) { setRecordingPayment(false); return; }

    const res = await fetch(`/api/driver/finance/invoices/${invoiceId}/payment-history`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(payAmount),
        settlement_method: payMethod,
        external_reference: payRef || null,
        note: payNote || null,
        idempotency_key: crypto.randomUUID(),
      }),
    });
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      setPaymentError(e.error ?? 'Failed to record payment.');
    } else {
      setShowPaymentForm(false);
      setPayAmount('');
      setPayMethod('bank_transfer');
      setPayRef('');
      setPayNote('');
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

    const res = await fetch(`/api/driver/finance/invoices/${invoiceId}/disputes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: disputeReason, details: disputeDetails || null }),
    });
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      setDisputeError(e.error ?? 'Failed to open dispute.');
    } else {
      setShowDisputeForm(false);
      setDisputeReason('');
      setDisputeDetails('');
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

    const res = await fetch(`/api/driver/finance/invoices/${invoiceId}/documents`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: docType, file_url: docUrl, file_name: docName || null }),
    });
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      setDocError(e.error ?? 'Failed to save document.');
    } else {
      setShowDocForm(false);
      setDocUrl('');
      setDocName('');
      setDocType('invoice_pdf');
      await loadDetail();
    }
    setSavingDoc(false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────────

  const cardStyle: CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid rgba(11, 47, 107, 0.16)',
    boxShadow: '0 2px 8px rgba(26, 31, 43, 0.06)',
    padding: '1.25rem',
    marginBottom: '1rem',
  };

  const sectionTitle: CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#0B2F6B',
    marginBottom: '0.75rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(11, 47, 107, 0.16)',
  };

  const labelStyle: CSSProperties = {
    fontSize: '0.72rem',
    color: '#0B2F6B',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.2rem',
  };

  const valueStyle: CSSProperties = {
    fontSize: '0.875rem',
    color: '#0B2F6B',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid rgba(11, 47, 107, 0.16)',
    borderRadius: '6px',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimary: CSSProperties = {
    padding: '0.5rem 1.1rem',
    background: '#1D57D8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '7px',
    fontSize: '0.83rem',
    fontWeight: 700,
    cursor: 'pointer',
  };

  const btnDanger: CSSProperties = {
    ...btnPrimary,
    background: '#F5A300',
    color: '#1A1F2B',
  };

  const btnSecondary: CSSProperties = {
    ...btnPrimary,
    background: '#F4F6F8',
    color: '#0B2F6B',
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading || !invoiceId) {
    return (
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
        <DriverWorkspaceShell>
          <div style={{ padding: '3rem', textAlign: 'center', color: '#0B2F6B' }}>Loading invoice…</div>
        </DriverWorkspaceShell>
      </ProtectedRoute>
    );
  }

  if (loadError || !invoice) {
    return (
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
        <DriverWorkspaceShell>
          <div style={{ padding: '2rem' }}>
            <div style={{ color: '#1A1F2B', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {loadError || 'Invoice not found.'}
            </div>
            <button onClick={() => router.push('/driver/finance')} style={btnSecondary}>
              ← Back to Finance
            </button>
          </div>
        </DriverWorkspaceShell>
      </ProtectedRoute>
    );
  }

  const sc = STATUS_COLORS[invoice.status as InvoiceStatus] ?? { bg: '#F4F6F8', text: '#0B2F6B' };
  const totalPaid = payments.reduce((s: number, p: PaymentRecord) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(invoice.amount) - totalPaid);

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell
        subtitle={`Invoice ${invoice.invoice_number}`}
        headerActions={
          <button onClick={() => router.push('/driver/finance')} style={btnSecondary}>
            ← Finance
          </button>
        }
      >
        {/* ── Header card ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1A1F2B' }}>
                {invoice.invoice_number}
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#0B2F6B', marginTop: '0.2rem' }}>
                Ref: {invoice.job_ref} · Created {fmtDate(invoice.created_at)}
              </div>
            </div>
            <span style={{ padding: '0.35rem 1rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, backgroundColor: sc.bg, color: sc.text }}>
              {invoice.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={labelStyle}>Client</div>
              <div style={valueStyle}>{invoice.client_name}</div>
              {invoice.client_email && <div style={{ fontSize: '0.75rem', color: '#0B2F6B' }}>{invoice.client_email}</div>}
            </div>
            <div>
              <div style={labelStyle}>Amount</div>
              <div style={{ ...valueStyle, fontWeight: 800, fontSize: '1.1rem' }}>
                {fmtCurrency(Number(invoice.amount), invoice.currency)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#0B2F6B' }}>
                Net {fmtCurrency(Number(invoice.net_amount), invoice.currency)} + VAT {invoice.vat_rate}%
              </div>
            </div>
            <div>
              <div style={labelStyle}>Invoice Date</div>
              <div style={valueStyle}>{fmtDate(invoice.invoice_date)}</div>
            </div>
            <div>
              <div style={labelStyle}>Due Date</div>
              <div style={{ ...valueStyle, color: new Date(invoice.due_date) < new Date() && invoice.payment_status !== 'paid' ? '#F5A300' : '#0B2F6B' }}>
                {fmtDate(invoice.due_date)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#0B2F6B' }}>{invoice.payment_terms}</div>
            </div>
            {invoice.pickup_location && (
              <div>
                <div style={labelStyle}>Route</div>
                <div style={{ fontSize: '0.78rem', color: '#0B2F6B' }}>
                  {invoice.pickup_location} → {invoice.delivery_location ?? '—'}
                </div>
              </div>
            )}
            {invoice.service_description && (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={labelStyle}>Service</div>
                <div style={{ fontSize: '0.78rem', color: '#0B2F6B' }}>{invoice.service_description}</div>
              </div>
            )}
          </div>

          {/* Submit action */}
          {invoice.status === 'Draft' && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(11, 47, 107, 0.16)' }}>
              {submitError && (
                <div style={{ marginBottom: '0.5rem', color: '#1A1F2B', fontSize: '0.83rem' }}>{submitError}</div>
              )}
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Sending…' : '📤 Mark as Sent'}
              </button>
            </div>
          )}
        </div>

        {/* ── Payment summary ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>💰 Payment Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={labelStyle}>Invoice Total</div>
              <div style={{ ...valueStyle, fontWeight: 700 }}>{fmtCurrency(Number(invoice.amount), invoice.currency)}</div>
            </div>
            <div>
              <div style={labelStyle}>Total Received</div>
              <div style={{ ...valueStyle, fontWeight: 700, color: totalPaid > 0 ? '#0B2F6B' : '#F4F6F8' }}>
                {fmtCurrency(totalPaid, invoice.currency)}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Outstanding Balance</div>
              <div style={{ ...valueStyle, fontWeight: 700, color: balance > 0 ? '#F5A300' : '#0B2F6B' }}>
                {fmtCurrency(balance, invoice.currency)}
              </div>
            </div>
          </div>
          {invoice.payment_status !== 'paid' && (
            <button
              onClick={() => setShowPaymentForm(!showPaymentForm)}
              style={btnSecondary}
            >
              {showPaymentForm ? 'Cancel' : '+ Record Payment'}
            </button>
          )}

          {showPaymentForm && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#F4F6F8', borderRadius: '8px' }}>
              {paymentError && (
                <div style={{ marginBottom: '0.5rem', color: '#1A1F2B', fontSize: '0.83rem' }}>{paymentError}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={labelStyle}>Amount (GBP)</div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Method</div>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={inputStyle}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="bacs">BACS</option>
                    <option value="chaps">CHAPS</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Reference</div>
                  <input
                    type="text"
                    placeholder="External reference"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Note</div>
                  <input
                    type="text"
                    placeholder="Optional note"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                onClick={() => void handleRecordPayment()}
                disabled={recordingPayment || !payAmount || Number(payAmount) <= 0}
                style={{ ...btnPrimary, opacity: recordingPayment || !payAmount ? 0.6 : 1 }}
              >
                {recordingPayment ? 'Saving…' : 'Save Payment'}
              </button>
            </div>
          )}

          {payments.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0B2F6B', marginBottom: '0.5rem' }}>Payment Records</div>
              {payments.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(11, 47, 107, 0.16)', fontSize: '0.83rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#0B2F6B' }}>{fmtCurrency(Number(p.amount), p.currency)}</span>
                  <span style={{ color: '#0B2F6B' }}>Method: {p.settlement_method}</span>
                  {p.external_reference && <span style={{ color: '#0B2F6B' }}>Ref: {p.external_reference}</span>}
                  <span style={{ color: '#0B2F6B' }}>{fmtDate(p.paid_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Status timeline ── */}
        <div style={cardStyle}>
          <div style={sectionTitle}>📋 Status Timeline</div>
          {statusHistory.length === 0 ? (
            <div style={{ fontSize: '0.83rem', color: '#0B2F6B' }}>No status history yet.</div>
          ) : (
            <div style={{ position: 'relative' }}>
              {statusHistory.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: i < statusHistory.length - 1 ? '0.75rem' : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D57D8', flexShrink: 0, marginTop: '0.2rem' }} />
                    {i < statusHistory.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: '#F4F6F8', marginTop: '0.3rem' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0B2F6B' }}>
                      {h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}
                    </div>
                    {h.note && <div style={{ fontSize: '0.75rem', color: '#0B2F6B', marginTop: '0.15rem' }}>{h.note}</div>}
                    <div style={{ fontSize: '0.72rem', color: '#0B2F6B', marginTop: '0.15rem' }}>{fmtDateTime(h.changed_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Documents ── */}
        <div style={cardStyle}>
          <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📎 Documents</span>
            <button onClick={() => setShowDocForm(!showDocForm)} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}>
              {showDocForm ? 'Cancel' : '+ Add Document'}
            </button>
          </div>

          {showDocForm && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#F4F6F8', borderRadius: '8px' }}>
              {docError && (
                <div style={{ marginBottom: '0.5rem', color: '#1A1F2B', fontSize: '0.83rem' }}>{docError}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={labelStyle}>Document URL</div>
                  <input
                    type="text"
                    placeholder="https://…"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={labelStyle}>File Name</div>
                  <input
                    type="text"
                    placeholder="invoice.pdf"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Document Type</div>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as typeof docType)}
                    style={inputStyle}
                  >
                    <option value="invoice_pdf">Invoice PDF</option>
                    <option value="pod_photo">POD Photo</option>
                    <option value="pod_signature">POD Signature</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => void handleSaveDoc()}
                disabled={savingDoc || !docUrl.trim()}
                style={{ ...btnPrimary, opacity: savingDoc || !docUrl.trim() ? 0.6 : 1 }}
              >
                {savingDoc ? 'Saving…' : 'Save Document'}
              </button>
            </div>
          )}

          {documents.length === 0 ? (
            <div style={{ fontSize: '0.83rem', color: '#0B2F6B' }}>No documents attached.</div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(11, 47, 107, 0.16)', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.83rem', color: '#1D57D8', fontWeight: 600, textDecoration: 'none' }}
                  >
                    📄 {doc.file_name ?? 'Document'}
                  </a>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#0B2F6B' }}>{doc.doc_type}</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#0B2F6B' }}>{fmtDate(doc.created_at)}</span>
              </div>
            ))
          )}
        </div>

        {/* ── Disputes ── */}
        <div style={cardStyle}>
          <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ Disputes</span>
            {invoice.payment_status !== 'paid' && (
              <button onClick={() => setShowDisputeForm(!showDisputeForm)} style={{ ...btnDanger, fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}>
                {showDisputeForm ? 'Cancel' : 'Open Dispute'}
              </button>
            )}
          </div>

          {showDisputeForm && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#F4F6F8', borderRadius: '8px', border: '1px solid rgba(11, 47, 107, 0.16)' }}>
              {disputeError && (
                <div style={{ marginBottom: '0.5rem', color: '#1A1F2B', fontSize: '0.83rem' }}>{disputeError}</div>
              )}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Reason *</div>
                <input
                  type="text"
                  placeholder="Brief reason for the dispute"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Details</div>
                <textarea
                  placeholder="Provide additional context…"
                  value={disputeDetails}
                  onChange={(e) => setDisputeDetails(e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <button
                onClick={() => void handleOpenDispute()}
                disabled={openingDispute || !disputeReason.trim()}
                style={{ ...btnDanger, opacity: openingDispute || !disputeReason.trim() ? 0.6 : 1 }}
              >
                {openingDispute ? 'Opening…' : 'Open Dispute'}
              </button>
            </div>
          )}

          {disputes.length === 0 ? (
            <div style={{ fontSize: '0.83rem', color: '#0B2F6B' }}>No disputes raised.</div>
          ) : (
            disputes.map((d) => (
              <div key={d.id} style={{ padding: '0.75rem', background: '#F4F6F8', borderRadius: '8px', border: '1px solid rgba(11, 47, 107, 0.16)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1A1F2B' }}>{d.reason}</span>
                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: d.status === 'resolved' ? '#F4F6F8' : '#F4F6F8', color: d.status === 'resolved' ? '#0B2F6B' : '#F5A300', fontWeight: 700 }}>
                    {d.status}
                  </span>
                </div>
                {d.details && <div style={{ fontSize: '0.78rem', color: '#0B2F6B', marginBottom: '0.3rem' }}>{d.details}</div>}
                {d.resolution_note && (
                  <div style={{ fontSize: '0.78rem', color: '#0B2F6B', background: '#F4F6F8', padding: '0.4rem', borderRadius: '6px' }}>
                    Resolution: {d.resolution_note}
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: '#0B2F6B', marginTop: '0.3rem' }}>
                  Opened {fmtDateTime(d.created_at)}
                  {d.resolved_at ? ` · Resolved ${fmtDate(d.resolved_at)}` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
