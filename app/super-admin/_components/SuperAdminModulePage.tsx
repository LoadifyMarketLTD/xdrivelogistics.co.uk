'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { formatDateTime, routeSummary } from './superAdminFormatters';

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF',
  charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626',
} as const;

interface SuperAdminModulePageProps { title: string; description: string; section: string; icon?: string; children?: ReactNode; }
type PlatformStats = { companiesTotal: number; companiesActive: number; jobsTotal: number; jobsOpen: number; driversTotal: number; invoicesUnpaid: number; };
type JobPreviewRow = { id: string; status: string; posting_company_name: string; pickup_location: string | null; pickup_postcode: string | null; delivery_location: string | null; delivery_postcode: string | null; created_at: string; bids_count: number; };
type QuotePreviewRow = { id: string; status: string; company_name: string; customer_name: string | null; pickup_location: string | null; delivery_location: string | null; amount: number | null; currency: string | null; created_at: string; };

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
    <div style={{ minHeight: '100vh', background: X.light, padding: '12px', color: X.charcoal }}>
      <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '4px', background: X.navy, color: X.white, display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>{icon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '20px', lineHeight: 1.2, fontWeight: 800, color: X.navy, margin: 0 }}>{title}</h1>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: X.blue, background: '#EEF4FF', padding: '3px 6px', borderRadius: '4px' }}>{section}</span>
          </div>
          <p style={{ color: X.muted, margin: '4px 0 0', fontSize: '12px' }}>{description}</p>
        </div>
      </header>

      {children ?? <>
        {dataError && <div role="alert" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '12px' }}>{dataError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '12px', marginBottom: '12px' }}>
          {metrics.map(([label, value]) => <div key={String(label)} style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}>
            <div style={{ color: X.navy, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>{loading ? '—' : value}</div>
            <div style={{ marginTop: '8px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{label}</div>
          </div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: '12px' }}>
          <PreviewPanel title="Recent platform jobs" loading={loading} empty={jobsPreview.length === 0}>
            {jobsPreview.map(job => <div key={job.id} style={rowStyle}>
              <div style={{ color: X.navy, fontWeight: 800, fontSize: '12px' }}>{routeSummary(job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode)}</div>
              <div style={{ color: X.muted, fontSize: '11px', marginTop: '2px' }}>{job.posting_company_name} · {job.status} · bids {job.bids_count}</div>
              <div style={{ color: X.muted, fontSize: '10px', marginTop: '2px' }}>{formatDateTime(job.created_at)}</div>
            </div>)}
          </PreviewPanel>

          <PreviewPanel title="Recent quote requests" loading={loading} empty={quotesPreview.length === 0}>
            {quotesPreview.map(quote => <div key={quote.id} style={rowStyle}>
              <div style={{ color: X.navy, fontWeight: 800, fontSize: '12px' }}>{quote.company_name} · {quote.status}</div>
              <div style={{ color: X.muted, fontSize: '11px', marginTop: '2px' }}>{quote.customer_name ?? 'Unknown customer'} · {quote.pickup_location ?? '—'} → {quote.delivery_location ?? '—'}</div>
              <div style={{ color: X.muted, fontSize: '10px', marginTop: '2px' }}>{quote.amount ? `${quote.amount} ${quote.currency ?? ''}`.trim() : 'Amount pending'} · {formatDateTime(quote.created_at)}</div>
            </div>)}
          </PreviewPanel>
        </div>
      </>}
    </div>
  </ProtectedRoute>;
}

const rowStyle = { minHeight: '44px', padding: '9px 12px', borderBottom: `1px solid ${X.border}`, background: X.white } as const;

function PreviewPanel({ title, loading, empty, children }: { title: string; loading: boolean; empty: boolean; children: ReactNode }) {
  return <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
    <div style={{ height: '40px', padding: '0 12px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${X.border}`, color: X.navy, fontSize: '13px', fontWeight: 800 }}>{title}</div>
    {loading ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>Loading…</div> : empty ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>No records found.</div> : children}
  </section>;
}

export function BackToSuperAdminButton() {
  const router = useRouter();
  return <button onClick={() => router.push('/super-admin')} style={{ height: '32px', padding: '0 12px', background: X.blue, color: X.white, border: `1px solid ${X.blue}`, borderRadius: '4px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>← Back to Dashboard</button>;
}
