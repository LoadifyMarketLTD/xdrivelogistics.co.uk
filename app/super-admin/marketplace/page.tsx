'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Store } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import {
  SuperAdminDataGrid,
  SuperAdminEmptyState,
  SuperAdminMetricCard,
  SuperAdminMetricGrid,
  SuperAdminNotice,
  SuperAdminPage,
  SuperAdminPageHeader,
  SuperAdminPager,
  SuperAdminSectionCard,
  SuperAdminStatusBadge,
  SuperAdminUnavailableState,
  type EnterpriseTone,
  type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

const PAGE_SIZE = 50;

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

type MarketplacePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type MarketplaceAction = 'publish_to_exchange' | 'hide_from_exchange' | 'force_dispute' | 'force_cancel';

type MarketplaceResponse = {
  jobs: MarketplaceJobRow[];
  summary: MarketplaceSummary;
  pagination: MarketplacePagination;
  governanceHistoryAvailable?: boolean;
  governanceHistoryError?: string | null;
  governanceHistoryRecent?: MarketplaceAuditRow[];
  fetchedAt?: string;
  pollingSuggestedMs?: number;
};

function getActionsForRow(row: MarketplaceJobRow): MarketplaceAction[] {
  const normalizedStatus = row.status.toLowerCase();
  const actions: MarketplaceAction[] = [];
  if (row.exchange_visibility === 'exchange') actions.push('hide_from_exchange');
  else if (normalizedStatus === 'draft' || normalizedStatus === 'posted') actions.push('publish_to_exchange');
  if (['draft', 'posted', 'allocated', 'in_transit'].includes(normalizedStatus)) actions.push('force_dispute', 'force_cancel');
  return actions;
}

function actionLabel(action: MarketplaceAction) {
  return action.replaceAll('_', ' ');
}

function actionStyle(danger: boolean) {
  const color = danger ? '#D92D20' : '#168553';
  return {
    minHeight: 30,
    padding: '0 9px',
    borderRadius: 7,
    border: `1px solid ${color}`,
    background: '#FFFFFF',
    color,
    font: 'inherit',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  } as const;
}

function metricTone(label: string): EnterpriseTone {
  if (label === 'Disputed' || label === 'Cancelled') return 'danger';
  if (label === 'Delivered') return 'success';
  if (label === 'On Exchange' || label === 'In Transit') return 'info';
  return 'neutral';
}

