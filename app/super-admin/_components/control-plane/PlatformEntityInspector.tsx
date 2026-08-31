'use client';

import Link from 'next/link';
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

function scrollToSection(id: string | undefined) {
  if (!id || typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function contextHref(entityType: PlatformEntityType, kind: 'access' | 'compliance') {
  if (kind === 'access') {
    if (entityType === 'company') return '/super-admin/companies/verification';
    if (entityType === 'driver') return '/super-admin/users/drivers';
    if (entityType === 'user') return '/super-admin/users';
    return '/super-admin/search';
  }
  if (entityType === 'company') return '/super-admin/companies/compliance';
  if (entityType === 'driver' || entityType === 'vehicle') return '/super-admin/compliance/documents';
  if (entityType === 'pod') return '/super-admin/operations/pods';
  if (entityType === 'invoice') return '/super-admin/finance/invoices';
  return '/super-admin/compliance/documents';
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
  const firstSectionId = sections[0]?.id;
  const relationshipSectionId = sections.find((section) => section.id.startsWith('relationships-'))?.id;
  const actionSectionId = sections.find((section) => section.id === 'platform-actions')?.id;
  const requestCompletionEligible = entityType === 'company' || entityType === 'driver' || entityType === 'user';

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

      <section aria-label="Inspector guide" style={{ margin: '0 0 16px', padding: '14px', border: '1px solid #dfe6ef', borderRadius: 14, background: '#fff', boxShadow: '0 6px 20px rgba(8,42,97,.035)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#708095', fontSize: 9, fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase' }}>What do you want to check?</div>
            <h2 style={{ margin: '3px 0 0', color: '#082a61', fontSize: 14, fontWeight: 850 }}>Use these cards instead of hunting through menus</h2>
          </div>
          <span style={{ color: '#7b8ba1', fontSize: 9 }}>Visual preview · navigation only</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
          <button type="button" onClick={() => scrollToSection(firstSectionId)} style={guideCardStyle}>
            <strong style={guideTitleStyle}>{entityType === 'company' ? 'Company profile' : 'Record overview'}</strong>
            <span style={guideTextStyle}>Identity, contact details, status and authoritative record information.</span>
            <span style={guideLinkStyle}>Open section →</span>
          </button>

          <Link href={contextHref(entityType, 'access')} style={{ ...guideCardStyle, textDecoration: 'none' }}>
            <strong style={guideTitleStyle}>{entityType === 'company' ? 'Onboarding & access' : 'Access & account'}</strong>
            <span style={guideTextStyle}>Review onboarding state, verification and who should have workspace access.</span>
            <span style={guideLinkStyle}>Review access →</span>
          </Link>

          <Link href={contextHref(entityType, 'compliance')} style={{ ...guideCardStyle, textDecoration: 'none' }}>
            <strong style={guideTitleStyle}>Documents & compliance</strong>
            <span style={guideTextStyle}>Find document review, insurance, licence, expiry and compliance information.</span>
            <span style={guideLinkStyle}>Open compliance →</span>
          </Link>

          <button type="button" onClick={() => scrollToSection(relationshipSectionId ?? firstSectionId)} style={guideCardStyle}>
            <strong style={guideTitleStyle}>Related operations</strong>
            <span style={guideTextStyle}>Jump to linked users, drivers, vehicles, jobs, invoices and other related records.</span>
            <span style={guideLinkStyle}>View relationships →</span>
          </button>

          <button type="button" onClick={() => scrollToSection(actionSectionId ?? relationshipSectionId ?? firstSectionId)} style={guideCardStyle}>
            <strong style={guideTitleStyle}>Audit & cases</strong>
            <span style={guideTextStyle}>See authorised Platform Owner actions, active cases and investigation controls.</span>
            <span style={guideLinkStyle}>Open controls →</span>
          </button>

          {requestCompletionEligible ? (
            <details style={{ ...guideCardStyle, borderColor: '#f1c36b', background: '#fffaf0' }}>
              <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
                <strong style={{ ...guideTitleStyle, color: '#8a5800' }}>Request completion</strong>
                <span style={guideTextStyle}>Preview the flow for requesting missing documents or unfinished onboarding steps.</span>
                <span style={{ ...guideLinkStyle, color: '#b26a00' }}>Preview workflow →</span>
              </summary>
              <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #f3d28e', color: '#6d5a31', fontSize: 9.5, lineHeight: 1.5 }}>
                <strong style={{ display: 'block', color: '#8a5800', marginBottom: 4 }}>Planned workflow</strong>
                1. Run a real-time onboarding and document preflight.<br />
                2. Show exactly what is missing, expired or rejected.<br />
                3. Let Platform Owner confirm the requested items and message.<br />
                4. Send the request and track it in the audit trail.<br />
                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 6px', borderRadius: 6, background: '#fff3d8', color: '#8a5800', fontWeight: 800 }}>Not connected to mutation logic on this visual preview</span>
              </div>
            </details>
          ) : null}
        </div>
      </section>

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

const guideCardStyle = {
  minHeight: 126,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  textAlign: 'left',
  border: '1px solid #dfe6ef',
  borderRadius: 12,
  background: '#f9fbfd',
  padding: 12,
  color: '#172033',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

const guideTitleStyle = { display: 'block', color: '#082a61', fontSize: 11.5, fontWeight: 850 } as const;
const guideTextStyle = { display: 'block', marginTop: 6, color: '#66778e', fontSize: 9.5, lineHeight: 1.45 } as const;
const guideLinkStyle = { display: 'block', marginTop: 'auto', paddingTop: 10, color: '#1d57d8', fontSize: 9.5, fontWeight: 800 } as const;
