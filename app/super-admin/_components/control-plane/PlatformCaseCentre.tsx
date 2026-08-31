'use client';

import type { PlatformCaseSeverity, PlatformCaseStatus, PlatformCaseSummary } from './types';
import PlatformEntityLink from './PlatformEntityLink';

const severityColor: Record<PlatformCaseSeverity, string> = { P0: '#d92d20', P1: '#b26a00', P2: '#1d57d8', P3: '#667085' };
const statusColor: Record<PlatformCaseStatus, string> = { open: '#d92d20', acknowledged: '#b26a00', investigating: '#1d57d8', waiting: '#b26a00', resolved: '#168553', closed: '#667085' };

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
};

export default function PlatformCaseCentre({
  cases,
  loading = false,
  error = null,
  onOpenCase,
}: {
  cases: PlatformCaseSummary[];
  loading?: boolean;
  error?: string | null;
  onOpenCase?: (caseId: string) => void;
}) {
  return (
    <section className="sa-panel">
      <div className="sa-panel-header">
        <div><h2 className="sa-panel-title">Platform Case Centre</h2><p className="sa-panel-subtitle">Persistent human-owned exceptions. Derived alerts never replace case ownership.</p></div>
        <span className="sa-section-pill">{loading ? 'Loading' : `${cases.length} visible`}</span>
      </div>
      {error ? <div role="alert" className="sa-notice" data-tone="danger" style={{ margin: 12 }}>{error}</div> : null}
      {loading ? <div className="sa-loading">Loading cases…</div> : cases.length === 0 ? <div className="sa-empty">No persistent cases match the current filter.</div> : (
        <div className="sa-table-scroll">
          <table className="sa-data-table">
            <thead><tr>{['Severity', 'Case', 'Entity', 'Status', 'Owner', 'Updated', ''].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
            <tbody>{cases.map((item) => <tr key={item.id}>
              <td><strong style={{ color: severityColor[item.severity] }}>{item.severity}</strong></td>
              <td><div style={{ color: '#082a61', fontSize: 11, fontWeight: 820 }}>{item.reference} · {item.title}</div>{item.description ? <div style={{ color: '#667085', fontSize: 9, marginTop: 3, maxWidth: 360 }}>{item.description}</div> : null}</td>
              <td><PlatformEntityLink compact entityType={item.entityType} entityId={item.entityId}>{item.entityLabel}</PlatformEntityLink></td>
              <td><span style={{ color: statusColor[item.status], fontSize: 10, fontWeight: 820, textTransform: 'capitalize' }}>{item.status.replace(/_/g, ' ')}</span></td>
              <td>{item.assignedToLabel ?? 'Unassigned'}</td>
              <td>{when(item.updatedAt)}</td>
              <td>{onOpenCase ? <button type="button" onClick={() => onOpenCase(item.id)} className="sa-button" data-variant="primary">Open case</button> : <PlatformEntityLink compact entityType="case" entityId={item.id}>Open case</PlatformEntityLink>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
