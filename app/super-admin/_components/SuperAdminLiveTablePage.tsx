'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { PlatformEntityLink, type PlatformEntityType } from './control-plane';
import { getAuthHeader } from '../_lib/getAuthHeader';

export type TableColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export type LiveTableNotice = { kind: 'note' | 'diagnostic'; message: string };
export type LiveTableEntityLink<T extends Record<string, unknown>> = (row: T) => {
  entityType: PlatformEntityType;
  entityId: string;
  label?: string;
} | null;

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
  entityLink?: LiveTableEntityLink<T>;
};

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
  onPrevPage: () => void; onNextPage: () => void; entityLink?: LiveTableEntityLink<T>;
};

export function SuperAdminLiveTableView<T extends Record<string, unknown>>({
  icon, title, sectionLabel, description, columns, emptyMessage, loading, error, notices,
  summary, rows, page, hasNextPage, totalCount, onPrevPage, onNextPage, entityLink,
}: SuperAdminLiveTableViewProps<T>) {
  const stableColumns = useMemo(() => columns, [columns]);

  return <div className="sa-page">
    <header className="sa-page-header">
      <div className="sa-heading-row">
        <span aria-hidden="true" className="sa-page-icon">{icon}</span>
        <div className="sa-page-heading">
          <div className="sa-eyebrow">Platform control plane <span className="sa-section-pill">{sectionLabel}</span></div>
          <h1 className="sa-page-title">{title}</h1>
          <p className="sa-page-description">{description}</p>
        </div>
      </div>
    </header>

    {error && <div role="alert" className="sa-notice" data-tone="danger">
      <strong>Service temporarily unavailable</strong>
      <div style={{ marginTop: 3, color: '#667085' }}>{error}</div>
    </div>}

    {!loading && !error && notices.map((notice, index) => (
      <div key={`${notice.kind}-${index}`} className="sa-notice" data-tone={notice.kind === 'diagnostic' ? 'warning' : 'info'}>{notice.message}</div>
    ))}

    {summary && !loading && !error && <div className="sa-metric-grid">
      {Object.entries(summary).slice(0, 6).map(([key, summaryValue]) => <div key={key} className="sa-metric-card">
        <div className="sa-metric-value">{formatSummaryValue(key, summaryValue)}</div>
        <div className="sa-metric-label">{key.replace(/_/g, ' ')}</div>
      </div>)}
    </div>}

    {!error && <section className="sa-panel">
      <div className="sa-panel-header">
        <div>
          <h2 className="sa-panel-title">Live records</h2>
          <p className="sa-panel-subtitle">Canonical platform data · page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}</p>
        </div>
        {!loading && rows.length > 0 ? <span className="sa-section-pill">{rows.length} shown</span> : null}
      </div>

      {loading ? <div className="sa-loading">Loading live platform data…</div> : rows.length === 0 ? <div className="sa-empty">{emptyMessage}</div> : <div className="sa-table-scroll">
        <table className="sa-data-table">
          <thead><tr>
            {stableColumns.map(column => <th key={column.key}>{column.label}</th>)}
            {entityLink ? <th style={{ textAlign: 'right' }}>Inspect</th> : null}
          </tr></thead>
          <tbody>{rows.map((row, rowIndex) => {
            const target = entityLink?.(row) ?? null;
            return <tr key={String((row as { id?: string }).id ?? rowIndex)}>
              {stableColumns.map(column => <td key={column.key}>{column.render(row)}</td>)}
              {entityLink ? <td style={{ textAlign: 'right' }}>{target ? <PlatformEntityLink entityType={target.entityType} entityId={target.entityId} compact>{target.label ?? 'Inspect'}</PlatformEntityLink> : <span style={{ color: '#8b97a8', fontSize: 10 }}>Unavailable</span>}</td> : null}
            </tr>;
          })}</tbody>
        </table>
      </div>}

      {!loading && (page > 1 || hasNextPage) && <div className="sa-pager">
        <span className="sa-pager-copy">Page {page}{totalCount !== null ? ` of ${Math.max(1, Math.ceil(totalCount / Math.max(rows.length, 1)))}` : ''}</span>
        <div className="sa-pager-actions">
          <button className="sa-pager-button" onClick={onPrevPage} disabled={page <= 1}>← Previous</button>
          <button className="sa-pager-button" onClick={onNextPage} disabled={!hasNextPage}>Next →</button>
        </div>
      </div>}
    </section>}
  </div>;
}

function formatSummaryValue(key: string, summaryValue: unknown) {
  if (typeof summaryValue !== 'number') return String(summaryValue ?? '—');
  const lower = key.toLowerCase();
  if (lower.includes('amount') || lower.includes('revenue') || lower.includes('vat') || lower.includes('net')) return `£${summaryValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (lower.includes('rate')) return `${summaryValue}%`;
  return summaryValue.toLocaleString();
}

export default function SuperAdminLiveTablePage<T extends Record<string, unknown>>({
  icon, title, sectionLabel, description, endpoint, rowsField = 'rows', summaryField, noteField,
  diagnosticField, columns, emptyMessage, pageSize = 50, refreshKey = 0, entityLink,
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
          const summaryValue = (body as Record<string, unknown>)[summaryField];
          setSummary(summaryValue && typeof summaryValue === 'object' ? summaryValue as Record<string, unknown> : null);
        }
        setNotices(readLiveTableNotices(body as Record<string, unknown>, noteField, diagnosticField));
      } catch { setError('The requested service is currently unavailable.'); }
      finally { setLoading(false); }
    };
    void run();
  }, [endpoint, rowsField, summaryField, noteField, diagnosticField, page, pageSize, refreshKey]);

  return <ProtectedRoute allowedRoles={['owner']}><SuperAdminLiveTableView
    icon={icon} title={title} sectionLabel={sectionLabel} description={description} columns={columns}
    emptyMessage={emptyMessage} loading={loading} error={error} notices={notices} summary={summary} rows={rows}
    page={page} hasNextPage={hasNextPage} totalCount={totalCount} entityLink={entityLink}
    onPrevPage={() => setPage(p => Math.max(1, p - 1))} onNextPage={() => setPage(p => p + 1)}
  /></ProtectedRoute>;
}
