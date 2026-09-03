'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  created_at: string;
};

type Enquiry = Row & {
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  updated_at: string | null;
  quote_sent_at: string | null;
  accepted_at: string | null;
  converted_at: string | null;
  converted_job_id: string | null;
  execution_mode: 'own_fleet' | 'direct_carrier' | 'marketplace' | null;
};

type Summary = {
  total_enquiries?: number;
  new_or_draft_on_page?: number;
  priced_on_page?: number;
};

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B',
  light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626', success: '#15803D',
} as const;

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const res = await fetch('/api/super-admin/xdrive-logistics/enquiries?page=1&limit=100', { headers: { Authorization: auth } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError((body as { error?: string }).error ?? 'Unable to load XDrive enquiries.'); return; }
      setRows(((body as { rows?: Row[] }).rows ?? []) as Row[]);
      setSummary(((body as { summary?: Summary }).summary ?? {}) as Summary);
    } catch { setError('Unable to load XDrive enquiries.'); }
    finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setError(null); setNotice(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const res = await fetch(`/api/super-admin/xdrive-logistics/enquiries/${id}`, { headers: { Authorization: auth } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError((body as { error?: string }).error ?? 'Unable to load enquiry details.'); return; }
      const row = (body as { enquiry: Enquiry }).enquiry;
      setEnquiry(row);
      setPrice(typeof row.amount === 'number' ? row.amount.toFixed(2) : '');
      setSelectedId(id);
    } catch { setError('Unable to load enquiry details.'); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  const runAction = useCallback(async (payload: Record<string, unknown>, label: string) => {
    if (!selectedId) return;
    setBusy(label); setError(null); setNotice(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const res = await fetch(`/api/super-admin/xdrive-logistics/enquiries/${selectedId}`, {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError((body as { error?: string }).error ?? 'Action failed.'); return; }
      const job = (body as { job?: { id?: string } }).job;
      setNotice(job?.id ? `Converted to job ${job.id}.` : `${label} completed.`);
      await Promise.all([loadList(), loadDetail(selectedId)]);
    } catch { setError('Action failed.'); }
    finally { setBusy(null); }
  }, [loadDetail, loadList, selectedId]);

  const status = String(enquiry?.status ?? 'draft').toLowerCase();
  const canSend = Boolean(enquiry && typeof enquiry.amount === 'number' && enquiry.amount > 0 && !enquiry.converted_job_id);
  const canAccept = status === 'quote_sent' && !enquiry?.converted_job_id;
  const canConvert = status === 'accepted' && !enquiry?.converted_job_id;
  const details = useMemo(() => (enquiry?.notes ?? '').split('|').map(v => v.trim()).filter(Boolean), [enquiry?.notes]);

  return <ProtectedRoute allowedRoles={['owner']}>
    <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: 12 }}>
      <header style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 4, background: X.navy, color: X.white, fontSize: 12, fontWeight: 800 }}>✉</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, color: X.navy, fontSize: 20, lineHeight: 1.2, fontWeight: 800 }}>Public Enquiries / Business Operations</h1>
            <span style={{ padding: '3px 6px', borderRadius: 4, background: '#EEF4FF', color: X.blue, fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase' }}>XDrive Logistics</span>
          </div>
          <p style={{ margin: '4px 0 0', color: X.muted, fontSize: 12 }}>Customer transport enquiries submitted through app.xdrivelogistics.co.uk and assigned exclusively to XDrive Logistics Ltd.</p>
        </div>
      </header>

      {error && <div role="alert" style={{ ...panel, marginBottom: 12, borderLeft: `4px solid ${X.danger}`, color: X.danger }}>{error}</div>}
      {notice && <div style={{ ...panel, marginBottom: 12, borderLeft: `4px solid ${X.success}`, color: X.success }}>{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginBottom: 12 }}>
        <Metric value={summary.total_enquiries ?? 0} label="total enquiries" />
        <Metric value={summary.new_or_draft_on_page ?? 0} label="new or draft on page" />
        <Metric value={summary.priced_on_page ?? 0} label="priced on page" />
      </div>

      <section style={{ ...panel, padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        {loading ? <div style={{ padding: 18, color: X.muted, fontSize: 12 }}>Loading…</div> : rows.length === 0 ? <div style={{ padding: 18, color: X.muted, fontSize: 12 }}>No XDrive public enquiries found.</div> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050, fontSize: 12 }}>
            <thead><tr style={{ height: 38, background: X.light, borderBottom: `1px solid ${X.border}` }}>
              {['Customer','Route','Load / Vehicle','Price','Status','Received',''].map((label) => <th key={label || 'actions'} style={th}>{label}</th>)}
            </tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} style={{ borderBottom: `1px solid ${X.border}`, background: selectedId === row.id ? '#F8FBFF' : X.white }}>
              <td style={td}>{row.customer_name ?? '—'}</td>
              <td style={td}>{row.pickup_location ?? '—'} → {row.delivery_location ?? '—'}</td>
              <td style={td}>{row.cargo_type ?? '—'}{row.vehicle_type ? ` · ${row.vehicle_type}` : ''}</td>
              <td style={td}>{typeof row.amount === 'number' ? `${row.currency ?? 'GBP'} ${row.amount.toFixed(2)}` : 'Not priced'}</td>
              <td style={td}><StatusChip value={row.status ?? 'draft'} /></td>
              <td style={td}>{formatDateTime(row.created_at)}</td>
              <td style={{ ...td, textAlign: 'right' }}><button type="button" onClick={() => void loadDetail(row.id)} style={secondaryButton}>Open</button></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      {detailLoading && <div style={panel}>Loading enquiry…</div>}

      {!detailLoading && enquiry && <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <Info title="Customer" value={enquiry.customer_name ?? '—'} sub={[enquiry.customer_email, enquiry.customer_phone].filter(Boolean).join(' · ')} />
          <Info title="Route" value={`${enquiry.pickup_location ?? '—'} → ${enquiry.delivery_location ?? '—'}`} sub={`${enquiry.cargo_type ?? '—'}${enquiry.vehicle_type ? ` · ${enquiry.vehicle_type}` : ''}`} />
          <Info title="Received" value={formatDateTime(enquiry.created_at)} sub={enquiry.updated_at ? `Updated ${formatDateTime(enquiry.updated_at)}` : ''} />
          <Info title="Commercial status" value={enquiry.status ?? 'draft'} sub={enquiry.converted_job_id ? `Job ${enquiry.converted_job_id}` : ''} />
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>1. Price customer</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 700, color: X.navy }}>
              Customer price (GBP)
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" disabled={Boolean(enquiry.converted_job_id)} style={inputStyle} />
            </label>
            <button type="button" disabled={Boolean(enquiry.converted_job_id) || busy !== null || !(Number(price) > 0)} onClick={() => void runAction({ action: 'set_price', amount: Number(price) }, 'Price saved')} style={primaryButton}>Save price</button>
            <button type="button" disabled={!canSend || busy !== null} onClick={() => void runAction({ action: 'quote_sent' }, 'Quote sent')} style={primaryButton}>Mark Quote Sent</button>
            <button type="button" disabled={!canAccept || busy !== null} onClick={() => void runAction({ action: 'accepted' }, 'Customer accepted')} style={primaryButton}>Mark Accepted</button>
          </div>
          <div style={{ marginTop: 9, color: X.muted, fontSize: 11 }}>
            {enquiry.quote_sent_at ? `Quote sent: ${formatDateTime(enquiry.quote_sent_at)}. ` : ''}
            {enquiry.accepted_at ? `Accepted: ${formatDateTime(enquiry.accepted_at)}.` : ''}
          </div>
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>2. Convert accepted enquiry to job</h2>
          {enquiry.converted_job_id ? <>
            <div style={{ color: X.success, fontSize: 12, fontWeight: 800 }}>Converted successfully</div>
            <div style={{ marginTop: 4, color: X.muted, fontSize: 11 }}>Job ID: {enquiry.converted_job_id} · Execution: {enquiry.execution_mode ?? '—'} · {enquiry.converted_at ? formatDateTime(enquiry.converted_at) : ''}</div>
          </> : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={!canConvert || busy !== null} onClick={() => void runAction({ action: 'convert_to_job', executionMode: 'own_fleet' }, 'Own Fleet conversion')} style={conversionButton}>Own Fleet</button>
            <button type="button" disabled={!canConvert || busy !== null} onClick={() => void runAction({ action: 'convert_to_job', executionMode: 'direct_carrier' }, 'Direct Carrier conversion')} style={conversionButton}>Direct Carrier</button>
            <button type="button" disabled={!canConvert || busy !== null} onClick={() => void runAction({ action: 'convert_to_job', executionMode: 'marketplace' }, 'Marketplace conversion')} style={conversionButton}>Marketplace</button>
          </div>}
          {!canConvert && !enquiry.converted_job_id && <div style={{ marginTop: 8, color: X.muted, fontSize: 11 }}>The quote must be marked Accepted before conversion becomes available.</div>}
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>Enquiry details</h2>
          <div style={{ display: 'grid', gap: 7 }}>
            {details.length ? details.map((item, index) => <div key={`${index}-${item}`} style={{ borderBottom: index === details.length - 1 ? 'none' : `1px solid ${X.border}`, paddingBottom: 7, fontSize: 11 }}>{item}</div>) : <div style={{ color: X.muted, fontSize: 11 }}>No additional details.</div>}
          </div>
        </div>
      </section>}
    </div>
  </ProtectedRoute>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div style={{ minHeight: 82, background: X.white, border: `1px solid ${X.border}`, borderRadius: 4, padding: 12 }}><div style={{ color: X.navy, fontSize: 20, fontWeight: 800 }}>{value}</div><div style={{ marginTop: 8, color: X.charcoal, fontSize: 11, fontWeight: 700 }}>{label}</div></div>;
}

