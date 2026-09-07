'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const V2 = {
  blue: '#1A73E8',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  grey: '#8A9099',
  white: '#FFFFFF',
  shadow: '0px 2px 6px rgba(0,0,0,0.08)',
} as const;

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

const buttonStyle = {
  minHeight: '40px',
  padding: '12px 18px',
  border: `1px solid ${V2.grey}`,
  borderRadius: '8px',
  background: V2.white,
  color: V2.blue,
  boxShadow: V2.shadow,
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
  fontWeight: 500,
} as const;

function ActiveCompaniesContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const res = await fetch('/api/super-admin/companies?status=active', { headers: { Authorization: auth } });
      if (!res.ok) { setError('Company service is currently unavailable.'); return; }
      const data = await res.json() as { companies: Company[] };
      setCompanies(data.companies ?? []);
    } catch {
      setError('Company service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch_(); }, [fetch_]);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <main style={{ minHeight: '100vh', background: V2.white, color: V2.grey, padding: '24px', fontFamily: 'Inter, Arial, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px', padding: '24px', border: `1px solid ${V2.grey}`, borderRadius: '8px', background: V2.white, boxShadow: V2.shadow }}>
        <span aria-hidden="true" style={{ width: '24px', height: '24px', display: 'grid', placeItems: 'center', borderRadius: '8px', background: V2.green, color: V2.white, boxShadow: V2.shadow, fontSize: '24px', lineHeight: '24px' }}>✓</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <h1 style={{ margin: 0, color: V2.blue, fontSize: '20px', fontWeight: 700 }}>Active Companies</h1>
            <span data-status-chip style={{ padding: '4px 10px', border: `1px solid ${V2.blue}`, borderRadius: '8px', background: V2.white, color: V2.blue, boxShadow: V2.shadow, fontSize: '14px', fontWeight: 400 }}>Companies</span>
            <span style={{ color: V2.grey, fontSize: '14px', fontWeight: 400 }}>{loading ? '…' : `${companies.length} total`}</span>
          </div>
          <p style={{ margin: '24px 0 0', color: V2.grey, fontSize: '14px', fontWeight: 400 }}>Currently active and approved companies across the platform.</p>
        </div>
        <button type="button" onClick={() => void fetch_()} disabled={loading} style={{ ...buttonStyle, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Loading…' : 'Refresh'}</button>
      </header>

      {error && <div role="alert" style={{ marginBottom: '24px', padding: '24px', border: `1px solid ${V2.red}`, borderRadius: '8px', background: V2.white, color: V2.red, boxShadow: V2.shadow, fontSize: '14px' }}>{error}</div>}

      <section style={{ border: `1px solid ${V2.grey}`, borderRadius: '8px', overflow: 'hidden', background: V2.white, boxShadow: V2.shadow }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: V2.grey, fontSize: '14px' }}>Loading…</div>
        ) : companies.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: V2.grey, fontSize: '14px' }}>No active companies found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px', background: V2.white, boxShadow: V2.shadow, fontSize: '14px' }}>
              <thead>
                <tr style={{ background: V2.white, borderBottom: `1px solid ${V2.grey}` }}>
                  {['Company Name', 'Reg. Number', 'Email', 'Type', 'Status', 'Created'].map((h) => (
                    <th key={h} style={{ padding: '24px', textAlign: 'left', color: V2.blue, fontSize: '14px', fontWeight: 400, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((co) => (
                  <tr key={co.id} style={{ borderBottom: `1px solid ${V2.grey}` }}>
                    <td style={{ padding: '24px', color: V2.grey, fontSize: '14px', fontWeight: 400 }}>{co.name}</td>
                    <td style={{ padding: '24px', color: V2.grey }}>{co.company_number ?? '—'}</td>
                    <td style={{ padding: '24px', color: V2.grey }}>{co.email ?? '—'}</td>
                    <td style={{ padding: '24px', color: V2.grey }}>{co.company_type ?? 'standard'}</td>
                    <td style={{ padding: '24px' }}><span data-status-chip style={{ display: 'inline-flex', padding: '4px 10px', border: `1px solid ${V2.green}`, borderRadius: '8px', background: V2.white, color: V2.green, boxShadow: V2.shadow, fontSize: '14px', fontWeight: 400 }}>READY</span></td>
                    <td style={{ padding: '24px', color: V2.grey }}>{fmt(co.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><ActiveCompaniesContent /></ProtectedRoute>;
}
