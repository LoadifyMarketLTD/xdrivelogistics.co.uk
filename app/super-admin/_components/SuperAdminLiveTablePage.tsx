'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ListChecks } from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '../_lib/getAuthHeader';
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
  SuperAdminUnavailableState,
  type SuperAdminDataColumn,
} from './SuperAdminEnterprisePrimitives';

export type TableColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export type LiveTableNotice = { kind: 'note' | 'diagnostic'; message: string };

type SuperAdminLiveTablePageProps<T extends Record<string, unknown>> = {
  icon: string;
  title: string;
  sectionLabel: string;  description: string;
  endpoint: string;
  rowsField?: string;
  summaryField?: string;
  noteField?: string;
  diagnosticField?: string;
  columns: TableColumn<T>[];
  emptyMessage: string;
  pageSize?: number;
  refreshKey?: number;
};

export function readLiveTableNotices(
  body: Record<string, unknown>,
  noteField?: string,
  diagnosticField?: string,
): LiveTableNotice[] {
  const notices: LiveTableNotice[] = [];
  if (noteField) {
    const value = body[noteField];
    if (typeof value === 'string' && value.trim()) notices.push({ kind: 'note', message: value });
  }
  if (diagnosticField) {
    const value = body[diagnosticField];
    if (typeof value === 'string' && value.trim()) notices.push({ kind: 'diagnostic', message: value });
  }
  return notices;
}

function formatSummaryValue(key: string, value: unknown) {
  if (typeof value !== 'number') return String(value ?? '—');  const lower = key.toLowerCase();
  if (lower.includes('amount') || lower.includes('revenue') || lower.includes('vat') || lower.includes('net')) {
    return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (lower.includes('rate')) return `${value}%`;
  return value.toLocaleString();
}

type SuperAdminLiveTableViewProps<T extends Record<string, unknown>> = {
  icon: string;
  title: string;
  sectionLabel: string;
  description: string;
  columns: TableColumn<T>[];
  emptyMessage: string;
  loading: boolean;
  error: string | null;
  notices: LiveTableNotice[];
  summary: Record<string, unknown> | null;
  rows: T[];
  page: number;
  hasNextPage: boolean;
  totalCount: number | null;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function SuperAdminLiveTableView<T extends Record<string, unknown>>({
  icon,
  title,
  sectionLabel,
  description,
  columns,
  emptyMessage,  loading,
  error,
  notices,
  summary,
  rows,
  page,
  hasNextPage,
  totalCount,
  onPrevPage,
  onNextPage,
}: SuperAdminLiveTableViewProps<T>) {
  const stableColumns = useMemo<SuperAdminDataColumn<T>[]>(
    () => columns.map((column) => ({ ...column })),
    [columns],
  );

  return (
    <SuperAdminPage>
      <span hidden data-legacy-page-icon={icon} />
      <SuperAdminPageHeader
        eyebrow={sectionLabel}
        title={title}
        description={description}
        icon={<ListChecks size={20} aria-hidden="true" />}
      />

      {error ? (
        <SuperAdminUnavailableState
          title="Service temporarily unavailable"
          description={error}
        />
      ) : null}

      {!loading && !error ? notices.map((notice, index) => (
        <SuperAdminNotice key={`${notice.kind}-${index}`} tone={notice.kind === 'diagnostic' ? 'warning' : 'info'}>
          {notice.message}
        </SuperAdminNotice>
      )) : null}
      {summary && !loading && !error ? (
        <SuperAdminMetricGrid>
          {Object.entries(summary).slice(0, 6).map(([key, value]) => (
            <SuperAdminMetricCard
              key={key}
              label={key.replace(/_/g, ' ')}
              value={formatSummaryValue(key, value)}
              tone="info"
            />
          ))}
        </SuperAdminMetricGrid>
      ) : null}

      {!error ? (
        <SuperAdminSectionCard flush>
          {loading ? (
            <SuperAdminEmptyState title="Loading verified data…" />
          ) : rows.length === 0 ? (
            <SuperAdminEmptyState title={emptyMessage} />
          ) : (
            <SuperAdminDataGrid
              columns={stableColumns}
              rows={rows}
              rowKey={(row, rowIndex) => String((row as { id?: string }).id ?? rowIndex)}
            />
          )}

          {!loading && (page > 1 || hasNextPage) ? (
            <SuperAdminPager
              page={page}
              totalCount={totalCount}
              canPrev={page > 1}
              canNext={hasNextPage}
              onPrev={onPrevPage}
              onNext={onNextPage}
            />
          ) : null}
        </SuperAdminSectionCard>
      ) : null}
    </SuperAdminPage>
  );
}
export default function SuperAdminLiveTablePage<T extends Record<string, unknown>>({
  icon: _icon,
  title,
  sectionLabel,
  description,
  endpoint,
  rowsField = 'rows',
  summaryField,
  noteField,
  diagnosticField,
  columns,
  emptyMessage,
  pageSize = 50,
  refreshKey = 0,
}: SuperAdminLiveTablePageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [notices, setNotices] = useState<LiveTableNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      setNotices([]);
      setSummary(null);
      setRows([]);
      setHasNextPage(false);
      setTotalCount(null);      try {
        const auth = await getAuthHeader();
        if (!auth) { setError('No active session.'); return; }
        const separator = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${endpoint}${separator}page=${page}&limit=${pageSize}`, {
          headers: { Authorization: auth },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { setError((body as { error?: string }).error ?? 'The requested service is currently unavailable.'); return; }
        const fieldValue = (body as Record<string, unknown>)[rowsField];
        setRows(Array.isArray(fieldValue) ? fieldValue as T[] : []);
        const pagination = (body as Record<string, unknown>).pagination as Record<string, unknown> | undefined;
        setHasNextPage(Boolean(pagination?.hasNextPage ?? false));
        setTotalCount(typeof pagination?.total === 'number' ? pagination.total : null);
        if (summaryField) {
          const value = (body as Record<string, unknown>)[summaryField];
          setSummary(value && typeof value === 'object' ? value as Record<string, unknown> : null);
        }
        setNotices(readLiveTableNotices(body as Record<string, unknown>, noteField, diagnosticField));
      } catch { setError('The requested service is currently unavailable.'); } finally {
        setLoading(false);
      }
    };
    void run();
  }, [endpoint, rowsField, summaryField, noteField, diagnosticField, page, pageSize, refreshKey]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminLiveTableView
        icon={_icon}
        title={title}
        sectionLabel={sectionLabel}
        description={description}
        columns={columns}
        emptyMessage={emptyMessage}
        loading={loading}        error={error}
        notices={notices}
        summary={summary}
        rows={rows}
        page={page}
        hasNextPage={hasNextPage}
        totalCount={totalCount}
        onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
        onNextPage={() => setPage((current) => current + 1)}
      />
    </ProtectedRoute>
  );
}
