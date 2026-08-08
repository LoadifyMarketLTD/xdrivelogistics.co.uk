'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '../_lib/getAuthHeader';

export type TableColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export type LiveTableNotice = {
  kind: 'note' | 'diagnostic';
  message: string;
};

type SuperAdminLiveTablePageProps<T extends Record<string, unknown>> = {
  icon: string;
  title: string;
  sectionLabel: string;
  description: string;
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

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  surface: '#0b1220',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f5a300',
  red: '#ef4444',
  blue: '#60a5fa',
};

export function readLiveTableNotices(
  body: Record<string, unknown>,
  noteField?: string,
  diagnosticField?: string,
): LiveTableNotice[] {
  const notices: LiveTableNotice[] = [];
  if (noteField) {
    const noteValue = body[noteField];
    if (typeof noteValue === 'string' && noteValue.trim()) notices.push({ kind: 'note', message: noteValue });
  }
  if (diagnosticField) {
    const diagnosticValue = body[diagnosticField];
    if (typeof diagnosticValue === 'string' && diagnosticValue.trim()) notices.push({ kind: 'diagnostic', message: diagnosticValue });
  }
  return notices;
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
  emptyMessage,
  loading,
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
  const stableColumns = useMemo(() => columns, [columns]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: THEME.text, margin: 0 }}>{title}</h1>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#93c5fd', backgroundColor: 'rgba(29,87,216,0.14)', padding: '0.13rem 0.42rem', borderRadius: '4px' }}>{sectionLabel}</span>
          </div>
          <p style={{ color: THEME.muted, margin: '0.2rem 0 0', fontSize: '0.78rem' }}>{description}</p>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem', backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '7px', padding: '0.7rem 0.8rem' }}>
          <span aria-hidden="true" style={{ color: THEME.red }}>!</span>
          <div>
            <div style={{ color: '#fecaca', fontSize: '0.76rem', fontWeight: 800 }}>Service temporarily unavailable</div>
            <div style={{ color: THEME.muted, fontSize: '0.68rem', marginTop: '0.12rem' }}>{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && notices.map((notice, index) => (
        <div key={`${notice.kind}-${index}`} style={{ backgroundColor: notice.kind === 'diagnostic' ? 'rgba(245,163,0,0.06)' : 'rgba(29,87,216,0.07)', border: `1px solid ${notice.kind === 'diagnostic' ? 'rgba(245,163,0,0.28)' : 'rgba(29,87,216,0.28)'}`, borderRadius: '6px', padding: '0.55rem 0.75rem', color: notice.kind === 'diagnostic' ? '#fbbf24' : '#93c5fd', fontSize: '0.72rem', marginBottom: '0.8rem' }}>
          {notice.message}
        </div>
      ))}

      {summary && !loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.8rem' }}>
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} style={{ backgroundColor: THEME.surface, border: `1px solid ${THEME.cardBorder}`, borderRadius: '6px', padding: '0.55rem 0.65rem' }}>
              <div style={{ color: THEME.text, fontSize: '0.95rem', fontWeight: 800 }}>
                {typeof value === 'number'
                  ? key.toLowerCase().includes('amount') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('vat') || key.toLowerCase().includes('net')
                    ? `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : key.toLowerCase().includes('rate') ? `${value}%` : value.toLocaleString()
                  : String(value ?? '—')}
              </div>
              <div style={{ color: THEME.muted, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.1rem' }}>{key.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {!error && (
        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: THEME.muted, fontSize: '0.8rem' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: THEME.muted, fontSize: '0.8rem' }}>{emptyMessage}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.surface }}>
                    {stableColumns.map((column) => (
                      <th key={column.key} style={{ padding: '0.58rem 0.75rem', textAlign: 'left', color: THEME.muted, fontWeight: 700, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={String((row as { id?: string }).id ?? rowIndex)} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                      {stableColumns.map((column) => <td key={column.key} style={{ padding: '0.62rem 0.75rem', color: THEME.text, verticalAlign: 'top' }}>{column.render(row)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (page > 1 || hasNextPage) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.75rem', borderTop: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.surface }}>
              <span style={{ color: THEME.muted, fontSize: '0.68rem' }}>Page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button onClick={onPrevPage} disabled={page <= 1} style={{ padding: '0.26rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', border: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.cardBg, color: page <= 1 ? THEME.muted : THEME.text, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
                <button onClick={onNextPage} disabled={!hasNextPage} style={{ padding: '0.26rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', border: `1px solid ${THEME.cardBorder}`, backgroundColor: THEME.cardBg, color: !hasNextPage ? THEME.muted : THEME.text, cursor: !hasNextPage ? 'not-allowed' : 'pointer' }}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminLiveTablePage<T extends Record<string, unknown>>({
  icon,
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
      setTotalCount(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) {
          setError('No active session.');
          return;
        }

        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${endpoint}${separator}page=${page}&limit=${pageSize}`;
        const res = await fetch(url, { headers: { Authorization: auth } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((body as { error?: string }).error ?? 'The requested service is currently unavailable.');
          return;
        }

        const fieldValue = (body as Record<string, unknown>)[rowsField];
        setRows(Array.isArray(fieldValue) ? (fieldValue as T[]) : []);

        const paginationMeta = (body as Record<string, unknown>).pagination as Record<string, unknown> | undefined;
        setHasNextPage(Boolean(paginationMeta?.hasNextPage ?? false));
        setTotalCount(typeof paginationMeta?.total === 'number' ? paginationMeta.total : null);

        if (summaryField) {
          const summaryValue = (body as Record<string, unknown>)[summaryField];
          setSummary(summaryValue && typeof summaryValue === 'object' ? (summaryValue as Record<string, unknown>) : null);
        }
        setNotices(readLiveTableNotices(body as Record<string, unknown>, noteField, diagnosticField));
      } catch {
        setError('The requested service is currently unavailable.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [endpoint, rowsField, summaryField, noteField, diagnosticField, page, pageSize, refreshKey]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminLiveTableView
        icon={icon}
        title={title}
        sectionLabel={sectionLabel}
        description={description}
        columns={columns}
        emptyMessage={emptyMessage}
        loading={loading}
        error={error}
        notices={notices}
        summary={summary}
        rows={rows}
        page={page}
        hasNextPage={hasNextPage}
        totalCount={totalCount}
        onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setPage((p) => p + 1)}
      />
    </ProtectedRoute>
  );
}
