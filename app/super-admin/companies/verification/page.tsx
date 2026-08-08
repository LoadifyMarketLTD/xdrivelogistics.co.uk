'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { useRouter } from 'next/navigation';

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

function VerificationContent() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const res = await fetch('/api/super-admin/companies?status=pending', { headers: { Authorization: auth } });
      if (!res.ok) { setError('Company verification service is currently unavailable.'); return; }
      const data = await res.json() as { companies: Company[] };
      setCompanies(data.companies ?? []);
    } catch {
      setError('Company verification service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch_(); }, [fetch_]);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: '12px' }}>
      <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span aria-hidden="true" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '4px', background: THEME.heading, color: '#FFFFFF', fontSize: '12px' }}>ID</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Company Verification</h1><span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#EEF4FF', padding: '3px 6px', borderRadius: '4px' }}>Companies</span><span style={{ fontSize: '10px', color: THEME.muted }}>{loading ? '…' : `${companies.length} awaiting review`}</span></div>
            <p style={{ color: THEME.muted, margin: '4px 0 0', fontSize: '12px' }}>Companies pending verification and approval.</p>
          </div>
        </div>
        <button onClick={() => router.push('/super-admin/companies/approvals')} style={{ height: '32px', padding: '0 10px', backgroundColor: THEME.blue, color: '#FFFFFF', border: `1px solid ${THEME.blue}`, borderRadius: '4px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}>Go to Approvals →</button>
      </header>

      {error && <div role="alert" style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: '4px', padding: '9px 12px', color: THEME.red, fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>{error}</div>}

      <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>Loading…</div> : companies.length === 0 ? <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>No companies awaiting verification.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px', fontSize: '12px' }}>
              <thead><tr style={{ height: '38px', background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>{['Company name', 'Reg. number', 'Email', 'Type', 'Status', 'Submitted'].map((h) => <th key={h} style={{ padding: '0 12px', textAlign: 'left', color: THEME.heading, fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>{companies.map((co) => <tr key={co.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}><td style={{ padding: '9px 12px', color: THEME.text, fontWeight: 700 }}>{co.name}</td><td style={{ padding: '9px 12px', color: THEME.muted }}>{co.company_number ?? '—'}</td><td style={{ padding: '9px 12px', color: THEME.muted }}>{co.email ?? '—'}</td><td style={{ padding: '9px 12px', color: THEME.muted }}>{co.company_type ?? 'standard'}</td><td style={{ padding: '9px 12px' }}><span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.accent, backgroundColor: '#FFF7E6', border: `1px solid #F4D28C`, borderRadius: '4px', padding: '2px 5px' }}>{co.status}</span></td><td style={{ padding: '9px 12px', color: THEME.muted }}>{fmt(co.created_at)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><VerificationContent /></ProtectedRoute>;
}
