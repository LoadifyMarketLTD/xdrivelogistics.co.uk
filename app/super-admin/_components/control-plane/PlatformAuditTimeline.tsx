import type { PlatformAuditEntry } from './types';

const X = { navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B' } as const;

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PlatformAuditTimeline({ entries, emptyMessage = 'No audit events are recorded for this entity.' }: { entries: PlatformAuditEntry[]; emptyMessage?: string }) {
  return (
    <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: X.light, borderBottom: `1px solid ${X.border}` }}>
        <h2 style={{ margin: 0, color: X.navy, fontSize: '12px', fontWeight: 800 }}>Audit timeline</h2>
        <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>Actor, action, reason and correlation evidence for privileged activity.</p>
      </div>
      {entries.length === 0 ? <div style={{ padding: '12px', color: X.muted, fontSize: '11px' }}>{emptyMessage}</div> : (
        <ol style={{ listStyle: 'none', margin: 0, padding: '4px 12px' }}>
          {entries.map((entry, index) => (
            <li key={entry.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: '10px', padding: '9px 0', borderBottom: index === entries.length - 1 ? 'none' : `1px solid ${X.border}` }}>
              <div style={{ color: X.muted, fontSize: '9px', lineHeight: 1.4 }}>{when(entry.createdAt)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap' }}><strong style={{ color: X.navy, fontSize: '11px' }}>{entry.action}</strong><span style={{ color: X.charcoal, fontSize: '10px' }}>by {entry.actorLabel}</span></div>
                {entry.reason ? <div style={{ marginTop: '3px', color: X.charcoal, fontSize: '10px', lineHeight: 1.45 }}><span style={{ color: X.muted }}>Reason: </span>{entry.reason}</div> : null}
                {entry.before || entry.after ? <div style={{ marginTop: '5px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '6px' }}>{entry.before ? <div style={stateStyle}><span style={stateLabelStyle}>Before</span>{entry.before}</div> : null}{entry.after ? <div style={stateStyle}><span style={stateLabelStyle}>After</span>{entry.after}</div> : null}</div> : null}
                {entry.correlationId ? <div style={{ marginTop: '4px', color: X.blue, fontSize: '9px' }}>Correlation: <code>{entry.correlationId}</code></div> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const stateStyle = { border: `1px solid ${X.border}`, borderRadius: '4px', padding: '6px', background: X.light, color: X.charcoal, fontSize: '10px', overflowWrap: 'anywhere' } as const;
const stateLabelStyle = { display: 'block', color: X.muted, fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' } as const;
