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
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  grey: '#8A9099',
  white: '#FFFFFF',
} as const;

const ENTERPRISE_SHADOW = '0px 2px 6px rgba(0,0,0,0.08)';

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
  return <div style={{ minHeight: '100vh', background: X.white, color: X.grey, padding: '24px', fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px', padding: '24px', borderRadius: '8px', background: X.white, boxShadow: ENTERPRISE_SHADOW }}>
      <span aria-hidden="true" style={{ width: '24px', height: '24px', display: 'grid', placeItems: 'center', borderRadius: '8px', background: X.blue, color: X.white, boxShadow: ENTERPRISE_SHADOW, fontFamily: 'Inter, Arial, sans-serif', fontSize: '16px', fontWeight: 500 }}>{icon}</span>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, color: X.blue, fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', lineHeight: 1.2, fontWeight: 700 }}>{title}</h1>
          <span style={{ padding: '4px 10px', borderRadius: '8px', background: X.white, color: X.grey, boxShadow: ENTERPRISE_SHADOW, fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px', fontWeight: 400, textTransform: 'uppercase' }}>{sectionLabel}</span>
        </div>
        <p style={{ margin: '24px 0 0', color: X.grey, fontSize: '14px' }}>{description}</p>
      </div>
    </header>

    {error && <div role="alert" style={{ marginBottom: '24px', border: `1px solid ${X.red}`, borderLeft: `4px solid ${X.red}`, borderRadius: '8px', background: X.white, padding: '24px', boxShadow: ENTERPRISE_SHADOW }}>
      <div style={{ color: X.red, fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Service temporarily unavailable</div>
      <div style={{ color: X.grey, fontSize: '14px', marginTop: '24px' }}>{error}</div>
    </div>}

    {!loading && !error && notices.map((notice, index) => <div key={`${notice.kind}-${index}`} style={{ marginBottom: '24px', border: `1px solid ${notice.kind === 'diagnostic' ? X.yellow : X.blue}`, borderLeft: `4px solid ${notice.kind === 'diagnostic' ? X.yellow : X.blue}`, borderRadius: '8px', background: X.white, padding: '24px', color: X.grey, fontSize: '14px', boxShadow: ENTERPRISE_SHADOW }}>{notice.message}</div>)}

    {summary && !loading && !error && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '24px', marginBottom: '24px' }}>
      {Object.entries(summary).slice(0, 6).map(([key, value]) => <div key={key} style={{ minHeight: '108px', background: X.white, border: `1px solid ${X.grey}`, borderRadius: '8px', padding: '24px', boxShadow: ENTERPRISE_SHADOW }}>
        <div style={{ color: X.blue, fontFamily: 'Inter, Arial, sans-serif', fontSize: '20px', lineHeight: 1.05, fontWeight: 700 }}>{formatSummaryValue(key, value)}</div>
        <div style={{ marginTop: '24px', color: X.grey, fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px', fontWeight: 400 }}>{key.replace(/_/g, ' ')}</div>
      </div>)}
    </div>}

    {!error && <section style={{ border: `1px solid ${X.grey}`, borderRadius: '8px', background: X.white, overflow: 'hidden', boxShadow: ENTERPRISE_SHADOW }}>
      {loading ? <div style={{ padding: '24px', textAlign: 'center', color: X.grey, fontSize: '14px' }}>Loading…</div> : rows.length === 0 ? <div style={{ padding: '24px', textAlign: 'center', color: X.grey, fontSize: '14px' }}>{emptyMessage}</div> : <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', fontSize: '14px', background: X.white, boxShadow: ENTERPRISE_SHADOW }}>
          <thead><tr style={{ background: X.white, borderBottom: `1px solid ${X.grey}` }}>
            {stableColumns.map(column => <th key={column.key} style={{ padding: '24px', textAlign: 'left', color: X.blue, fontFamily: 'Inter, Arial, sans-serif', fontSize: '14px', fontWeight: 400 }}>{column.label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={String((row as { id?: string }).id ?? rowIndex)} style={{ borderBottom: `1px solid ${X.grey}` }}>
            {stableColumns.map(column => <td key={column.key} style={{ padding: '24px', color: X.grey, fontSize: '14px', lineHeight: 1.45, verticalAlign: 'top' }}>{column.render(row)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}

      {!loading && (page > 1 || hasNextPage) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '24px', borderTop: `1px solid ${X.grey}`, background: X.white }}>
        <span style={{ color: X.grey, fontSize: '14px' }}>Page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}</span>
        <div style={{ display: 'flex', gap: '24px' }}>
          <button data-pager-button="true" onClick={onPrevPage} disabled={page <= 1} style={pagerButton(page <= 1)}>← Prev</button>
          <button data-pager-button="true" onClick={onNextPage} disabled={!hasNextPage} style={pagerButton(!hasNextPage)}>Next →</button>
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

const pagerButton = (disabled: boolean) => ({
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '8px',
  border: `1px solid ${X.grey}`,
  background: X.white,
  color: disabled ? X.grey : X.blue,
  opacity: disabled ? .55 : 1,
  boxShadow: ENTERPRISE_SHADOW,
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
  fontWeight: 500,
  cursor: disabled ? 'not-allowed' : 'pointer',
} as const);

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
    const run = async () => {
      setLoading(true); setError(null); setNotices([]); setSummary(null); setRows([]); setHasNextPage(false); setTotalCount(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) { setError('No active session.'); return; }
        const separator = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${endpoint}${separator}page=${page}&limit=${pageSize}`, { headers: { Authorization: auth } });
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

  return <ProtectedRoute allowedRoles={['owner']}><SuperAdminLiveTableView
    icon={icon} title={title} sectionLabel={sectionLabel} description={description} columns={columns}
    emptyMessage={emptyMessage} loading={loading} error={error} notices={notices} summary={summary} rows={rows}
    page={page} hasNextPage={hasNextPage} totalCount={totalCount}
    onPrevPage={() => setPage(p => Math.max(1, p - 1))} onNextPage={() => setPage(p => p + 1)}
  /></ProtectedRoute>;
}
