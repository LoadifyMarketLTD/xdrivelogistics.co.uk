'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getAuthHeader } from '../_lib/getAuthHeader';

export type TableColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export type LiveTableNotice = { kind: 'note' | 'diagnostic'; message: string };

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

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF',
  charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626',
} as const;

const REQUEST_TIMEOUT_MS = 15_000;

export function readLiveTableNotices(body: Record<string, unknown>, noteField?: string, diagnosticField?: string): LiveTableNotice[] {
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

type SuperAdminLiveTableViewProps<T extends Record<string, unknown>> = {
  icon: string; title: string; sectionLabel: string; description: string; columns: TableColumn<T>[];
  emptyMessage: string; loading: boolean; error: string | null; notices: LiveTableNotice[];
  summary: Record<string, unknown> | null; rows: T[]; page: number; hasNextPage: boolean; totalCount: number | null;
  onPrevPage: () => void; onNextPage: () => void;
};

export function SuperAdminLiveTableView<T extends Record<string, unknown>>({
  icon, title, sectionLabel, description, columns, emptyMessage, loading, error, notices,
  summary, rows, page, hasNextPage, totalCount, onPrevPage, onNextPage,
}: SuperAdminLiveTableViewProps<T>) {
  const stableColumns = useMemo(() => columns, [columns]);
  return <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
    <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <span aria-hidden="true" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '4px', background: X.navy, color: X.white, fontSize: '12px', fontWeight: 800 }}>{icon}</span>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, color: X.navy, fontSize: '20px', lineHeight: 1.2, fontWeight: 800 }}>{title}</h1>
          <span style={{ padding: '3px 6px', borderRadius: '4px', background: '#EEF4FF', color: X.blue, fontSize: '10px', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase' }}>{sectionLabel}</span>
        </div>
        <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>{description}</p>
      </div>
    </header>

    {error && <div role="alert" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px' }}>
      <div style={{ color: X.danger, fontSize: '12px', fontWeight: 800 }}>Service temporarily unavailable</div>
      <div style={{ color: X.muted, fontSize: '11px', marginTop: '2px' }}>{error}</div>
    </div>}

    {!loading && !error && notices.map((notice, index) => <div key={`${notice.kind}-${index}`} style={{ marginBottom: '12px', border: `1px solid ${notice.kind === 'diagnostic' ? '#F0D293' : '#B9CFF4'}`, borderLeft: `4px solid ${notice.kind === 'diagnostic' ? X.orange : X.blue}`, borderRadius: '4px', background: X.white, padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>{notice.message}</div>)}

    {summary && !loading && !error && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '12px', marginBottom: '12px' }}>
      {Object.entries(summary).slice(0, 6).map(([key, value]) => <div key={key} style={{ minHeight: '88px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px' }}>
        <div style={{ color: X.navy, fontSize: '20px', lineHeight: 1.05, fontWeight: 800 }}>{formatSummaryValue(key, value)}</div>
        <div style={{ marginTop: '8px', color: X.charcoal, fontSize: '11px', fontWeight: 700 }}>{key.replace(/_/g, ' ')}</div>
      </div>)}
    </div>}

    {!error && <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      {loading ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>Loading…</div> : rows.length === 0 ? <div style={{ padding: '18px', textAlign: 'center', color: X.muted, fontSize: '12px' }}>{emptyMessage}</div> : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', fontSize: '12px' }}>
          <thead><tr style={{ height: '38px', background: X.light, borderBottom: `1px solid ${X.border}` }}>
            {stableColumns.map(column => <th key={column.key} style={{ padding: '0 12px', textAlign: 'left', color: X.navy, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{column.label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={String((row as { id?: string }).id ?? rowIndex)} style={{ minHeight: '44px', borderBottom: `1px solid ${X.border}` }}>
            {stableColumns.map(column => <td key={column.key} style={{ padding: '9px 12px', color: X.charcoal, verticalAlign: 'top' }}>{column.render(row)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}

      {!loading && (page > 1 || hasNextPage) && <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 12px', borderTop: `1px solid ${X.border}`, background: X.light }}>
        <span style={{ color: X.muted, fontSize: '11px' }}>Page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onPrevPage} disabled={page <= 1} style={pagerButton(page <= 1)}>← Prev</button>
          <button onClick={onNextPage} disabled={!hasNextPage} style={pagerButton(!hasNextPage)}>Next →</button>
        </div>
      </div>}
    </section>}
  </div>;
}

function formatSummaryValue(key: string, value: unknown) {
  if (typeof value !== 'number') return String(value ?? '—');
  const lower = key.toLowerCase();
  if (lower.includes('amount') || lower.includes('revenue') || lower.includes('vat') || lower.includes('net')) return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (lower.includes('rate')) return `${value}%`;
  return value.toLocaleString();
}

const pagerButton = (disabled: boolean) => ({ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${X.border}`, background: disabled ? X.light : X.white, color: disabled ? '#9CA3AF' : X.navy, fontSize: '11px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' } as const);

export default function SuperAdminLiveTablePage<T extends Record<string, unknown>>({
  icon, title, sectionLabel, description, endpoint, rowsField = 'rows', summaryField, noteField,
  diagnosticField, columns, emptyMessage, pageSize = 50, refreshKey = 0,
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const run = async () => {
      setLoading(true); setError(null); setNotices([]); setSummary(null); setRows([]); setHasNextPage(false); setTotalCount(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) { setError('No active session.'); return; }
        const separator = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${endpoint}${separator}page=${page}&limit=${pageSize}`, {
          headers: { Authorization: auth },
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { setError((body as { error?: string }).error ?? 'The requested service is currently unavailable.'); return; }

        const record = body as Record<string, unknown>;
        const fieldValue = record[rowsField];
        if (!Array.isArray(fieldValue)) {
          setError('The requested service returned an invalid data contract.');
          return;
        }
        setRows(fieldValue as T[]);

        const pageInfo = record.pagination as Record<string, unknown> | undefined;
        if (pageInfo !== undefined && (!pageInfo || typeof pageInfo !== 'object')) {
          setError('The requested service returned invalid pagination metadata.');
          return;
        }
        setHasNextPage(Boolean(pageInfo?.hasNextPage ?? false));
        setTotalCount(typeof pageInfo?.total === 'number' ? pageInfo.total : null);

        if (summaryField) {
          const value = record[summaryField];
          if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
            setError('The requested service returned invalid summary metadata.');
            return;
          }
          setSummary(value ? value as Record<string, unknown> : null);
        }
        setNotices(readLiveTableNotices(record, noteField, diagnosticField));
      } catch (cause) {
        setError(cause instanceof DOMException && cause.name === 'AbortError'
          ? 'The requested service timed out.'
          : 'The requested service is currently unavailable.');
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    };

    void run();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [endpoint, rowsField, summaryField, noteField, diagnosticField, page, pageSize, refreshKey]);

  return <ProtectedRoute allowedRoles={['owner']}><SuperAdminLiveTableView
    icon={icon} title={title} sectionLabel={sectionLabel} description={description} columns={columns}
    emptyMessage={emptyMessage} loading={loading} error={error} notices={notices} summary={summary} rows={rows}
    page={page} hasNextPage={hasNextPage} totalCount={totalCount}
    onPrevPage={() => setPage(p => Math.max(1, p - 1))} onNextPage={() => setPage(p => p + 1)}
  /></ProtectedRoute>;
}