const isResponse = (value: unknown): value is MarketplaceResponse => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const pagination = row.pagination as Record<string, unknown> | undefined;
  return Array.isArray(row.jobs)
    && Boolean(row.summary && typeof row.summary === 'object')
    && Boolean(pagination && typeof pagination.page === 'number' && typeof pagination.total === 'number'
      && typeof pagination.hasNextPage === 'boolean' && typeof pagination.hasPrevPage === 'boolean');
};

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
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState(0);
  const [pendingModal, setPendingModal] = useState<{ job: MarketplaceJobRow; action: MarketplaceAction } | null>(null);

  const fetchMarketplace = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setJobs([]);
      setSummary(null);
      setTotal(0);
      setHasNextPage(false);
      setFetchedAt(null);
    }
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch(`/api/super-admin/marketplace?page=${page}&limit=${PAGE_SIZE}&auditLimit=80`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((body as { error?: string }).error ?? `Marketplace service unavailable (${response.status}).`);
        return;
      }
      if (!isResponse(body)) {
        setError('Marketplace service returned an incomplete response. No totals were inferred.');
        return;
      }
      setJobs(body.jobs);
      setSummary(body.summary);
      setAuditRows(body.governanceHistoryRecent ?? []);
      setGovernanceHistoryAvailable(Boolean(body.governanceHistoryAvailable));
      setGovernanceHistoryError(body.governanceHistoryError ?? null);
      setFetchedAt(body.fetchedAt ?? new Date().toISOString());
      setPollingMs(Math.max(5000, body.pollingSuggestedMs ?? 15000));
      setHasNextPage(body.pagination.hasNextPage);
      setTotal(body.pagination.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Marketplace service is unavailable.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page]);

  useEffect(() => { void fetchMarketplace(); }, [fetchMarketplace]);
  useEffect(() => {
    const timer = window.setInterval(() => { void fetchMarketplace(true); }, pollingMs);
    return () => window.clearInterval(timer);
  }, [fetchMarketplace, pollingMs]);

  const quickStats = useMemo(() => summary ? [
    { label: 'Total Jobs', value: summary.totalJobs },
    { label: 'On Exchange', value: summary.exchangeVisible },
    { label: 'Posted', value: summary.posted },
    { label: 'Allocated', value: summary.allocated },
    { label: 'In Transit', value: summary.inTransit },
    { label: 'Disputed', value: summary.disputed },
    { label: 'Cancelled', value: summary.cancelled },
    { label: 'Delivered', value: summary.delivered },
  ] : [], [summary]);

  const handleAction = async (job: MarketplaceJobRow, action: MarketplaceAction, reason = '') => {
    setActing({ jobId: job.id, action });
    setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setMessage('No active Platform Owner session.');
        return;
      }
      const response = await fetch(`/api/super-admin/marketplace/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action, reason: reason || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage((body as { error?: string }).error ?? `HTTP ${response.status}`);
        return;
      }
      setMessage(`Action '${actionLabel(action)}' applied on job ${job.id}.`);
      await fetchMarketplace(true);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  const initiateAction = (job: MarketplaceJobRow, action: MarketplaceAction) => {
    if (action === 'force_dispute' || action === 'force_cancel') setPendingModal({ job, action });
    else void handleAction(job, action);
  };

  const columns: SuperAdminDataColumn<MarketplaceJobRow>[] = [
    {
      key: 'route',
      label: 'Route',
      render: (row) => <><strong>{routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode)}</strong><div>Pickup: {formatDateTime(row.pickup_datetime)} ? Delivery: {formatDateTime(row.delivery_datetime)}</div></>,
    },
    { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
    { key: 'visibility', label: 'Visibility', render: (row) => <><strong>{row.exchange_visibility}</strong><div>Posted: {formatDateTime(row.exchange_posted_at)}</div></> },
    { key: 'posting', label: 'Posting company', render: (row) => row.posting_company_name },
    { key: 'awarded', label: 'Awarded company', render: (row) => row.awarded_company_name ?? '?' },
    { key: 'bids', label: 'Bids', render: (row) => row.bids_count.toLocaleString() },
    { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
    {
      key: 'actions',
      label: 'Owner interventions',
      render: (row) => {
        const actions = getActionsForRow(row);
        if (actions.length === 0) return 'No action';
        return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{actions.map((action) => {
          const busy = acting?.jobId === row.id && acting.action === action;
          const danger = action === 'force_dispute' || action === 'force_cancel' || action === 'hide_from_exchange';
          return <button key={action} type="button" onClick={() => initiateAction(row, action)} disabled={Boolean(acting)} style={{ ...actionStyle(danger), opacity: busy ? 0.55 : 1 }}>{busy ? '?' : actionLabel(action)}</button>;
        })}</div>;
      },
    },
  ];

  const auditColumns: SuperAdminDataColumn<MarketplaceAuditRow>[] = [
    { key: 'action', label: 'Action', render: (row) => <strong>{row.action_type.replaceAll('_', ' ')}</strong> },
    { key: 'transition', label: 'Transition', render: (row) => `${row.old_status} ? ${row.new_status}` },
    { key: 'reason', label: 'Reason', render: (row) => row.reason },
    { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
  ];

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ActionConfirmModal
        open={pendingModal !== null}
        title={pendingModal?.action === 'force_dispute' ? 'Force dispute' : 'Force cancel'}
        description={pendingModal?.action === 'force_dispute'
          ? <>This will force a dispute on job <strong>{pendingModal.job.id.slice(0, 8)}?</strong>. Both parties will be notified and platform escalation will begin.</>
          : <>This will force-cancel job <strong>{pendingModal?.job.id.slice(0, 8)}?</strong>.</>}
        confirmLabel={pendingModal?.action === 'force_dispute' ? 'Confirm force dispute' : 'Confirm force cancel'}
        danger
        reasonRequired
        reasonPlaceholder="Describe the reason for this platform intervention?"
        submitting={acting !== null}
        onCancel={() => setPendingModal(null)}
        onConfirm={(reason) => {
          if (!pendingModal) return;
          const { job, action } = pendingModal;
          setPendingModal(null);
          void handleAction(job, action, reason);
        }}
      />

      <SuperAdminPage>
        <SuperAdminPageHeader
          eyebrow="Marketplace ? Platform Control"
          title="Live Marketplace"
          description="Cross-company marketplace governance with canonical job totals, current exchange visibility and audited owner interventions."
          icon={<Store size={20} aria-hidden="true" />}
          meta={<span>Page {page} ? {total.toLocaleString()} total ? Last update {fetchedAt ? formatDateTime(fetchedAt) : '?'} ? Auto-refresh {Math.round(pollingMs / 1000)}s</span>}
          actions={<button type="button" onClick={() => void fetchMarketplace()} disabled={loading}><RefreshCw size={15} aria-hidden="true" />{loading ? 'Refreshing?' : 'Refresh'}</button>}
        />

        {message ? <SuperAdminNotice tone="info">{message}</SuperAdminNotice> : null}
        {error ? <SuperAdminUnavailableState title="Marketplace unavailable" description={error} /> : null}

        {!error ? (
          <>
            <SuperAdminMetricGrid>
              {(loading
                ? Array.from({ length: 8 }, (_, index) => ({ label: `Loading ${index + 1}`, value: '?' as const }))
                : quickStats
              ).map((item) => (
                <SuperAdminMetricCard key={item.label} label={item.label} value={item.value} tone={loading ? 'neutral' : metricTone(item.label)} />
              ))}
            </SuperAdminMetricGrid>

            <SuperAdminSectionCard
              title="Marketplace jobs"
              description="Canonical cross-company exchange ledger. Owner interventions remain explicit and audited."
              actions={<SuperAdminStatusBadge label={`${total.toLocaleString()} total`} tone="info" />}
              flush
            >
              {loading ? (
                <div style={{ padding: 18 }}>Loading verified marketplace jobs?</div>
              ) : jobs.length === 0 ? (
                <SuperAdminEmptyState title="No marketplace jobs found" />
              ) : (
                <SuperAdminDataGrid columns={columns} rows={jobs} rowKey={(row) => row.id} minWidth={1180} />
              )}
              {!loading && (page > 1 || hasNextPage) ? (
                <SuperAdminPager
                  page={page}
                  totalCount={total}
                  canPrev={page > 1}
                  canNext={hasNextPage}
                  onPrev={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => current + 1)}
                />
              ) : null}
            </SuperAdminSectionCard>

            <SuperAdminSectionCard
              title="Marketplace governance audit"
              description="Recent evidence for Platform Owner interventions. Audit unavailability is never represented as an empty healthy history."
              flush
            >
              {!governanceHistoryAvailable ? (
                <SuperAdminUnavailableState title="Governance audit unavailable" description={governanceHistoryError ?? 'Audit source unavailable.'} />
              ) : auditRows.length === 0 ? (
                <SuperAdminEmptyState title="No marketplace governance events recorded" />
              ) : (
                <SuperAdminDataGrid columns={auditColumns} rows={auditRows.slice(0, 20)} rowKey={(row) => row.id} minWidth={820} />
              )}
            </SuperAdminSectionCard>
          </>
        ) : null}
      </SuperAdminPage>
    </ProtectedRoute>
  );
}
