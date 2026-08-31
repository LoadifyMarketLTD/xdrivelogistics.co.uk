'use client';

import type { ReactNode } from 'react';
import type { PlatformEntitySection, PlatformEntityType } from './types';

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B',
  light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', success: '#15803D',
  warning: '#B26A00', danger: '#DC2626',
} as const;

const toneColor = {
  default: X.charcoal,
  muted: X.muted,
  success: X.success,
  warning: X.warning,
  danger: X.danger,
} as const;

async function copyText(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
}

export default function PlatformEntityInspector({
  entityType,
  reference,
  title,
  status,
  subtitle,
  stableId,
  sections,
  actions,
  banner,
}: {
  entityType: PlatformEntityType;
  reference: string;
  title: string;
  status?: ReactNode;
  subtitle?: string;
  stableId?: string;
  sections: PlatformEntitySection[];
  actions?: ReactNode;
  banner?: ReactNode;
}) {
  return (
    <div style={{ minHeight: '100%', background: X.light, color: X.charcoal, padding: '12px' }}>
      <header style={{ background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ color: X.blue, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{entityType}</span>
              <span style={{ color: X.muted, fontSize: '10px' }}>{reference}</span>
              {status}
            </div>
            <h1 style={{ margin: 0, color: X.navy, fontSize: '20px', lineHeight: 1.2, fontWeight: 800 }}>{title}</h1>
            {subtitle ? <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '11px', lineHeight: 1.45 }}>{subtitle}</p> : null}
            {stableId ? (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <code style={{ color: X.muted, fontSize: '10px' }}>{stableId}</code>
                <button type="button" onClick={() => void copyText(stableId)} style={smallButtonStyle}>Copy ID</button>
              </div>
            ) : null}
          </div>
          {actions ? <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div> : null}
        </div>
      </header>

      {banner ? <div style={{ marginBottom: '12px' }}>{banner}</div> : null}

      <div style={{ display: 'grid', gap: '12px' }}>
        {sections.map((section) => (
          <section key={section.id} id={section.id} style={{ background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '7px 12px', borderBottom: `1px solid ${X.border}`, background: X.light }}>
              <div>
                <h2 style={{ margin: 0, color: X.navy, fontSize: '12px', fontWeight: 800 }}>{section.title}</h2>
                {section.description ? <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>{section.description}</p> : null}
              </div>
            </div>
            {section.unavailable ? (
              <div style={{ padding: '12px', color: X.warning, fontSize: '11px' }}>
                Unavailable{section.unavailableReason ? ` — ${section.unavailableReason}` : ''}
              </div>
            ) : (
              <div style={{ padding: '12px' }}>
                {section.fields?.length ? (
                  <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '10px 12px' }}>
                    {section.fields.map((field) => (
                      <div key={field.key} style={{ minWidth: 0 }}>
                        <dt style={{ color: X.muted, fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '3px' }}>{field.label}</dt>
                        <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: toneColor[field.tone ?? 'default'], fontSize: '11px', fontWeight: field.tone && field.tone !== 'default' ? 800 : 600, minWidth: 0 }}>
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{field.value}</span>
                          {field.copyValue ? <button type="button" onClick={() => void copyText(field.copyValue as string)} style={smallButtonStyle}>Copy</button> : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {section.content ? <div style={{ marginTop: section.fields?.length ? '12px' : 0 }}>{section.content}</div> : null}
                {!section.fields?.length && !section.content ? <div style={{ color: X.muted, fontSize: '11px' }}>No data available for this section.</div> : null}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

const smallButtonStyle = {
  height: '24px', padding: '0 7px', borderRadius: '4px', border: `1px solid ${X.border}`,
  background: X.white, color: X.blue, fontSize: '9px', fontWeight: 800, cursor: 'pointer',
} as const;
