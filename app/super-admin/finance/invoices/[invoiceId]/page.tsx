'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const C = {
  navy: '#0B2F6B',
  blue: '#1D57D8',
  orange: '#F5A300',
  white: '#FFFFFF',
  charcoal: '#1A1F2B',
  light: '#F4F6F8',
  border: '#D9E1EA',
  muted: '#64748B',
  danger: '#DC2626',
  success: '#168553',
} as const;

type PaymentRow = {
  id: string;
  amount: number | string;
  currency: string;
  settlement_method: string | null;
  external_reference: string | null;
  paid_at: string;
};

type Payload = {
  previewReadOnly?: boolean;
  invoice?: {
    id: string;
    invoice_number: string;
    company_id: string;
    client_name: string | null;
    amount: number | string;
    currency: string;
    status: string | null;
    payment_status: string;
    paid_at: string | null;
    invoice_date: string | null;
    due_date: string | null;
  };
  ledger?: {
    payments: PaymentRow[];
    paymentRecordCount: number;
    ledgerPaidAmount: number;
    companyMismatchCount: number;
    currencyMismatchCount: number;
    integrityOk: boolean;
  };
  platformReconciliation?: {
    result: string;
    note: string;
    reconciledBy: string | null;
    reconciledAt: string;
    snapshot?: Record<string, unknown>;
    updatedAt?: string;
  } | null;
  error?: string;
};

function FinanceReconciliationPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = decodeURIComponent(params?.invoiceId ?? '').trim();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!invoiceId) {
      setError('Invalid invoice reconciliation route.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch(`/api/super-admin/finance/invoices/${encodeURIComponent(invoiceId)}/reconcile`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as Payload;
      if (!response.ok) {
        setPayload(null);
        setError(body.error ?? 'Finance reconciliation state is unavailable.');
        return;
      }
      setPayload(body);
    } catch {
      setPayload(null);
      setError('Finance reconciliation state is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load]);

  const expectedStatus = useMemo(() => {
    if (!payload?.invoice || !payload.ledger) return 'unknown';
    const invoiceAmount = Number(payload.invoice.amount) || 0;
    const paid = Number(payload.ledger.ledgerPaidAmount) || 0;
    if (invoiceAmount > 0 && paid >= invoiceAmount) return 'paid';
    if (paid > 0) return 'partially_paid';
    return 'unpaid';
  }, [payload]);

  const execute = async () => {
    if (reason.trim().length < 5 || !invoiceId) {
      setMessage('Enter a reconciliation reason of at least 5 characters.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/finance/invoices/${encodeURIComponent(invoiceId)}/reconcile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Finance reconciliation failed.');
      setReason('');
      setMessage('Finance reconciliation recorded.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Finance reconciliation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={stateStyle}>Loading finance reconciliation…</div>;
  if (error || !payload?.invoice || !payload.ledger) {
    return <div role="alert" style={{ ...stateStyle, color: C.danger }}>{error ?? 'Finance reconciliation unavailable.'}</div>;
  }

  const { invoice, ledger, platformReconciliation } = payload;
  const currency = String(invoice.currency ?? '').toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.charcoal, padding: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/super-admin/finance/invoices" style={{ color: C.blue, fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>← Back to invoices</Link>
      </div>

      <header style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: C.blue, fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>Platform Owner Finance Reconciliation</div>
            <h1 style={{ margin: '5px 0 0', color: C.navy, fontSize: 22, fontWeight: 900 }}>{invoice.invoice_number}</h1>
            <div style={{ marginTop: 5, color: C.muted, fontSize: 11 }}>{invoice.client_name ?? 'Unknown client'}</div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <span style={badgeStyle}>{invoice.payment_status}</span>
            <span style={{ ...badgeStyle, color: platformReconciliation ? C.blue : C.muted }}>
              {platformReconciliation?.result ?? 'not reconciled'}
            </span>
          </div>
        </div>
      </header>

      {payload.previewReadOnly ? (
        <div style={{ margin: '12px 0', border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.orange}`, borderRadius: 8, background: C.white, padding: 10, fontSize: 11 }}>
          Deploy Preview is read-only. Reconciliation controls are shown for inspection but mutations are blocked server-side.
        </div>
      ) : <div style={{ height: 12 }} />}

      <section style={{ marginBottom: 12 }}>
        <h2 style={sectionTitle}>Invoice and ledger state</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 }}>
          <Stat label="Invoice amount" value={`${currency} ${Number(invoice.amount).toFixed(2)}`} />
          <Stat label="Ledger paid" value={`${currency} ${Number(ledger.ledgerPaidAmount).toFixed(2)}`} />
          <Stat label="Payment records" value={String(ledger.paymentRecordCount)} />
          <Stat label="Current payment status" value={invoice.payment_status} />
          <Stat label="Expected from ledger" value={expectedStatus} />
          <Stat label="Ledger integrity" value={ledger.integrityOk ? 'Pass' : 'Blocked'} />
        </div>
      </section>

      {!ledger.integrityOk ? (
        <div style={{ marginBottom: 12, border: `1px solid ${C.danger}55`, borderRadius: 9, background: C.white, padding: 11, color: C.danger, fontSize: 11 }}>
          Reconciliation is blocked: company mismatches {ledger.companyMismatchCount}, currency mismatches {ledger.currencyMismatchCount}. No automatic financial correction should be attempted until ledger integrity is resolved.
        </div>
      ) : null}

      <section style={{ ...panelStyle, marginBottom: 12 }}>
        <h2 style={sectionTitle}>Payment ledger</h2>
        {ledger.payments.length === 0 ? (
          <p style={bodyStyle}>No payment records exist for this invoice.</p>
        ) : (
          <div style={{ display: 'grid', gap: 7 }}>
            {ledger.payments.map((payment) => (
              <div key={payment.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
                <div>
                  <div style={{ color: C.charcoal, fontSize: 10.5, fontWeight: 800 }}>{payment.settlement_method ?? 'Payment'}</div>
                  <div style={{ color: C.muted, fontSize: 9.5 }}>{payment.external_reference ?? 'No external reference'} · {payment.paid_at}</div>
                </div>
                <div style={{ color: C.navy, fontSize: 11, fontWeight: 900 }}>{String(payment.currency).toUpperCase()} {Number(payment.amount).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitle}>Platform Owner reconciliation</h2>
        <p style={{ ...bodyStyle, marginBottom: 10 }}>
          This verifies the canonical payment ledger. It does not create payments, alter invoice amounts, change VAT, or impersonate tenant finance users. Only derived payment status and paid-at state may be corrected when ledger integrity passes.
        </p>
        {platformReconciliation ? (
          <div style={{ marginBottom: 10, border: `1px solid ${C.border}`, borderRadius: 8, padding: 9, background: C.light }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.navy }}>{platformReconciliation.result}</div>
            <div style={{ marginTop: 3, fontSize: 9.5, color: C.muted }}>{platformReconciliation.note}</div>
            <div style={{ marginTop: 3, fontSize: 9, color: C.muted }}>{platformReconciliation.reconciledAt}</div>
          </div>
        ) : null}
        <label htmlFor="finance-reconciliation-reason" style={{ display: 'block', color: C.navy, fontSize: 10, fontWeight: 800, marginBottom: 5 }}>Reconciliation reason</label>
        <textarea
          id="finance-reconciliation-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={2000}
          disabled={Boolean(payload.previewReadOnly) || submitting || !ledger.integrityOk}
          placeholder="Record why the invoice ledger is being verified or reconciled…"
          style={{ width: '100%', resize: 'vertical', border: `1px solid ${C.border}`, borderRadius: 8, padding: 9, font: 'inherit', fontSize: 11, color: C.charcoal, background: payload.previewReadOnly || !ledger.integrityOk ? C.light : C.white }}
        />
        <button
          type="button"
          disabled={Boolean(payload.previewReadOnly) || submitting || !ledger.integrityOk}
          onClick={() => void execute()}
          style={{ marginTop: 10, minHeight: 36, border: 0, borderRadius: 7, background: C.blue, color: C.white, padding: '0 13px', fontSize: 11, fontWeight: 800, cursor: payload.previewReadOnly || submitting || !ledger.integrityOk ? 'not-allowed' : 'pointer', opacity: payload.previewReadOnly || submitting || !ledger.integrityOk ? 0.55 : 1 }}
        >
          {submitting ? 'Reconciling…' : 'Verify against payment ledger'}
        </button>
        {message ? <div role="status" style={{ marginTop: 9, color: message.includes('failed') || message.includes('blocked') ? C.danger : C.navy, fontSize: 10.5 }}>{message}</div> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.white, padding: 10 }}>
      <div style={{ color: C.muted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ marginTop: 4, color: C.charcoal, fontSize: 12, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const panelStyle = { border: `1px solid ${C.border}`, borderRadius: 10, background: C.white, padding: 12 } as const;
const sectionTitle = { margin: '0 0 8px', color: C.navy, fontSize: 13, fontWeight: 900 } as const;
const bodyStyle = { margin: 0, color: C.muted, fontSize: 10.5, lineHeight: 1.5 } as const;
const badgeStyle = { border: `1px solid ${C.border}`, borderRadius: 999, background: C.light, color: C.charcoal, padding: '3px 8px', fontSize: 9, fontWeight: 800 } as const;
const stateStyle = { margin: 14, border: `1px solid ${C.border}`, borderRadius: 10, background: C.white, padding: 16, color: C.muted, fontSize: 11 } as const;

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <FinanceReconciliationPage />
    </ProtectedRoute>
  );
}
