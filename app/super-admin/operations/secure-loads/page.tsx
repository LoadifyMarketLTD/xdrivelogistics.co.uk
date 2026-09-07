'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import {
  SuperAdminDataGrid,
  SuperAdminEmptyState,
  SuperAdminFilterBar,
  SuperAdminMetricCard,
  SuperAdminMetricGrid,
  SuperAdminNotice,
  SuperAdminPage,
  SuperAdminPageHeader,
  SuperAdminPager,
  SuperAdminSectionCard,
  SuperAdminStatusBadge,
  SuperAdminUnavailableState,
  type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type SecureState = 'clear' | 'review' | 'blocked' | 'awaiting_assignment';
type CredentialState = 'verified' | 'blocked' | 'unavailable' | 'not_assigned';

type Row = {
  id: string;
  reference: string;
  status: string;
  state: SecureState;
  credentialState: CredentialState;
  posting_company_name: string;
  awarded_company_name: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  flags: string[];
  blockers: string[];
  reviewSignals: string[];
  requestedDocuments: number;
  uploadedJobDocuments: number;
  trackingEvidencePresent: boolean;
  tracking_recorded_at: string | null;
  podRequired: boolean;
  podEvidencePresent: boolean;
  cargoValueGbp: number | null;
  canonicalVehicleId: string | null;
  created_at: string;
};

type Payload = {
  refreshedAt?: string;
  rows?: Row[];
  summary?: {
    total_records?: number;
    page_records?: number;
    blocked_on_page?: number;
    review_on_page?: number;
    awaiting_assignment_on_page?: number;
    clear_on_page?: number;
  };
  note?: string;
  pagination?: { page?: number; total?: number; hasNextPage?: boolean; hasPrevPage?: boolean };
  error?: string;
};

const STATE_SET = new Set(['clear', 'review', 'blocked', 'awaiting_assignment']);
const CREDENTIAL_SET = new Set(['verified', 'blocked', 'unavailable', 'not_assigned']);

function SecureLoadsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<NonNullable<Payload['summary']>>({});
  const [note, setNote] = useState('');
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | SecureState>('all');

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) throw new Error('No active Platform Owner session.');
        const response = await fetch(`/api/super-admin/secure-loads?page=${page}&limit=25`, {
          headers: { Authorization: auth },
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({})) as Payload;
        if (!response.ok) throw new Error(body.error ?? 'Secure Load intelligence is unavailable.');
        if (!active) return;
        setRows(Array.isArray(body.rows) ? body.rows : []);
        setSummary(body.summary ?? {});
        setNote(body.note ?? '');
        setRefreshedAt(body.refreshedAt ?? null);
        setHasNext(Boolean(body.pagination?.hasNextPage));
        setTotal(typeof body.pagination?.total === 'number' ? body.pagination.total : null);
      } catch (cause) {
        if (active) {
          setRows([]);
          setSummary({});
          setError(cause instanceof Error ? cause.message : 'Secure Load intelligence is unavailable.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [page]);

  const visibleRows = useMemo(
    () => filter === 'all' ? rows : rows.filter((row) => row.state === filter),
    [filter, rows],
  );

  const columns = useMemo<SuperAdminDataColumn<Row>[]>(() => [
    {
      key: 'load',
      label: 'Load / route',
      render: (row) => <div><strong>{row.reference}</strong><div>{routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode)}</div></div>,
    },
    { key: 'state', label: 'Secure state', render: (row) => <StatusChip value={row.state} allowedValues={STATE_SET} /> },
    {
      key: 'credentials',
      label: 'Credentials',
      render: (row) => <div><StatusChip value={row.credentialState} allowedValues={CREDENTIAL_SET} />{row.blockers.length ? <div>{row.blockers.length} blocker{row.blockers.length === 1 ? '' : 's'}</div> : null}</div>,
    },
    { key: 'signals', label: 'Load signals', render: (row) => row.flags.length ? row.flags.join(' · ') : 'No elevated load flags' },
    {
      key: 'evidence',
      label: 'Evidence',
      render: (row) => <div>Tracking: {row.trackingEvidencePresent ? 'present' : 'not present'}{row.tracking_recorded_at ? ` · ${formatDateTime(row.tracking_recorded_at)}` : ''}<br />POD: {row.podEvidencePresent ? 'present' : row.podRequired ? 'required / missing' : 'not required'}<br />Docs: {row.uploadedJobDocuments} uploaded · {row.requestedDocuments} requested</div>,
    },
    { key: 'companies', label: 'Companies', render: (row) => <div>{row.posting_company_name}<br />{row.awarded_company_name ? `→ ${row.awarded_company_name}` : 'Not awarded'}</div> },
    { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
    { key: 'inspect', label: '', render: (row) => <PlatformEntityLink entityType="job" entityId={row.id} compact>Inspect</PlatformEntityLink> },
  ], []);

  return (
    <SuperAdminPage>
      <SuperAdminPageHeader
        eyebrow="Secure Operations"
        title="Secure Loads"
        description="Cross-company, read-only supervision of load risk signals, execution credentials, tracking, documents and POD evidence."
        icon={<ShieldCheck size={20} aria-hidden="true" />}
        meta={refreshedAt ? `Verified refresh: ${formatDateTime(refreshedAt)}` : undefined}
        actions={<SuperAdminStatusBadge label="Read only · Fail closed" tone="success" />}
      />

      {error ? <SuperAdminUnavailableState title="Secure Load intelligence unavailable" description={error} /> : null}
      {!error && note ? <SuperAdminNotice tone="info">{note}</SuperAdminNotice> : null}

      {!error ? (
        <SuperAdminMetricGrid>
          <SuperAdminMetricCard label="Blocked · current page" value={loading ? '—' : summary.blocked_on_page ?? '—'} tone="danger" />
          <SuperAdminMetricCard label="Review · current page" value={loading ? '—' : summary.review_on_page ?? '—'} tone="warning" />
          <SuperAdminMetricCard label="Awaiting assignment · current page" value={loading ? '—' : summary.awaiting_assignment_on_page ?? '—'} tone="neutral" />
          <SuperAdminMetricCard label="Clear · current page" value={loading ? '—' : summary.clear_on_page ?? '—'} tone="success" />
        </SuperAdminMetricGrid>
      ) : null}

      {!error ? (
        <SuperAdminSectionCard
          title="Secure load ledger"
          description={total === null ? 'Exact platform total unavailable.' : `${total.toLocaleString()} platform jobs · attention counts are page-local.`}
          flush
        >
          <div style={{ padding: 12 }}>
            <SuperAdminFilterBar>
              {(['all', 'blocked', 'review', 'awaiting_assignment', 'clear'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}>
                  {value.replaceAll('_', ' ')}
                </button>
              ))}
            </SuperAdminFilterBar>
          </div>

          {loading ? <SuperAdminEmptyState title="Loading verified platform evidence…" />
            : visibleRows.length === 0 ? <SuperAdminEmptyState title="No loads match this page view." description="An empty filtered view is not treated as platform-wide zero." />
              : <SuperAdminDataGrid columns={columns} rows={visibleRows} rowKey={(row) => row.id} minWidth={1180} />}

          {!loading && (page > 1 || hasNext) ? (
            <SuperAdminPager
              page={page}
              totalCount={total}
              canPrev={page > 1}
              canNext={hasNext}
              onPrev={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => value + 1)}
            />
          ) : null}
        </SuperAdminSectionCard>
      ) : null}
    </SuperAdminPage>
  );
}

export default function Page() {
  return <ProtectedRoute allowedRoles={['owner']}><SecureLoadsView /></ProtectedRoute>;
}
