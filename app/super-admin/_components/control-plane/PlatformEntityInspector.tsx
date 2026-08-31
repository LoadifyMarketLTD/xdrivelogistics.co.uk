'use client';

import type { ReactNode } from 'react';
import type { PlatformEntitySection, PlatformEntityType } from './types';

const toneColor = {
  default: '#172033',
  muted: '#667085',
  success: '#168553',
  warning: '#b26a00',
  danger: '#d92d20',
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
    <div className="sa-inspector">
      <header className="sa-inspector-hero">
        <div className="sa-inspector-top">
          <div style={{ minWidth: 0 }}>
            <div className="sa-inspector-kicker">
              <span>{entityType}</span>
              <span style={{ color: '#8390a3', letterSpacing: 0, textTransform: 'none' }}>{reference}</span>
              {status}
            </div>
            <h1 className="sa-inspector-title">{title}</h1>
            {subtitle ? <p className="sa-inspector-subtitle">{subtitle}</p> : null}
            {stableId ? (
              <div className="sa-inspector-id">
                <code>{stableId}</code>
                <button type="button" onClick={() => void copyText(stableId)} className="sa-button">Copy ID</button>
              </div>
            ) : null}
          </div>
          {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>{actions}</div> : null}
        </div>
      </header>

      {banner ? <div style={{ marginBottom: 16 }}>{banner}</div> : null}

      <div className="sa-inspector-grid">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="sa-inspector-section">
            <div className="sa-inspector-section-head">
              <div>
                <h2>{section.title}</h2>
                {section.description ? <p>{section.description}</p> : null}
              </div>
            </div>
            {section.unavailable ? (
              <div className="sa-inspector-section-body" style={{ color: '#b26a00', fontSize: 11 }}>
                Unavailable{section.unavailableReason ? ` — ${section.unavailableReason}` : ''}
              </div>
            ) : (
              <div className="sa-inspector-section-body">
                {section.fields?.length ? (
                  <dl className="sa-inspector-fields">
                    {section.fields.map((field) => (
                      <div key={field.key} className="sa-inspector-field" style={{ minWidth: 0 }}>
                        <dt>{field.label}</dt>
                        <dd style={{ color: toneColor[field.tone ?? 'default'], fontWeight: field.tone && field.tone !== 'default' ? 800 : 650 }}>
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{field.value}</span>
                          {field.copyValue ? <button type="button" onClick={() => void copyText(field.copyValue as string)} className="sa-button" style={{ minHeight: 26, padding: '0 8px', marginLeft: 6 }}>Copy</button> : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {section.content ? <div style={{ marginTop: section.fields?.length ? 14 : 0 }}>{section.content}</div> : null}
                {!section.fields?.length && !section.content ? <div style={{ color: '#667085', fontSize: 11 }}>No data available for this section.</div> : null}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
