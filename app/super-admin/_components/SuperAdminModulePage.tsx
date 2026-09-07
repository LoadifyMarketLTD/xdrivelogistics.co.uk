'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { formatDateTime, routeSummary } from './superAdminFormatters';

const X = {
  blue: '#1A73E8',
  navy: '#1A73E8',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  white: '#FFFFFF',
  charcoal: '#4A4A4A',
  light: '#F5F7FA',
  border: '#E0E3E7',
  muted: '#4A4A4A',
  danger: '#EA4335',
  shadow: '0px 2px 6px rgba(0,0,0,0.08)',
} as const;

interface SuperAdminModulePageProps { title: string; description: string; section: string; icon?: string; children?: ReactNode; }
type PlatformStats = { companiesTotal: number; companiesActive: number; jobsTotal: number; jobsOpen: number; driversTotal: number; invoicesUnpaid: number; };
type JobPreviewRow = { id: string; status: string; posting_company_name: string; pickup_location: string | null; pickup_postcode: string | null; delivery_location: string | null; delivery_postcode: string | null; created_at: string; bids_count: number; };
type QuotePreviewRow = { id: string; status: string; company_name: string; customer_name: string | null; pickup_location: string | null; delivery_location: string | null; amount: number | null; currency: string | null; created_at: string; };

const titleStyle = { fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', lineHeight: 1.25, fontWeight: 700, color: X.blue } as const;

export default function SuperAdminModulePage({ title, description, section, icon = '•', children }: SuperAdminModulePageProps) {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [jobsPreview, setJobsPreview] = useState<JobPreviewRow[]>([]);
  const [quotesPreview, setQuotesPreview] = useState<QuotePreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setDataError(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) { setDataError('No active session.'); return; }
        const [statsRes, jobsRes, quotesRes] = await Promise.all([
          fetch('/api/super-admin/stats', { headers: { Authorization: auth } }),
          fetch('/api/super-admin/operations?section=jobs&limit=6', { headers: { Authorization: auth } }),
          fetch('/api/super-admin/operations?section=quotes&limit=6', { headers: { Authorization: auth } }),
        ]);
        if (!statsRes.ok || !jobsRes.ok || !quotesRes.ok) { setDataError('This module is temporarily unable to load all platform data.'); return; }
        const [statsBody, jobsBody, quotesBody] = await Promise.all([statsRes.json(), jobsRes.json(), quotesRes.json()]);
        setStats(statsBody as PlatformStats);
        setJobsPreview(((jobsBody as { rows?: JobPreviewRow[] }).rows ?? []) as JobPreviewRow[]);
        setQuotesPreview(((quotesBody as { rows?: QuotePreviewRow[] }).rows ?? []) as QuotePreviewRow[]);
      } catch { setDataError('This module is temporarily unable to load all platform data.'); }
      finally { setLoading(false); }
    };
    if (!children) void run();
  }, [children]);

  const metrics = [
    ['Companies', stats?.companiesTotal ?? '—'], ['Active companies', stats?.companiesActive ?? '—'],
    ['Jobs total', stats?.jobsTotal ?? '—'], ['Jobs open', stats?.jobsOpen ?? '—'],
    ['Drivers', stats?.driversTotal ?? '—'], ['Unpaid invoices', stats?.invoicesUnpaid ?? '—'],
  ];

  return <ProtectedRoute allowedRoles={['owner']}>
    <div style={{ minHeight: '100vh', background: X.light, padding: '24px', color: X.charcoal, fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: '14px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <span aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '8px', background: X.blue, color: X.white, display: 'grid', placeItems: 'center', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '16px', fontWeight: 700 }}>{icon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ ...titleStyle, margin: 0 }}>{title}</h1>
            <span style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: X.blue, background: X.light, padding: '4px 8px', borderRadius: '8px' }}>{section}</span>
          </div>
          <p style={{ color: X.muted, margin: '6px 0 0', fontSize: '14px' }}>{description}</p>
        </div>
      </header>

      {children ?? <>
        {dataError && <div role="alert" style={{ marginBottom: '24px', border: `1px solid ${X.danger}`, borderLeft: `4px solid ${X.danger}`, borderRadius: '8px', background: X.white, padding: '24px', color: X.danger, fontSize: '14px', boxShadow: X.shadow }}>{dataError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px', marginBottom: '24px' }}>
          {metrics.map(([label, value]) => <div key={String(label)} style={{ minHeight: '108px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '8px', padding: '24px', boxShadow: X.shadow }}>
            <div style={{ ...titleStyle }}>{loading ? '—' : value}</div>
            <div style={{ marginTop: '10px', color: X.charcoal, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700 }}>{label}</div>
          </div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: '24px' }}>
          <PreviewPanel title="Recent platform jobs" loading={loading} empty={jobsPreview.length === 0}>
            {jobsPreview.map(job => <div key={job.id} style={rowStyle}>
              <div style={{ ...titleStyle }}>{routeSummary(job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode)}</div>
              <div style={{ color: X.muted, fontSize: '14px', marginTop: '6px' }}>{job.posting_company_name} · {job.status} · bids {job.bids_count}</div>
              <div style={{ color: X.muted, fontSize: '14px', marginTop: '4px' }}>{formatDateTime(job.created_at)}</div>
            </div>)}
          </PreviewPanel>

          <PreviewPanel title="Recent quote requests" loading={loading} empty={quotesPreview.length === 0}>
            {quotesPreview.map(quote => <div key={quote.id} style={rowStyle}>
              <div style={{ ...titleStyle }}>{quote.company_name} · {quote.status}</div>
              <div style={{ color: X.muted, fontSize: '14px', marginTop: '6px' }}>{quote.customer_name ?? 'Unknown customer'} · {quote.pickup_location ?? '—'} → {quote.delivery_location ?? '—'}</div>
              <div style={{ color: X.muted, fontSize: '14px', marginTop: '4px' }}>{quote.amount ? `${quote.amount} ${quote.currency ?? ''}`.trim() : 'Amount pending'} · {formatDateTime(quote.created_at)}</div>
            </div>)}
          </PreviewPanel>
        </div>
      </>}
    </div>
  </ProtectedRoute>;
}

const rowStyle = { minHeight: '64px', padding: '24px', borderBottom: `1px solid ${X.border}`, background: X.white } as const;

function PreviewPanel({ title, loading, empty, children }: { title: string; loading: boolean; empty: boolean; children: ReactNode }) {
  return <section style={{ border: `1px solid ${X.border}`, borderRadius: '8px', background: X.white, overflow: 'hidden', boxShadow: X.shadow }}>
    <div style={{ padding: '24px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${X.border}`, ...titleStyle }}>{title}</div>
    {loading ? <div style={{ padding: '24px', textAlign: 'center', color: X.muted, fontSize: '14px' }}>Loading…</div> : empty ? <div style={{ padding: '24px', textAlign: 'center', color: X.muted, fontSize: '14px' }}>No records found.</div> : children}
  </section>;
}

export function BackToSuperAdminButton() {
  const router = useRouter();
  return <button onClick={() => router.push('/super-admin')} style={{ minHeight: '40px', padding: '0 14px', background: X.blue, color: X.white, border: `1px solid ${X.blue}`, borderRadius: '8px', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>← Back to Dashboard</button>;
}
