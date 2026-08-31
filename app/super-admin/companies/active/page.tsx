'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { PlatformEntityLink } from '@/app/super-admin/_components/control-plane';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F4F6F8', cardBg: '#FFFFFF', cardBorder: '#D9E1EA', text: '#1A1F2B', heading: '#0B2F6B',
  blue: '#1D57D8', muted: '#64748B', accent: '#F5A300', green: '#16A34A', red: '#DC2626',
};

type Company = { id: string; name: string; company_number: string | null; email: string | null; status: string; company_type: string | null; created_at: string };

function ActiveCompaniesContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null); setCompanies([]);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const res = await fetch('/api/super-admin/companies?status=active', { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await res.json().catch(() => ({})) as { companies?: Company[]; error?: string };
      if (!res.ok) { setError(body.error ?? 'Company service is currently unavailable.'); return; }
      setCompanies(body.companies ?? []);
    } catch { setError('Company service is currently unavailable.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetch_(); }, [fetch_]);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: '12px' }}>
    <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
      <span aria-hidden="true" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '4px', background: THEME.heading, color: '#FFFFFF', fontSize: '12px' }}>✓</span>
      <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Active Companies</h1><span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#EEF4FF', padding: '3px 6px', borderRadius: '4px' }}>Companies</span><span style={{ fontSize: '10px', color: THEME.muted }}>{loading ? '…' : error ? '— total' : `${companies.length} total`}</span></div><p style={{ color: THEME.muted, margin: '4px 0 0', fontSize: '12px' }}>Currently active and approved companies across the platform.</p></div>
      <button onClick={() => void fetch_()} disabled={loading} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${THEME.blue}`, background: THEME.blue, color: '#FFFFFF', fontWeight: 800, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>{loading ? 'Loading…' : 'Refresh'}</button>
    </header>

    {error && <div role="alert" style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: '4px', padding: '9px 12px', color: THEME.red, fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>{error}</div>}

    <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
      {loading ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>Loading…</div> : error ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>Active-company registry unavailable. No empty result is inferred.</div> : companies.length === 0 ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>No active companies found.</div> : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px', fontSize: '12px' }}>
          <thead><tr style={{ height: '38px', background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>{['Company name', 'Reg. number', 'Email', 'Type', 'Status', 'Created', 'Inspect'].map((heading) => <th key={heading} style={{ padding: '0 12px', textAlign: 'left', color: THEME.heading, fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{heading}</th>)}</tr></thead>
          <tbody>{companies.map((company) => <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
            <td style={{ padding: '9px 12px', color: THEME.text, fontWeight: 700 }}>{company.name}</td>
            <td style={{ padding: '9px 12px', color: THEME.muted }}>{company.company_number ?? '—'}</td>
            <td style={{ padding: '9px 12px', color: THEME.muted }}>{company.email ?? '—'}</td>
            <td style={{ padding: '9px 12px', color: THEME.muted }}>{company.company_type ?? 'standard'}</td>
            <td style={{ padding: '9px 12px' }}><span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.green, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '4px', padding: '2px 5px' }}>Active</span></td>
            <td style={{ padding: '9px 12px', color: THEME.muted }}>{fmt(company.created_at)}</td>
            <td style={{ padding: '9px 12px' }}><PlatformEntityLink entityType="company" entityId={company.id} compact>Inspect</PlatformEntityLink></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}

export default function Page() { return <ProtectedRoute allowedRoles={['owner']}><ActiveCompaniesContent /></ProtectedRoute>; }
