import type { PlatformAuditEntry } from './types';

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PlatformAuditTimeline({ entries, emptyMessage = 'No audit events are recorded for this entity.' }: { entries: PlatformAuditEntry[]; emptyMessage?: string }) {
  return (
    <section className="sa-panel">
      <div className="sa-panel-header">
        <div><h2 className="sa-panel-title">Audit timeline</h2><p className="sa-panel-subtitle">Actor, action, reason and correlation evidence for privileged activity.</p></div>
        <span className="sa-section-pill">{entries.length} events</span>
      </div>
      {entries.length === 0 ? <div className="sa-empty">{emptyMessage}</div> : (
        <ol style={{ listStyle: 'none', margin: 0, padding: '7px 15px 10px' }}>
          {entries.map((entry, index) => (
            <li key={entry.id} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '128px minmax(0,1fr)', gap: 14, padding: '13px 0', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #edf1f6' }}>
              <div style={{ position: 'relative', paddingLeft: 17, color: '#7f8da0', fontSize: 9, lineHeight: 1.45 }}>
                <span style={{ position: 'absolute', left: 0, top: 4, width: 8, height: 8, borderRadius: '50%', background: index === 0 ? '#1d57d8' : '#c7d2e2', boxShadow: index === 0 ? '0 0 0 4px rgba(29,87,216,.08)' : 'none' }} />
                {when(entry.createdAt)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap' }}><strong style={{ color: '#082a61', fontSize: 11 }}>{entry.action}</strong><span style={{ color: '#4f5f74', fontSize: 10 }}>by {entry.actorLabel}</span></div>
                {entry.reason ? <div style={{ marginTop: 4, color: '#344054', fontSize: 10, lineHeight: 1.5 }}><span style={{ color: '#8995a7' }}>Reason: </span>{entry.reason}</div> : null}
                {entry.before || entry.after ? <div style={{ marginTop: 7, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 7 }}>{entry.before ? <State label="Before" value={entry.before} /> : null}{entry.after ? <State label="After" value={entry.after} /> : null}</div> : null}
                {entry.correlationId ? <div style={{ marginTop: 6, color: '#1d57d8', fontSize: 9 }}>Correlation: <code>{entry.correlationId}</code></div> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function State({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid #e2e8f0', borderRadius: 9, padding: 8, background: '#f8faff', color: '#344054', fontSize: 10, overflowWrap: 'anywhere' }}><span style={{ display: 'block', color: '#8390a3', fontSize: 8, fontWeight: 850, textTransform: 'uppercase', marginBottom: 3 }}>{label}</span>{value}</div>;
}
