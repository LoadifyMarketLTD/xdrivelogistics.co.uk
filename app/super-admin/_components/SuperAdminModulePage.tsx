'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { formatDateTime, routeSummary } from './superAdminFormatters';
import { SUPER_ADMIN_THEME, superAdminCardStyle } from './superAdminTheme';

const THEME = {
  pageBg:     SUPER_ADMIN_THEME.pageBg,
  cardBg:     SUPER_ADMIN_THEME.cardBg,
  cardBorder: SUPER_ADMIN_THEME.cardBorder,
  text:       SUPER_ADMIN_THEME.text,
  muted:      SUPER_ADMIN_THEME.muted,
  accent:     SUPER_ADMIN_THEME.primary,
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
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.25rem' }}>
        <div style={{ ...superAdminCardStyle, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '1rem 1.1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>{title}</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.accent, backgroundColor: SUPER_ADMIN_THEME.primarySoft, padding: '0.18rem 0.5rem', borderRadius: '999px' }}>
                {section}
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{description}</p>
          </div>
        </div>

        {children ?? (
          <div style={{ ...superAdminCardStyle, padding: '1rem' }}>
            {dataError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#ef4444', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ {dataError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
              {[
                { label: 'Companies', value: stats?.companiesTotal ?? '—' },
                { label: 'Active companies', value: stats?.companiesActive ?? '—' },
                { label: 'Jobs total', value: stats?.jobsTotal ?? '—' },
                { label: 'Jobs open', value: stats?.jobsOpen ?? '—' },
                { label: 'Drivers', value: stats?.driversTotal ?? '—' },
                { label: 'Unpaid invoices', value: stats?.invoicesUnpaid ?? '—' },
              ].map((item) => (
                <div key={item.label} style={{ backgroundColor: '#f8fafc', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.65rem' }}>
                  <div style={{ color: THEME.text, fontSize: '1rem', fontWeight: 700 }}>{loading ? '…' : item.value}</div>
                  <div style={{ color: THEME.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
              <div style={{ backgroundColor: '#f8fafc', border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.8rem' }}>
                <h3 style={{ margin: '0 0 0.5rem', color: THEME.text, fontSize: '0.84rem' }}>Recent platform jobs</h3>
                {loading ? (
                  <div style={{ color: THEME.muted, fontSize: '0.78rem' }}>Loading…</div>
                ) : jobsPreview.length === 0 ? (
                  <div style={{ color: THEME.muted, fontSize: '0.78rem' }}>No jobs found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {jobsPreview.map((job) => (
                      <div key={job.id} style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '7px', padding: '0.55rem' }}>
                        <div style={{ color: THEME.text, fontWeight: 700, fontSize: '0.77rem' }}>
                          {routeSummary(job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode)}
                        </div>
                        <div style={{ color: THEME.muted, fontSize: '0.72rem', marginTop: '0.15rem' }}>
                          {job.posting_company_name} · {job.status} · bids {job.bids_count}
                        </div>
                        <div style={{ color: THEME.muted, fontSize: '0.68rem', marginTop: '0.1rem' }}>{formatDateTime(job.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.8rem' }}>
                <h3 style={{ margin: '0 0 0.5rem', color: THEME.text, fontSize: '0.84rem' }}>Recent quote requests</h3>
                {loading ? (
                  <div style={{ color: THEME.muted, fontSize: '0.78rem' }}>Loading…</div>
                ) : quotesPreview.length === 0 ? (
                  <div style={{ color: THEME.muted, fontSize: '0.78rem' }}>No quotes found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {quotesPreview.map((quote) => (
                      <div key={quote.id} style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '7px', padding: '0.55rem' }}>
                        <div style={{ color: THEME.text, fontWeight: 700, fontSize: '0.77rem' }}>
                          {quote.company_name} · {quote.status}
                        </div>
                        <div style={{ color: THEME.muted, fontSize: '0.72rem', marginTop: '0.15rem' }}>
                          {quote.customer_name ?? 'Unknown customer'} · {quote.pickup_location ?? '—'} → {quote.delivery_location ?? '—'}
                        </div>
                        <div style={{ color: THEME.muted, fontSize: '0.68rem', marginTop: '0.1rem' }}>
                          {quote.amount ? `${quote.amount} ${quote.currency ?? ''}`.trim() : 'Amount pending'} · {formatDateTime(quote.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
      style={{ padding: '0.5rem 1rem', backgroundColor: THEME.accent, color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
    >
      ← Back to Dashboard
    </button>
  );
}
