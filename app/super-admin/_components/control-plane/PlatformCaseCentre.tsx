'use client';

import type { PlatformCaseSeverity, PlatformCaseStatus, PlatformCaseSummary } from './types';
import PlatformEntityLink from './PlatformEntityLink';

const X = { navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626', success: '#15803D' } as const;

const severityColor: Record<PlatformCaseSeverity, string> = { P0: X.danger, P1: X.orange, P2: X.blue, P3: X.muted };
const statusColor: Record<PlatformCaseStatus, string> = { open: X.danger, acknowledged: X.orange, investigating: X.blue, waiting: X.orange, resolved: X.success, closed: X.muted };

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
    <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ minHeight: '42px', padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: X.light, borderBottom: `1px solid ${X.border}` }}>
        <div><h2 style={{ margin: 0, color: X.navy, fontSize: '12px', fontWeight: 800 }}>Platform Case Centre</h2><p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>Persistent human-owned exceptions. Derived dashboard alerts are not substitutes for cases.</p></div>
        <span style={{ color: X.navy, fontSize: '10px', fontWeight: 800 }}>{loading ? 'Loading…' : `${cases.length} visible`}</span>
      </div>
      {error ? <div role="alert" style={{ padding: '10px 12px', color: X.danger, fontSize: '11px', borderBottom: `1px solid ${X.border}` }}>{error}</div> : null}
      {loading ? <div style={{ padding: '16px', textAlign: 'center', color: X.muted, fontSize: '11px' }}>Loading cases…</div> : cases.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: X.muted, fontSize: '11px' }}>No persistent cases match the current filter.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
            <thead><tr style={{ height: '36px', background: X.light }}>{['Severity', 'Case', 'Entity', 'Status', 'Owner', 'Updated', ''].map((heading) => <th key={heading} style={{ padding: '0 10px', textAlign: 'left', color: X.navy, fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: `1px solid ${X.border}` }}>{heading}</th>)}</tr></thead>
            <tbody>{cases.map((item) => <tr key={item.id} style={{ borderBottom: `1px solid ${X.border}` }}>
              <td style={cellStyle}><strong style={{ color: severityColor[item.severity] }}>{item.severity}</strong></td>
              <td style={cellStyle}><div style={{ color: X.navy, fontSize: '11px', fontWeight: 800 }}>{item.reference} · {item.title}</div>{item.description ? <div style={{ color: X.muted, fontSize: '9px', marginTop: '2px', maxWidth: '360px' }}>{item.description}</div> : null}</td>
              <td style={cellStyle}><PlatformEntityLink compact entityType={item.entityType} entityId={item.entityId}>{item.entityLabel}</PlatformEntityLink></td>
              <td style={cellStyle}><span style={{ color: statusColor[item.status], fontSize: '10px', fontWeight: 800, textTransform: 'capitalize' }}>{item.status.replace(/_/g, ' ')}</span></td>
              <td style={cellStyle}>{item.assignedToLabel ?? 'Unassigned'}</td>
              <td style={cellStyle}>{when(item.updatedAt)}</td>
              <td style={cellStyle}>{onOpenCase ? <button type="button" onClick={() => onOpenCase(item.id)} style={openStyle}>Open case</button> : <PlatformEntityLink compact entityType="case" entityId={item.id}>Open case</PlatformEntityLink>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cellStyle = { padding: '8px 10px', color: X.charcoal, fontSize: '10px', verticalAlign: 'top' } as const;
const openStyle = { minHeight: '28px', padding: '0 8px', borderRadius: '4px', border: `1px solid ${X.blue}`, background: X.blue, color: X.white, fontSize: '10px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' } as const;
