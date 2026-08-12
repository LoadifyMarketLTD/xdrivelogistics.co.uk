'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../../../../../lib/supabaseClient';

type InvoiceEmailContext = {
  invoiceNumber: string;
  jobReference: string;
  clientName: string;
  clientEmail: string | null;
  invoiceDate: string;
  amount: number;
  currency: string;
  status: string;
};

const DEFAULT_SUBJECT = 'Invoice from [[My company]] - Load: [[Load ID]]';
const DEFAULT_MESSAGE = `Dear [[Customer company]],

I am attaching Invoice [[Invoice number]] for Load [[Load ID]].

Details:
Kindly note that a charge of £25.00 per week will apply to invoices that are more than 7 days overdue.

Invoice: [[Invoice number]]
Date: [[Invoice date]]
Amount Due: [[Currency symbol]][[Gross total]]
Load: [[Load ID]]
Supplier: [[My company]]

Please let us know if you have any questions.

All the best,
[[My company]]`;

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '0.55rem 0.7rem',
  background: '#fff',
  color: '#1e293b',
  fontSize: '0.82rem',
  lineHeight: 1.45,
  outline: 'none',
};

const primaryButton: CSSProperties = {
  border: '1px solid #1d57d8',
  background: '#1d57d8',
  color: '#fff',
  borderRadius: '6px',
  minHeight: '32px',
  padding: '0 12px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  borderColor: '#d8dee8',
  background: '#fff',
  color: '#1a1f2b',
};

export default function DriverInvoiceEmailPanel({
  invoiceId,
  invoice,
  onSent,
}: {
  invoiceId: string;
  invoice: InvoiceEmailContext;
  onSent: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canSend = invoice.status === 'Draft' && Boolean(invoice.clientEmail?.trim());
  const recipient = invoice.clientEmail?.trim() || 'No customer email recorded';
  const tokens = useMemo(
    () => ['[[My company]]', '[[Customer company]]', '[[Invoice number]]', '[[Invoice date]]', '[[Currency symbol]]', '[[Gross total]]', '[[Load ID]]'],
    [],
  );

  const resetTemplate = () => {
    setSubject(DEFAULT_SUBJECT);
    setMessage(DEFAULT_MESSAGE);
    setError('');
  };

  const sendInvoice = async () => {
    if (!canSend || !subject.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    setNotice('');

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setSending(false);
      return;
    }

    try {
      const response = await fetch(`/api/driver/finance/invoices/${invoiceId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Invoice could not be sent.');
      } else {
        setNotice('Invoice email accepted for delivery and the PDF was attached.');
        setEditing(false);
        await onSent();
      }
    } catch {
      setError('Network error while sending the invoice.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section style={{
      background: '#fff',
      border: '1px solid #d7e0ea',
      borderRadius: '10px',
      boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      padding: '1.25rem',
      marginBottom: '1rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '0.85rem',
        paddingBottom: '0.55rem',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>✉ Invoice email template</div>
          <div style={{ color: '#64748b', fontSize: '0.74rem', marginTop: '0.15rem' }}>PDF invoice is generated and attached automatically when sent.</div>
        </div>
        {invoice.status === 'Draft' && (
          <button type="button" style={secondaryButton} onClick={() => setEditing((value) => !value)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {error && <div style={{ marginBottom: '0.7rem', padding: '0.55rem 0.7rem', border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.78rem' }}>{error}</div>}
      {notice && <div style={{ marginBottom: '0.7rem', padding: '0.55rem 0.7rem', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: '6px', fontSize: '0.78rem' }}>{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 0.32fr) minmax(0, 1fr)', gap: '0.8rem', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.69rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>To</div>
          <div style={{ fontSize: '0.8rem', color: canSend ? '#1e293b' : '#b91c1c', fontWeight: 600 }}>{recipient}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.69rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>Subject</div>
          {editing ? (
            <input value={subject} onChange={(event) => setSubject(event.target.value)} style={fieldStyle} maxLength={500} />
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>{subject}</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ color: '#64748b', fontSize: '0.69rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Message</div>
        {editing ? (
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            style={{ ...fieldStyle, minHeight: '230px', resize: 'vertical', fontFamily: 'inherit' }}
            maxLength={10000}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', color: '#334155', fontSize: '0.78rem', lineHeight: 1.55 }}>{message}</div>
        )}
      </div>

      {editing && (
        <div style={{ marginBottom: '0.8rem', padding: '0.55rem 0.7rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, marginBottom: '0.35rem' }}>Available variables</div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {tokens.map((token) => <code key={token} style={{ fontSize: '0.68rem', background: '#fff', border: '1px solid #d8dee8', borderRadius: '4px', padding: '0.2rem 0.35rem', color: '#0b2f6b' }}>{token}</code>)}
          </div>
        </div>
      )}

      {invoice.status === 'Draft' ? (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Invoice {invoice.invoiceNumber} · Load {invoice.jobReference} · {invoice.clientName}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {editing && <button type="button" style={secondaryButton} onClick={resetTemplate}>Reset template</button>}
            <button
              type="button"
              style={{ ...primaryButton, opacity: sending || !canSend || !subject.trim() || !message.trim() ? 0.55 : 1 }}
              disabled={sending || !canSend || !subject.trim() || !message.trim()}
              onClick={() => void sendInvoice()}
            >
              {sending ? 'Sending invoice…' : 'Send invoice & PDF'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem', fontSize: '0.75rem', color: '#64748b' }}>Invoice status: <strong style={{ color: '#1e293b' }}>{invoice.status}</strong>. Email editing is available while the invoice is Draft.</div>
      )}
    </section>
  );
}
