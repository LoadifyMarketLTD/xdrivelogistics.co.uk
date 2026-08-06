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
  /** Page size for server-side pagination. Default: 50. */
  pageSize?: number;
  /** External refresh trigger for pages that need to refetch after local actions. */
  refreshKey?: number;
};

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  red: '#ef4444',
};

export function readLiveTableNotices(
  body: Record<string, unknown>,
  noteField?: string,
  diagnosticField?: string,
): LiveTableNotice[] {
  const notices: LiveTableNotice[] = [];
  if (noteField) {
    const noteValue = body[noteField];
    if (typeof noteValue === 'string' && noteValue.trim()) {
      notices.push({ kind: 'note', message: noteValue });
    }
  }
  if (diagnosticField) {
    const diagnosticValue = body[diagnosticField];
    if (typeof diagnosticValue === 'string' && diagnosticValue.trim()) {
      notices.push({ kind: 'diagnostic', message: diagnosticValue });
    }
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
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>{title}</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              {sectionLabel}
            </span>
          </div>
          <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{description}</p>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && notices.map((notice, index) => (
        <div
          key={`${notice.kind}-${index}`}
          style={{
            backgroundColor: notice.kind === 'diagnostic' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
            border: `1px solid ${notice.kind === 'diagnostic' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.28)'}`,
            borderRadius: '8px',
            padding: '0.65rem 0.9rem',
            color: notice.kind === 'diagnostic' ? THEME.accent : '#93c5fd',
            fontSize: '0.8rem',
            marginBottom: '1rem',
          }}
        >
          {notice.kind === 'diagnostic' ? 'ℹ️ Diagnostic:' : 'ℹ️ Note:'} {notice.message}
        </div>
      ))}

      {summary && !loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
              <div style={{ color: THEME.text, fontSize: '1rem', fontWeight: 700 }}>
                {typeof value === 'number'
                  ? key.toLowerCase().includes('amount') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('vat') || key.toLowerCase().includes('net')
                    ? `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : key.toLowerCase().includes('rate')
                      ? `${value}%`
                      : value.toLocaleString()
                  : String(value ?? '—')}
              </div>
              <div style={{ color: THEME.muted, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>
                {key.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.red, fontSize: '0.88rem' }}>Source unavailable.</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>{emptyMessage}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  {stableColumns.map((column) => (
                    <th
                      key={column.key}
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
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={String((row as { id?: string }).id ?? rowIndex)} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    {stableColumns.map((column) => (
                      <td key={column.key} style={{ padding: '0.75rem 0.9rem', color: THEME.text, verticalAlign: 'top' }}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && (page > 1 || hasNextPage) && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '0.5rem', padding: '0.65rem 0.9rem',
              borderTop: `1px solid ${THEME.cardBorder}`,
              backgroundColor: '#0b1220',
            }}
          >
            <span style={{ color: THEME.muted, fontSize: '0.72rem' }}>
              Page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={onPrevPage}
                disabled={page <= 1}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.76rem',
                  border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#1e293b',
                  color: page <= 1 ? THEME.muted : THEME.text,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Prev
              </button>
              <button
                onClick={onNextPage}
                disabled={!hasNextPage}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.76rem',
                  border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#1e293b',
                  color: !hasNextPage ? THEME.muted : THEME.text,
                  cursor: !hasNextPage ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
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
          setLoading(false);
          return;
        }

        // Append page/limit params — APIs that do not support them will ignore them gracefully.
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${endpoint}${separator}page=${page}&limit=${pageSize}`;
        const res = await fetch(url, { headers: { Authorization: auth } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
          setLoading(false);
          return;
        }

        const fieldValue = (body as Record<string, unknown>)[rowsField];
        setRows(Array.isArray(fieldValue) ? (fieldValue as T[]) : []);

        // Pagination metadata from API (present when server-side pagination is supported)
        const paginationMeta = (body as Record<string, unknown>).pagination as Record<string, unknown> | undefined;
        setHasNextPage(Boolean(paginationMeta?.hasNextPage ?? false));
        setTotalCount(typeof paginationMeta?.total === 'number' ? paginationMeta.total : null);

        if (summaryField) {
          const summaryValue = (body as Record<string, unknown>)[summaryField];
          setSummary(summaryValue && typeof summaryValue === 'object' ? (summaryValue as Record<string, unknown>) : null);
        }
        setNotices(readLiveTableNotices(body as Record<string, unknown>, noteField, diagnosticField));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fetch failed.');
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
