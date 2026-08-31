'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { formatDateTime, routeSummary } from './superAdminFormatters';

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
    <div className="sa-page">
      <header className="sa-page-header">
        <div className="sa-heading-row">
          <span aria-hidden="true" className="sa-page-icon">{icon}</span>
          <div className="sa-page-heading">
            <div className="sa-eyebrow">Platform control plane <span className="sa-section-pill">{section}</span></div>
            <h1 className="sa-page-title">{title}</h1>
            <p className="sa-page-description">{description}</p>
          </div>
        </div>
      </header>

      {children ?? <>
        {dataError && <div role="alert" className="sa-notice" data-tone="danger">{dataError}</div>}

        <div className="sa-metric-grid">
          {metrics.map(([label, value]) => <div key={String(label)} className="sa-metric-card">
            <div className="sa-metric-value">{loading ? '—' : value}</div>
            <div className="sa-metric-label">{label}</div>
          </div>)}
        </div>

        <div className="sa-two-column">
          <PreviewPanel title="Recent platform jobs" subtitle="Latest canonical work across the network" loading={loading} empty={jobsPreview.length === 0}>
            {jobsPreview.map(job => <div key={job.id} className="sa-preview-row">
              <div className="sa-preview-row-title">{routeSummary(job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode)}</div>
              <div className="sa-preview-row-meta">{job.posting_company_name} · {job.status} · {job.bids_count} bids</div>
              <div className="sa-preview-row-time">{formatDateTime(job.created_at)}</div>
            </div>)}
          </PreviewPanel>

          <PreviewPanel title="Recent quote requests" subtitle="Commercial activity requiring awareness" loading={loading} empty={quotesPreview.length === 0}>
            {quotesPreview.map(quote => <div key={quote.id} className="sa-preview-row">
              <div className="sa-preview-row-title">{quote.company_name} · {quote.status}</div>
              <div className="sa-preview-row-meta">{quote.customer_name ?? 'Unknown customer'} · {quote.pickup_location ?? '—'} → {quote.delivery_location ?? '—'}</div>
              <div className="sa-preview-row-time">{quote.amount ? `${quote.amount} ${quote.currency ?? ''}`.trim() : 'Amount pending'} · {formatDateTime(quote.created_at)}</div>
            </div>)}
          </PreviewPanel>
        </div>
      </>}
    </div>
  </ProtectedRoute>;
}

function PreviewPanel({ title, subtitle, loading, empty, children }: { title: string; subtitle: string; loading: boolean; empty: boolean; children: ReactNode }) {
  return <section className="sa-panel">
    <div className="sa-panel-header">
      <div><h2 className="sa-panel-title">{title}</h2><p className="sa-panel-subtitle">{subtitle}</p></div>
    </div>
    {loading ? <div className="sa-loading">Loading…</div> : empty ? <div className="sa-empty">No records found.</div> : children}
  </section>;
}

export function BackToSuperAdminButton() {
  const router = useRouter();
  return <button onClick={() => router.push('/super-admin')} className="sa-button" data-variant="primary">← Back to Command Centre</button>;
}
