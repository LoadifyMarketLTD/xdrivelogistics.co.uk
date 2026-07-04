'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type MarketplaceJobRow = {
  id: string;
  status: string;
  exchange_visibility: string;
  exchange_posted_at: string | null;
  posting_company_name: string;
  awarded_company_name: string | null;
  bids_count: number;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
};

type MarketplaceAuditRow = {
  id: string;
  action_type: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
  target_company_id: string;
};

type MarketplaceSummary = {
  totalJobs: number;
  exchangeVisible: number;
  posted: number;
  allocated: number;
  inTransit: number;
  disputed: number;
  cancelled: number;
  delivered: number;
};

type MarketplaceAction = 'publish_to_exchange' | 'hide_from_exchange' | 'force_dispute' | 'force_cancel';

type MarketplaceResponse = {
  jobs: MarketplaceJobRow[];
  summary: MarketplaceSummary;
  governanceHistoryAvailable?: boolean;
  governanceHistoryError?: string | null;
  governanceHistoryRecent?: MarketplaceAuditRow[];
  fetchedAt?: string;
  pollingSuggestedMs?: number;
};

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
};

function getActionsForRow(row: MarketplaceJobRow): MarketplaceAction[] {
  const normalizedStatus = row.status.toLowerCase();
  const actions: MarketplaceAction[] = [];

  if (row.exchange_visibility === 'exchange') {
    actions.push('hide_from_exchange');
  } else if (normalizedStatus === 'draft' || normalizedStatus === 'posted') {
    actions.push('publish_to_exchange');
  }

  if (['draft', 'posted', 'allocated', 'in_transit'].includes(normalizedStatus)) {
    actions.push('force_dispute', 'force_cancel');
  }

  return actions;
}

