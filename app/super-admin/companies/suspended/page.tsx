'use client';

import { useEffect, useState, useCallback } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  blue: '#1D57D8',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
};

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

type PendingReinstate = { companyId: string; companyName: string } | null;

function ReinstateModal({ pending, onConfirm, onCancel, submitting }: { pending: PendingReinstate; onConfirm: (reason: string) => void; onCancel: () => void; submitting: boolean; }) {
  const [reason, setReason] = useState('');
  if (!pending) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(26,31,43,0.56)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 14px 34px rgba(11,47,107,.16)' }}>
        <h2 style={{ margin: '0 0 5px', fontSize: '16px', fontWeight: 800, color: THEME.heading }}>Reinstate company</h2>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: THEME.muted, lineHeight: 1.45 }}>You are about to <strong style={{ color: THEME.green }}>reinstate</strong> <strong style={{ color: THEME.text }}>{pending.companyName}</strong> and restore platform access. This action is recorded in the audit log.</p>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: THEME.heading }}>Reason for reinstatement (optional)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain why this company is being reinstated…" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '8px 10px', color: THEME.text, fontSize: '12px', resize: 'vertical', outlineColor: THEME.blue }} />
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={submitting} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#FFFFFF', color: THEME.heading, fontSize: '11px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(reason.trim())} disabled={submitting} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${THEME.green}`, backgroundColor: THEME.green, color: '#FFFFFF', fontWeight: 800, fontSize: '11px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .6 : 1 }}>{submitting ? '…' : 'Confirm Reinstatement'}</button>
        </div>
      </div>
    </div>
  );
}

function SuspendedContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReinstate>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchSuspended = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const res = await fetch('/api/super-admin/companies?status=suspended', { headers: { Authorization: auth } });
      if (!res.ok) { setError('Company service is currently unavailable.'); return; }
      const data = await res.json() as { companies: Company[] };
      setCompanies(data.companies ?? []);
    } catch {
      setError('Company service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSuspended(); }, [fetchSuspended]);

  const handleConfirm = async (reason: string) => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setActionMessage('No active session.'); setPending(null); return; }
      const body: Record<string, string> = { action: 'reinstate' };
      if (reason) body.reason = reason;
      const res = await fetch(`/api/super-admin/companies/${pending.companyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify(body) });
      if (!res.ok) {
        setActionMessage('The company could not be reinstated.');
      } else {
        setActionMessage('Company reinstated successfully.');
        await fetchSuspended();
      }
    } catch {
      setActionMessage('The company could not be reinstated.');
    } finally {
      setPending(null);
      setSubmitting(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      <ReinstateModal pending={pending} onConfirm={handleConfirm} onCancel={() => setPending(null)} submitting={submitting} />
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '4px', background: THEME.heading, color: '#FFFFFF', fontSize: '12px' }}>×</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Suspended Companies</h1><span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#EEF4FF', padding: '3px 6px', borderRadius: '4px' }}>Companies</span><span style={{ fontSize: '10px', color: THEME.muted }}>{loading ? '…' : `${companies.length} total`}</span></div>
            <p style={{ color: THEME.muted, margin: '4px 0 0', fontSize: '12px' }}>Suspended companies. Reinstate restores platform access without deleting company data.</p>
          </div>
          <button onClick={() => void fetchSuspended()} disabled={loading} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${THEME.blue}`, background: THEME.blue, color: '#FFFFFF', fontWeight: 800, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </header>

        {actionMessage && <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.accent}`, borderLeft: `4px solid ${THEME.accent}`, borderRadius: '4px', padding: '9px 12px', color: THEME.text, fontSize: '11px', marginBottom: '12px' }}>{actionMessage}</div>}
        {error && <div role="alert" style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: '4px', padding: '9px 12px', color: THEME.red, fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>{error}</div>}

        <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>Loading…</div> : companies.length === 0 ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>No suspended companies.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px', fontSize: '12px' }}>
                <thead><tr style={{ height: '38px', background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>{['Company name', 'Reg. number', 'Email', 'Type', 'Created', 'Action'].map((h) => <th key={h} style={{ padding: '0 12px', textAlign: 'left', color: THEME.heading, fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>{companies.map((co) => <tr key={co.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  <td style={{ padding: '9px 12px', color: THEME.text, fontWeight: 700 }}>{co.name}<span style={{ marginLeft: '6px', fontSize: '10px', color: THEME.red, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '2px 5px', fontWeight: 800, textTransform: 'uppercase' }}>Suspended</span></td>
                  <td style={{ padding: '9px 12px', color: THEME.muted }}>{co.company_number ?? '—'}</td><td style={{ padding: '9px 12px', color: THEME.muted }}>{co.email ?? '—'}</td><td style={{ padding: '9px 12px', color: THEME.muted }}>{co.company_type ?? 'standard'}</td><td style={{ padding: '9px 12px', color: THEME.muted }}>{fmt(co.created_at)}</td>
                  <td style={{ padding: '9px 12px' }}><button onClick={() => { setActionMessage(null); setPending({ companyId: co.id, companyName: co.name }); }} disabled={submitting && pending?.companyId === co.id} style={{ height: '30px', padding: '0 9px', borderRadius: '4px', border: `1px solid ${THEME.green}`, backgroundColor: '#FFFFFF', color: THEME.green, fontWeight: 800, fontSize: '10px', cursor: 'pointer' }}>Reinstate</button></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><SuspendedContent /></ProtectedRoute>;
}