function Info({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return <div style={panel}><div style={{ color: X.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</div><div style={{ marginTop: 7, color: X.navy, fontSize: 14, fontWeight: 800 }}>{value}</div>{sub ? <div style={{ marginTop: 4, color: X.muted, fontSize: 11 }}>{sub}</div> : null}</div>;
}

const panel = { background: X.white, border: `1px solid ${X.border}`, borderRadius: 4, padding: 12 } as const;
const sectionTitle = { margin: '0 0 10px', color: X.navy, fontSize: 14, fontWeight: 800 } as const;
const th = { padding: '0 12px', textAlign: 'left' as const, color: X.navy, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.04em' };
const td = { padding: '9px 12px', color: X.charcoal, verticalAlign: 'top' as const };
const inputStyle = { width: 170, height: 34, border: `1px solid ${X.border}`, borderRadius: 4, padding: '0 9px', fontSize: 12, color: X.charcoal, background: X.white } as const;
const primaryButton = { height: 34, padding: '0 12px', border: `1px solid ${X.blue}`, borderRadius: 4, background: X.blue, color: X.white, fontSize: 11, fontWeight: 800, cursor: 'pointer' } as const;
const conversionButton = { ...primaryButton, border: `1px solid ${X.navy}`, background: X.navy } as const;
const secondaryButton = { height: 30, padding: '0 10px', border: `1px solid ${X.border}`, borderRadius: 4, background: X.white, color: X.navy, fontSize: 11, fontWeight: 800, cursor: 'pointer' } as const;