export default function Page() {
  const [jobs, setJobs] = useState<MarketplaceJobRow[]>([]);
  const [summary, setSummary] = useState<MarketplaceSummary | null>(null);
  const [auditRows, setAuditRows] = useState<MarketplaceAuditRow[]>([]);
  const [governanceHistoryAvailable, setGovernanceHistoryAvailable] = useState(false);
  const [governanceHistoryError, setGovernanceHistoryError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState<{ jobId: string; action: MarketplaceAction } | null>(null);
  const [pollingMs, setPollingMs] = useState(15000);

  const fetchMarketplace = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active session.');
        if (!silent) setLoading(false);
        return;
      }

      const res = await fetch('/api/super-admin/marketplace?limit=250&auditLimit=120', {
        headers: { Authorization: auth },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        if (!silent) setLoading(false);
        return;
      }

      const payload = body as MarketplaceResponse;
      setJobs(payload.jobs ?? []);
      setSummary(payload.summary ?? null);
      setAuditRows(payload.governanceHistoryRecent ?? []);
      setGovernanceHistoryAvailable(Boolean(payload.governanceHistoryAvailable));
      setGovernanceHistoryError(payload.governanceHistoryError ?? null);
      setFetchedAt(payload.fetchedAt ?? new Date().toISOString());
      setPollingMs(Math.max(5000, payload.pollingSuggestedMs ?? 15000));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMarketplace();
  }, [fetchMarketplace]);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchMarketplace(true);
    }, pollingMs);
    return () => clearInterval(timer);
  }, [fetchMarketplace, pollingMs]);

  const quickStats = useMemo(() => [
    { label: 'Total Jobs', value: summary?.totalJobs ?? jobs.length },
    { label: 'On Exchange', value: summary?.exchangeVisible ?? jobs.filter((job) => job.exchange_visibility === 'exchange').length },
    { label: 'Posted', value: summary?.posted ?? 0 },
    { label: 'Allocated', value: summary?.allocated ?? 0 },
    { label: 'In Transit', value: summary?.inTransit ?? 0 },
    { label: 'Disputed', value: summary?.disputed ?? 0 },
    { label: 'Cancelled', value: summary?.cancelled ?? 0 },
    { label: 'Delivered', value: summary?.delivered ?? 0 },
  ], [jobs, summary]);

  const handleAction = async (job: MarketplaceJobRow, action: MarketplaceAction) => {
    const reason = window.prompt(`Optional reason for '${action}' on job ${job.id}:`, '');
    setActing({ jobId: job.id, action });
    setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setMessage('No active session.');
        return;
      }

      const res = await fetch(`/api/super-admin/marketplace/${job.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth,
        },
        body: JSON.stringify({
          action,
          reason: reason?.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      setMessage(`Action '${action}' applied on job ${job.id}.`);
      await fetchMarketplace(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🌍</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Marketplace Governance Feed</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Marketplace
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Live cross-company marketplace feed with owner intervention controls and governance audit log.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
          {quickStats.map((item) => (
            <div key={item.label} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.75rem' }}>
              <div style={{ color: THEME.text, fontSize: '1.1rem', fontWeight: 700 }}>{item.value}</div>
              <div style={{ color: THEME.muted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => void fetchMarketplace()}
            style={{
              borderRadius: '7px',
              border: `1px solid ${THEME.cardBorder}`,
              backgroundColor: '#0b1220',
              color: THEME.text,
              padding: '0.45rem 0.7rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Refresh feed
          </button>
          <span style={{ color: THEME.muted, fontSize: '0.75rem' }}>
            Last update: {fetchedAt ? formatDateTime(fetchedAt) : '—'} · Auto-refresh: {Math.round(pollingMs / 1000)}s
          </span>
        </div>

        {message && (
          <div style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: `1px solid ${THEME.accent}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.accent, fontSize: '0.82rem', marginBottom: '1rem' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>No marketplace jobs found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1140px', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    {['Route', 'Status', 'Visibility', 'Posting company', 'Awarded company', 'Bids', 'Created', 'Owner interventions'].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: '0.75rem 0.9rem',
                          textAlign: 'left',
                          color: THEME.muted,
                          fontWeight: 600,
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((row) => {
                    const actions = getActionsForRow(row);
                    return (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>
                          <div style={{ fontWeight: 700 }}>
                            {routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: THEME.muted, marginTop: '0.2rem' }}>
                            Pickup: {formatDateTime(row.pickup_datetime)} · Delivery: {formatDateTime(row.delivery_datetime)}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem' }}>
                          <StatusChip value={row.status} />
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>
                          <div style={{ fontWeight: 700 }}>{row.exchange_visibility}</div>
                          <div style={{ color: THEME.muted, fontSize: '0.72rem' }}>
                            Posted: {formatDateTime(row.exchange_posted_at)}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{row.posting_company_name}</td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{row.awarded_company_name ?? '—'}</td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{row.bids_count}</td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{formatDateTime(row.created_at)}</td>
                        <td style={{ padding: '0.75rem 0.9rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {actions.length === 0 && (
                              <span style={{ color: THEME.muted, fontSize: '0.74rem' }}>No action</span>
                            )}
                            {actions.map((action) => {
                              const isBusy = acting?.jobId === row.id && acting.action === action;
                              const danger = action === 'force_dispute' || action === 'force_cancel' || action === 'hide_from_exchange';
                              return (
                                <button
                                  key={action}
                                  onClick={() => void handleAction(row, action)}
                                  disabled={Boolean(acting)}
                                  style={{
                                    padding: '0.28rem 0.6rem',
                                    borderRadius: '6px',
                                    border: `1px solid ${danger ? THEME.red : THEME.green}`,
                                    backgroundColor: 'transparent',
                                    color: danger ? THEME.red : THEME.green,
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    opacity: isBusy ? 0.6 : 1,
                                  }}
                                >
                                  {isBusy ? '…' : action}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '0.9rem' }}>
          <h2 style={{ margin: '0 0 0.6rem', color: THEME.text, fontSize: '0.92rem' }}>Marketplace Governance Audit Log</h2>
          {!governanceHistoryAvailable ? (
            <p style={{ margin: 0, color: THEME.red, fontSize: '0.8rem' }}>
              Audit unavailable{governanceHistoryError ? `: ${governanceHistoryError}` : ''}.
            </p>
          ) : auditRows.length === 0 ? (
            <p style={{ margin: 0, color: THEME.muted, fontSize: '0.8rem' }}>No marketplace governance events recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {auditRows.slice(0, 20).map((event) => (
                <div key={event.id} style={{ fontSize: '0.78rem', color: THEME.text }}>
                  <span style={{ color: THEME.accent, fontWeight: 700 }}>{event.action_type}</span>
                  <span style={{ color: THEME.muted }}> · {formatDateTime(event.created_at)} · {event.old_status} → {event.new_status}</span>
                  <div style={{ color: THEME.muted, marginTop: '0.1rem' }}>{event.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
