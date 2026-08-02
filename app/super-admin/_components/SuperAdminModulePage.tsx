'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { formatDateTime, routeSummary } from './superAdminFormatters';

const THEME = {
  pageBg: '#f5f7fa',
  cardBg: '#ffffff',
  cardBorder: '#d9e2ec',
  text: '#202124',
  muted: '#5f6368',
  accent: '#f5a300',
  blue: '#1d57d8',
};

interface SuperAdminModulePageProps {
  title: string;
  description: string;
  section: string;
  icon?: string;
  children?: ReactNode;
}

type PlatformStats = {
  companiesTotal: number;
  companiesActive: number;
  jobsTotal: number;
  jobsOpen: number;
  driversTotal: number;
  invoicesUnpaid: number;
};

type JobPreviewRow = {
  id: string;
  status: string;
  posting_company_name: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  created_at: string;
  bids_count: number;
};

type QuotePreviewRow = {
  id: string;
  status: string;
  company_name: string;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

export default function SuperAdminModulePage({
  title,
  description,
  section,
  icon = '🧩',
  children,
}: SuperAdminModulePageProps) {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [jobsPreview, setJobsPreview] = useState<JobPreviewRow[]>([]);
  const [quotesPreview, setQuotesPreview] = useState<QuotePreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setDataError(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) {
          setDataError('No active session.');
          setLoading(false);
          return;
        }

        const [statsRes, jobsRes, quotesRes] = await Promise.all([
          fetch('/api/super-admin/stats', { headers: { Authorization: auth } }),
          fetch('/api/super-admin/operations?section=jobs&limit=6', { headers: { Authorization: auth } }),
          fetch('/api/super-admin/operations?section=quotes&limit=6', { headers: { Authorization: auth } }),
        ]);

        const [statsBody, jobsBody, quotesBody] = await Promise.all([
          statsRes.json().catch(() => ({})),
          jobsRes.json().catch(() => ({})),
          quotesRes.json().catch(() => ({})),
        ]);

        if (!statsRes.ok) {
          setDataError((statsBody as { error?: string }).error ?? `HTTP ${statsRes.status}`);
          setLoading(false);
          return;
        }

        if (!jobsRes.ok) {
          setDataError((jobsBody as { error?: string }).error ?? `HTTP ${jobsRes.status}`);
          setLoading(false);
          return;
        }

        if (!quotesRes.ok) {
          setDataError((quotesBody as { error?: string }).error ?? `HTTP ${quotesRes.status}`);
          setLoading(false);
          return;
        }

        setStats(statsBody as PlatformStats);
        setJobsPreview(((jobsBody as { rows?: JobPreviewRow[] }).rows ?? []) as JobPreviewRow[]);
        setQuotesPreview(((quotesBody as { rows?: QuotePreviewRow[] }).rows ?? []) as QuotePreviewRow[]);
      } catch (err) {
        setDataError(err instanceof Error ? err.message : 'Data fetch failed.');
      } finally {
        setLoading(false);
      }
    };

    if (!children) {
      void run();
    }
  }, [children]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ padding: '12px 16px', maxWidth: '1480px', margin: '0 auto' }}>
        {/* Page header */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: THEME.blue, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{section}</div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, lineHeight: '30px', color: THEME.text }}>{icon} {title}</h1>
            <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: '18px', color: THEME.muted }}>{description}</p>
          </div>
        </header>

        {children ?? (
          <div>
            {dataError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '8px 12px', color: '#d93025', fontSize: '13px', marginBottom: '12px' }}>
                ⚠️ {dataError}
              </div>
            )}

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Companies', value: stats?.companiesTotal ?? '—' },
                { label: 'Active companies', value: stats?.companiesActive ?? '—' },
                { label: 'Jobs total', value: stats?.jobsTotal ?? '—' },
                { label: 'Jobs open', value: stats?.jobsOpen ?? '—' },
                { label: 'Drivers', value: stats?.driversTotal ?? '—' },
                { label: 'Unpaid invoices', value: stats?.invoicesUnpaid ?? '—' },
              ].map((item) => (
                <div key={item.label} style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '8px 12px' }}>
                  <div style={{ color: THEME.text, fontSize: '20px', fontWeight: 600, lineHeight: '26px' }}>{loading ? '…' : item.value}</div>
                  <div style={{ color: THEME.muted, fontSize: '12px', lineHeight: '16px', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Two-panel preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.79fr) minmax(0, 1fr)', gap: '12px' }}>
              <div style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${THEME.cardBorder}`, background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: THEME.text }}>Recent platform jobs</h3>
                </div>
                <div style={{ padding: '12px' }}>
                  {loading ? (
                    <div style={{ color: THEME.muted, fontSize: '13px' }}>Loading…</div>
                  ) : jobsPreview.length === 0 ? (
                    <div style={{ color: THEME.muted, fontSize: '13px' }}>No jobs found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {jobsPreview.map((job) => (
                        <div key={job.id} style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '8px 10px' }}>
                          <div style={{ color: THEME.text, fontWeight: 600, fontSize: '13px' }}>
                            {routeSummary(job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode)}
                          </div>
                          <div style={{ color: THEME.muted, fontSize: '12px', lineHeight: '16px', marginTop: '2px' }}>
                            {job.posting_company_name} · {job.status} · {job.bids_count} bids · {formatDateTime(job.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${THEME.cardBorder}`, background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: THEME.text }}>Recent quote requests</h3>
                </div>
                <div style={{ padding: '12px' }}>
                  {loading ? (
                    <div style={{ color: THEME.muted, fontSize: '13px' }}>Loading…</div>
                  ) : quotesPreview.length === 0 ? (
                    <div style={{ color: THEME.muted, fontSize: '13px' }}>No quotes found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {quotesPreview.map((quote) => (
                        <div key={quote.id} style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '8px 10px' }}>
                          <div style={{ color: THEME.text, fontWeight: 600, fontSize: '13px' }}>
                            {quote.company_name} · {quote.status}
                          </div>
                          <div style={{ color: THEME.muted, fontSize: '12px', lineHeight: '16px', marginTop: '2px' }}>
                            {quote.customer_name ?? 'Unknown customer'} · {quote.pickup_location ?? '—'} → {quote.delivery_location ?? '—'} · {quote.amount ? `£${quote.amount} ${quote.currency ?? ''}`.trim() : 'Amount pending'} · {formatDateTime(quote.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export function BackToSuperAdminButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/super-admin')}
      style={{ height: '32px', padding: '0 14px', background: '#ffffff', color: '#202124', border: '1px solid #c7d2df', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
    >
      ← Back to Dashboard
    </button>
  );
}
