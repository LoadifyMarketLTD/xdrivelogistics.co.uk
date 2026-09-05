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
  blue: '#1A73E8',
  navy: '#1A73E8',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  white: '#FFFFFF',
  charcoal: '#4A4A4A',
  light: '#F5F7FA',
  border: '#E0E3E7',
  muted: '#4A4A4A',
  danger: '#EA4335',
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
  return <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '20px', fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: '14px' }}>
    <header style={{ minHeight: '64px', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
      <span aria-hidden="true" style={{ width: '44px', height: '44px', display: 'grid', placeItems: 'center', borderRadius: '10px', background: X.blue, color: X.white, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '18px', fontWeight: 800 }}>{icon}</span>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '28px', lineHeight: 1.16, fontWeight: 800 }}>{title}</h1>
          <span style={{ padding: '5px 9px', borderRadius: '999px', background: X.light, color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase' }}>{sectionLabel}</span>
        </div>
        <p style={{ margin: '5px 0 0', color: X.muted, fontSize: '14px', opacity: .78 }}>{description}</p>
      </div>
    </header>

    {error && <div role="alert" style={{ marginBottom: '18px', border: `1px solid ${X.red}`, borderLeft: `4px solid ${X.red}`, borderRadius: '12px', background: X.white, padding: '14px 16px' }}>
      <div style={{ color: X.red, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 800 }}>Service temporarily unavailable</div>
      <div style={{ color: X.muted, fontSize: '14px', marginTop: '4px' }}>{error}</div>
    </div>}

    {!loading && !error && notices.map((notice, index) => <div key={`${notice.kind}-${index}`} style={{ marginBottom: '18px', border: `1px solid ${notice.kind === 'diagnostic' ? X.yellow : X.blue}`, borderLeft: `4px solid ${notice.kind === 'diagnostic' ? X.yellow : X.blue}`, borderRadius: '12px', background: X.white, padding: '14px 16px', color: X.charcoal, fontSize: '14px', boxShadow: '0 3px 12px rgba(31,41,55,.055)' }}>{notice.message}</div>)}

    {summary && !loading && !error && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px', marginBottom: '18px' }}>
      {Object.entries(summary).slice(0, 6).map(([key, value]) => <div key={key} style={{ minHeight: '108px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '12px', padding: '20px', boxShadow: '0 3px 12px rgba(31,41,55,.055)' }}>
        <div style={{ color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '26px', lineHeight: 1.05, fontWeight: 800 }}>{formatSummaryValue(key, value)}</div>
        <div style={{ marginTop: '10px', color: X.charcoal, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700 }}>{key.replace(/_/g, ' ')}</div>
      </div>)}
    </div>}

    {!error && <section style={{ border: `1px solid ${X.border}`, borderRadius: '12px', background: X.white, overflow: 'hidden', boxShadow: '0 3px 12px rgba(31,41,55,.055)' }}>
      {loading ? <div style={{ padding: '24px', textAlign: 'center', color: X.muted, fontSize: '14px' }}>Loading…</div> : rows.length === 0 ? <div style={{ padding: '24px', textAlign: 'center', color: X.muted, fontSize: '14px' }}>{emptyMessage}</div> : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', fontSize: '14px' }}>
          <thead><tr style={{ minHeight: '42px', background: X.light, borderBottom: `1px solid ${X.border}` }}>
            {stableColumns.map(column => <th key={column.key} style={{ padding: '11px 14px', textAlign: 'left', color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '13px', fontWeight: 750 }}>{column.label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={String((row as { id?: string }).id ?? rowIndex)} style={{ minHeight: '48px', borderBottom: `1px solid ${X.border}` }}>
            {stableColumns.map(column => <td key={column.key} style={{ padding: '12px 14px', color: X.charcoal, fontSize: '14px', lineHeight: 1.45, verticalAlign: 'top' }}>{column.render(row)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}

      {!loading && (page > 1 || hasNextPage) && <div style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '6px 14px', borderTop: `1px solid ${X.border}`, background: X.light }}>
        <span style={{ color: X.muted, fontSize: '14px' }}>Page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
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

const pagerButton = (disabled: boolean) => ({ minHeight: '40px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${X.border}`, background: disabled ? X.light : X.white, color: disabled ? X.charcoal : X.blue, opacity: disabled ? .55 : 1, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' } as const);

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
