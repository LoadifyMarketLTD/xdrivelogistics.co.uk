'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../../../_components/DriverWorkspaceShell';
import { supabase } from '../../../../../../lib/supabaseClient';
import { toCanonicalInvoiceStatus } from '../../../../../../lib/invoiceStatus';

type InvoiceDraft = {
  id: string;
  invoice_number: string;
  job_ref: string;
  invoice_date: string;
  due_date: string;
  status: string;
  invoice_origin: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  service_description: string | null;
  net_amount: number;
  vat_amount: number;
  vat_rate: number;
  amount: number;
  currency: string;
  payment_terms: string;
};

const field: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 34,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  padding: '0.45rem 0.55rem',
  fontSize: '0.78rem',
  color: '#1e293b',
  background: '#fff',
};

const label: CSSProperties = {
  display: 'block',
  marginBottom: '0.22rem',
  color: '#475569',
  fontSize: '0.68rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const buttonBase: CSSProperties = {
  minHeight: 32,
  borderRadius: 4,
  padding: '0 12px',
  fontSize: '0.74rem',
  fontWeight: 800,
  cursor: 'pointer',
};

const primary: CSSProperties = { ...buttonBase, border: '1px solid #1d57d8', background: '#1d57d8', color: '#fff' };
const secondary: CSSProperties = { ...buttonBase, border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b' };

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

export default function DriverInvoiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState('');
  const [invoice, setInvoice] = useState<InvoiceDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [vatRate, setVatRate] = useState('20');

  useEffect(() => { void params.then(({ id }) => setInvoiceId(id)); }, [params]);

  const marketplace = useMemo(
    () => String(invoice?.invoice_origin ?? '').toLowerCase() === 'marketplace',
    [invoice?.invoice_origin],
  );
  const canonicalStatus = invoice ? toCanonicalInvoiceStatus(invoice.status) : 'Draft';
  const editable = canonicalStatus === 'Draft';

  const authToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  useEffect(() => {
    if (!invoiceId) return;
    const load = async () => {
      setLoading(true);
      setError('');
      const token = await authToken();
      if (!token) { setError('Your session has expired.'); setLoading(false); return; }
      try {
        const response = await fetch(`/api/driver/finance/invoices/${invoiceId}`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({})) as { invoice?: InvoiceDraft; error?: string };
        if (!response.ok || !payload.invoice) {
          setError(payload.error ?? 'Invoice could not be loaded.');
          setLoading(false);
          return;
        }
        const row = payload.invoice;
        setInvoice(row);
        setClientName(row.client_name ?? '');
        setClientEmail(row.client_email ?? '');
        setClientAddress(row.client_address ?? '');
        setInvoiceDate(String(row.invoice_date ?? '').slice(0, 10));
        setDueDate(String(row.due_date ?? '').slice(0, 10));
        setPaymentTerms(row.payment_terms ?? '');
        setServiceDescription(row.service_description ?? 'Transport service');
        setNetAmount(String(Number(row.net_amount ?? 0).toFixed(2)));
        setVatRate(String(Number(row.vat_rate ?? 0)));
      } catch {
        setError('Network error loading invoice.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [invoiceId]);

  const saveDraft = async () => {
    if (!invoiceId || !editable) return false;
    setSaving(true);
    setError('');
    setNotice('');
    const token = await authToken();
    if (!token) { setError('Your session has expired.'); setSaving(false); return false; }
    try {
      const response = await fetch(`/api/driver/finance/invoices/${invoiceId}/draft`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          client_email: clientEmail,
          client_address: clientAddress,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: paymentTerms,
          service_description: serviceDescription,
          net_amount: Number(netAmount),
          vat_rate: Number(vatRate),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { invoice?: InvoiceDraft; error?: string };
      if (!response.ok || !payload.invoice) {
        setError(payload.error ?? 'Invoice draft could not be saved.');
        return false;
      }
      setInvoice(payload.invoice);
      setDueDate(String(payload.invoice.due_date ?? dueDate).slice(0, 10));
      setNotice('Draft saved. Nothing has been sent to the customer.');
      return true;
    } catch {
      setError('Network error saving invoice draft.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async (saveFirst: boolean) => {
    if (saveFirst) {
      const saved = await saveDraft();
      if (!saved) return;
    }
    setPreviewing(true);
    setError('');
    const previewWindow = window.open('', '_blank');
    const token = await authToken();
    if (!token) {
      previewWindow?.close();
      setError('Your session has expired.');
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
      setError('Network error generating invoice preview.');
    } finally {
      setPreviewing(false);
    }
  };

  if (loading || !invoiceId) {
    return <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}><DriverWorkspaceShell><div style={{ padding: '2rem', color: '#64748b' }}>Loading invoice editor…</div></DriverWorkspaceShell></ProtectedRoute>;
  }

  if (!invoice) {
    return <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}><DriverWorkspaceShell><div style={{ padding: '2rem' }}><div style={{ color: '#b91c1c', marginBottom: '0.8rem' }}>{error || 'Invoice not found.'}</div><button style={secondary} onClick={() => router.back()}>← Back</button></div></DriverWorkspaceShell></ProtectedRoute>;
  }

  const previewVat = marketplace ? Number(invoice.vat_amount) : Math.round(Number(netAmount || 0) * (Number(vatRate || 0) / 100) * 100) / 100;
  const previewTotal = marketplace ? Number(invoice.amount) : Math.round((Number(netAmount || 0) + previewVat) * 100) / 100;

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'owner']}>
      <DriverWorkspaceShell subtitle={`Edit invoice ${invoice.invoice_number}`}>
        <div style={{ padding: '0.65rem 0.75rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            <div>
              <div style={{ color: '#1d57d8', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase' }}>Invoice draft</div>
              <h1 style={{ margin: '0.12rem 0 0', fontSize: '1.05rem', color: '#0f172a' }}>{invoice.invoice_number}</h1>
              <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.15rem' }}>Load {invoice.job_ref} · {canonicalStatus}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button style={secondary} onClick={() => router.push(`/driver/finance/invoices/${invoiceId}`)}>Cancel</button>
              <button style={secondary} disabled={previewing} onClick={() => void openPreview(false)}>{previewing ? 'Opening…' : 'Preview current PDF'}</button>
              {editable && <button style={{ ...primary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => void saveDraft()}>{saving ? 'Saving…' : 'Save Draft'}</button>}
              {editable && <button style={{ ...primary, background: '#f5a300', borderColor: '#f5a300', color: '#111827', opacity: saving || previewing ? 0.6 : 1 }} disabled={saving || previewing} onClick={() => void openPreview(true)}>Save & Preview</button>}
            </div>
          </div>

          {error && <div style={{ marginBottom: '0.65rem', border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', padding: '0.5rem 0.6rem', borderRadius: 4, fontSize: '0.74rem' }}>{error}</div>}
          {notice && <div style={{ marginBottom: '0.65rem', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', padding: '0.5rem 0.6rem', borderRadius: 4, fontSize: '0.74rem' }}>{notice}</div>}
          {!editable && <div style={{ marginBottom: '0.65rem', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', padding: '0.5rem 0.6rem', borderRadius: 4, fontSize: '0.74rem' }}>This invoice is no longer Draft. It can be previewed, but sent invoices are locked against editing.</div>}
          {marketplace && <div style={{ marginBottom: '0.65rem', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', padding: '0.5rem 0.6rem', borderRadius: 4, fontSize: '0.72rem' }}>Marketplace invoice: accepted price, VAT, currency and payment terms are locked to the commercial agreement. Editing cannot change the awarded quote.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, .72fr)', gap: '0.65rem' }}>
            <section style={{ border: '1px solid #d7e0ea', background: '#fff', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ padding: '0.48rem 0.62rem', background: '#f1f5f9', borderBottom: '1px solid #d7e0ea', fontWeight: 800, fontSize: '0.78rem', color: '#0f172a' }}>Invoice details</div>
              <div style={{ padding: '0.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div><label style={label}>Customer company</label><input style={field} disabled={!editable} value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div><label style={label}>Customer email</label><input style={field} disabled={!editable} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Billing address</label><textarea style={{ ...field, minHeight: 70, resize: 'vertical' }} disabled={!editable} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></div>
                <div><label style={label}>Invoice date</label><input style={field} disabled={!editable} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
                <div><label style={label}>Due date</label><input style={{ ...field, background: marketplace ? '#f8fafc' : '#fff' }} disabled={!editable || marketplace} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Payment terms</label><input style={{ ...field, background: marketplace ? '#f8fafc' : '#fff' }} disabled={!editable || marketplace} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Service description</label><textarea style={{ ...field, minHeight: 105, resize: 'vertical' }} disabled={!editable} value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} /></div>
              </div>
            </section>

            <section style={{ border: '1px solid #d7e0ea', background: '#fff', borderRadius: 5, overflow: 'hidden', alignSelf: 'start' }}>
              <div style={{ padding: '0.48rem 0.62rem', background: '#f1f5f9', borderBottom: '1px solid #d7e0ea', fontWeight: 800, fontSize: '0.78rem', color: '#0f172a' }}>Commercial summary</div>
              <div style={{ padding: '0.7rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.55rem', marginBottom: '0.65rem' }}>
                  <div><label style={label}>Net amount</label><input style={{ ...field, background: marketplace ? '#f8fafc' : '#fff' }} disabled={!editable || marketplace} type="number" min="0.01" step="0.01" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} /></div>
                  <div><label style={label}>VAT</label><select style={{ ...field, background: marketplace ? '#f8fafc' : '#fff' }} disabled={!editable || marketplace} value={vatRate} onChange={(e) => setVatRate(e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="20">20%</option></select></div>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem', display: 'grid', gap: '0.45rem', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Net</span><strong>{money(marketplace ? Number(invoice.net_amount) : Number(netAmount || 0), invoice.currency)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>VAT</span><strong>{money(previewVat, invoice.currency)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.45rem', borderTop: '1px solid #e2e8f0', fontSize: '0.9rem' }}><span style={{ fontWeight: 800 }}>PAYABLE</span><strong style={{ color: '#0b2f6b' }}>{money(previewTotal, invoice.currency)}</strong></div>
                </div>
                <div style={{ marginTop: '0.7rem', padding: '0.55rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, color: '#64748b', fontSize: '0.68rem', lineHeight: 1.45 }}>Preview generates the real XDrive PDF in a new tab. It does not send email, store a sent document or change invoice status.</div>
              </div>
            </section>
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
