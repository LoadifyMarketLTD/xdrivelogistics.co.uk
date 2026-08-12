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
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  padding: '0.52rem 0.62rem',
  background: '#fff',
  color: '#1e293b',
  fontSize: '0.8rem',
  lineHeight: 1.45,
  outline: 'none',
};

const primaryButton: CSSProperties = {
  border: '1px solid #1d57d8',
  background: '#1d57d8',
  color: '#fff',
  borderRadius: '4px',
  minHeight: '30px',
  padding: '0 11px',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  borderColor: '#d8dee8',
  background: '#fff',
  color: '#1a1f2b',
};

const labelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '0.68rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.22rem',
};

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [draftSubject, setDraftSubject] = useState(DEFAULT_SUBJECT);
  const [draftMessage, setDraftMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canSend = invoice.status === 'Draft' && Boolean(invoice.clientEmail?.trim());
  const recipient = invoice.clientEmail?.trim() || 'No customer email recorded';
  const tokens = useMemo(
    () => ['[[My company]]', '[[Customer company]]', '[[Invoice number]]', '[[Invoice date]]', '[[Currency symbol]]', '[[Gross total]]', '[[Load ID]]'],
    [],
  );

  const openEditor = () => {
    setDraftSubject(subject);
    setDraftMessage(message);
    setError('');
    setEditorOpen(true);
  };

  const applyTemplate = () => {
    if (!draftSubject.trim() || !draftMessage.trim()) return;
    setSubject(draftSubject.trim());
    setMessage(draftMessage.trim());
    setEditorOpen(false);
  };

  const resetDraft = () => {
    setDraftSubject(DEFAULT_SUBJECT);
    setDraftMessage(DEFAULT_MESSAGE);
  };

  const previewInvoice = async () => {
    setPreviewing(true);
    setError('');
    setNotice('');
    const previewWindow = window.open('', '_blank');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      previewWindow?.close();
      setError('Your session has expired. Please sign in again.');
      setPreviewing(false);
      return;
    }

    try {
      const response = await fetch(`/api/driver/finance/invoices/${invoiceId}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        previewWindow?.close();
        setError(payload.error ?? 'Invoice preview could not be generated.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (previewWindow) previewWindow.location.href = url;
      else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      previewWindow?.close();
      setError('Network error while generating the invoice preview.');
    } finally {
      setPreviewing(false);
    }
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
        setNotice('Invoice sent with PDF attachment.');
        await onSent();
      }
    } catch {
      setError('Network error while sending the invoice.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section style={{
        background: '#fff',
        border: '1px solid #d7e0ea',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        marginBottom: '0.8rem',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.7rem',
          flexWrap: 'wrap',
          padding: '0.55rem 0.7rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>Invoice review & delivery</div>
            <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '0.08rem' }}>Edit the Draft, preview the final XDrive PDF, then send it with the email attachment.</div>
          </div>
          {invoice.status === 'Draft' && (
            <button type="button" style={secondaryButton} onClick={openEditor}>Edit email</button>
          )}
        </div>

        <div style={{ padding: '0.62rem 0.7rem' }}>
          {error && <div style={{ marginBottom: '0.55rem', padding: '0.42rem 0.55rem', border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: '4px', fontSize: '0.72rem' }}>{error}</div>}
          {notice && <div style={{ marginBottom: '0.55rem', padding: '0.42rem 0.55rem', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: '4px', fontSize: '0.72rem' }}>{notice}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 0.38fr) minmax(250px, 1fr) auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <div style={labelStyle}>To</div>
              <div style={{ fontSize: '0.76rem', color: canSend ? '#1e293b' : '#b91c1c', fontWeight: 600, overflowWrap: 'anywhere' }}>{recipient}</div>
            </div>
            <div>
              <div style={labelStyle}>Subject</div>
              <div style={{ fontSize: '0.76rem', color: '#1e293b', fontWeight: 600 }}>{subject}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {invoice.status === 'Draft' && (
                <a
                  href={`/driver/finance/invoices/${invoiceId}/edit`}
                  style={{ ...secondaryButton, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                >
                  Edit invoice
                </a>
              )}
              <button
                type="button"
                style={{ ...secondaryButton, opacity: previewing ? 0.55 : 1 }}
                disabled={previewing}
                onClick={() => void previewInvoice()}
              >
                {previewing ? 'Opening…' : 'Preview PDF'}
              </button>
              {invoice.status === 'Draft' ? (
                <button
                  type="button"
                  style={{ ...primaryButton, opacity: sending || !canSend ? 0.55 : 1 }}
                  disabled={sending || !canSend}
                  onClick={() => void sendInvoice()}
                >
                  {sending ? 'Sending…' : 'Send invoice & PDF'}
                </button>
              ) : (
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, padding: '0.45rem 0.2rem 0' }}>{invoice.status}</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '0.48rem', paddingTop: '0.45rem', borderTop: '1px solid #eef2f7', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#64748b', fontSize: '0.68rem' }}>
            <span>Invoice: <strong style={{ color: '#334155' }}>{invoice.invoiceNumber}</strong></span>
            <span>Load: <strong style={{ color: '#334155' }}>{invoice.jobReference}</strong></span>
            <span>Amount: <strong style={{ color: '#334155' }}>{money(invoice.amount, invoice.currency)}</strong></span>
            <span>Customer: <strong style={{ color: '#334155' }}>{invoice.clientName}</strong></span>
            <span style={{ marginLeft: 'auto', color: '#0b2f6b', fontWeight: 700 }}>Preview does not send or change invoice status.</span>
          </div>
        </div>
      </section>

      {editorOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setEditorOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.38)',
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="invoice-email-template-title" style={{ width: 'min(760px, 96vw)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 18px 50px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.65rem 0.75rem', background: '#f1f5f9', borderBottom: '1px solid #d8dee8' }}>
              <div>
                <div id="invoice-email-template-title" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Invoice email template</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>Edit the message for this invoice before sending.</div>
              </div>
              <button type="button" aria-label="Close invoice email template" onClick={() => setEditorOpen(false)} style={{ ...secondaryButton, width: '30px', padding: 0 }}>×</button>
            </div>

            <div style={{ padding: '0.8rem' }}>
              <div style={{ marginBottom: '0.7rem' }}>
                <div style={labelStyle}>Subject</div>
                <input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} style={fieldStyle} maxLength={500} />
              </div>

              <div style={{ marginBottom: '0.7rem' }}>
                <div style={labelStyle}>Message</div>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  style={{ ...fieldStyle, minHeight: '300px', resize: 'vertical', fontFamily: 'inherit' }}
                  maxLength={10000}
                />
              </div>

              <div style={{ marginBottom: '0.8rem', padding: '0.5rem 0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, marginBottom: '0.3rem' }}>Template variables</div>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {tokens.map((token) => <code key={token} style={{ fontSize: '0.66rem', background: '#fff', border: '1px solid #d8dee8', borderRadius: '3px', padding: '0.18rem 0.3rem', color: '#0b2f6b' }}>{token}</code>)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" style={secondaryButton} onClick={resetDraft}>Reset</button>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button type="button" style={secondaryButton} onClick={() => setEditorOpen(false)}>Cancel</button>
                  <button
                    type="button"
                    style={{ ...primaryButton, opacity: !draftSubject.trim() || !draftMessage.trim() ? 0.55 : 1 }}
                    disabled={!draftSubject.trim() || !draftMessage.trim()}
                    onClick={applyTemplate}
                  >
                    Apply to invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
