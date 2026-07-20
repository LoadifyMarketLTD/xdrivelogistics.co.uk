'use client';

import { useRouter } from 'next/navigation';
import type { WorkspaceDefinition } from '../../../lib/workspaceDefinitions';

type Metric = { label: string; value: string | number; detail?: string; tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' };
type Action = { label: string; href: string; variant?: 'primary' | 'secondary' };
type Panel = { title: string; description?: string; empty?: string; rows?: Array<{ title: string; meta?: string; href?: string }> };

const tones = { blue: '#1d4ed8', green: '#15803d', amber: '#d97706', red: '#dc2626', purple: '#7c3aed' } as const;

export default function WorkspaceDashboard({ definition, metrics, actions, panels }: { definition: WorkspaceDefinition; metrics: Metric[]; actions: Action[]; panels: Panel[] }) {
  const router = useRouter();
  return (
    <main style={{ minHeight: '100vh', background: '#eef2f6', color: '#0f172a', padding: '1.25rem' }}>
      <section style={{ maxWidth: '1480px', margin: '0 auto' }}>
        <header style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: 12, padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ color: '#1d4ed8', fontWeight: 800, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>{definition.eyebrow}</div>
            <h1 style={{ margin: '.25rem 0', fontSize: '1.75rem' }}>{definition.title}</h1>
            <p style={{ margin: 0, color: '#475569', maxWidth: 780 }}>{definition.description}</p>
          </div>
          {definition.primaryAction && <button onClick={() => router.push(definition.primaryAction!.href)} style={{ border: 0, borderRadius: 8, background: '#f5a300', color: '#0a234f', padding: '.7rem 1rem', fontWeight: 850, cursor: 'pointer' }}>{definition.primaryAction.label}</button>}
        </header>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.75rem', marginBottom: '1rem' }}>
          {metrics.map((metric) => <article key={metric.label} style={{ background: '#fff', border: '1px solid #d7e0ea', borderTop: `3px solid ${tones[metric.tone ?? 'blue']}`, borderRadius: 10, padding: '1rem' }}><div style={{ color: '#64748b', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase' }}>{metric.label}</div><div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '.35rem' }}>{metric.value}</div>{metric.detail && <div style={{ color: '#64748b', fontSize: '.78rem', marginTop: '.25rem' }}>{metric.detail}</div>}</article>)}
        </section>
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: '.55rem', marginBottom: '1rem' }}>
          {actions.map((action) => <button key={action.label} onClick={() => router.push(action.href)} style={{ border: action.variant === 'secondary' ? '1px solid #cbd5e1' : 0, background: action.variant === 'secondary' ? '#fff' : '#0b2f6b', color: action.variant === 'secondary' ? '#0f172a' : '#fff', borderRadius: 8, padding: '.62rem .85rem', fontWeight: 800, cursor: 'pointer' }}>{action.label}</button>)}
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '.8rem' }}>
          {panels.map((panel) => <article key={panel.title} style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: 10, padding: '1rem', minHeight: 170 }}><h2 style={{ margin: 0, fontSize: '1rem' }}>{panel.title}</h2>{panel.description && <p style={{ color: '#64748b', fontSize: '.82rem' }}>{panel.description}</p>}{panel.rows?.length ? <div>{panel.rows.map((row, index) => <button key={`${row.title}-${index}`} onClick={() => row.href && router.push(row.href)} disabled={!row.href} style={{ width: '100%', textAlign: 'left', border: 0, borderTop: index ? '1px solid #eef2f6' : 0, background: 'transparent', padding: '.7rem 0', cursor: row.href ? 'pointer' : 'default' }}><strong>{row.title}</strong>{row.meta && <div style={{ color: '#64748b', fontSize: '.78rem', marginTop: '.15rem' }}>{row.meta}</div>}</button>)}</div> : <div style={{ color: '#64748b', padding: '2rem 0', textAlign: 'center' }}>{panel.empty ?? 'Nothing requires attention.'}</div>}</article>)}
        </section>
      </section>
    </main>
  );
}
