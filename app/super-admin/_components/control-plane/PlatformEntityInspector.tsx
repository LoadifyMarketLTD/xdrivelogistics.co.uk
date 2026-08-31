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
  const requestCompletionEligible = entityType === 'company' || entityType === 'driver' || entityType === 'user';

  return (
    <div className="sa-inspector" style={{ paddingBottom: 24 }}>
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

      {banner ? <div style={{ marginBottom: 14 }}>{banner}</div> : null}

      <section style={{ marginBottom: 14, padding: 14, border: '1px solid #dfe6ef', borderRadius: 15, background: '#fff', boxShadow: '0 7px 22px rgba(8,42,97,.035)' }}>
        <div style={{ marginBottom: 11 }}>
          <div style={{ color: '#708095', fontSize: 9, fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase' }}>What do you want to manage?</div>
          <h2 style={{ margin: '3px 0 0', color: '#082a61', fontSize: 15, fontWeight: 900 }}>Choose an area of this {entityType}</h2>
          <p style={{ margin: '4px 0 0', color: '#66778e', fontSize: 10 }}>Open only the information you need instead of scrolling through the whole record.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 9 }}>
          <div style={guideCardStyle}>
            <strong style={guideTitleStyle}>{entityType === 'company' ? 'Company profile' : 'Record overview'}</strong>
            <span style={guideTextStyle}>Identity, contact details, status and authoritative record information.</span>
          </div>

          <Link href={contextHref(entityType, 'access')} style={{ ...guideCardStyle, textDecoration: 'none' }}>
            <strong style={guideTitleStyle}>{entityType === 'company' ? 'Onboarding & access' : 'Access & account'}</strong>
            <span style={guideTextStyle}>Review onboarding, verification and workspace access.</span>
            <span style={guideLinkStyle}>Open →</span>
          </Link>

          <Link href={contextHref(entityType, 'compliance')} style={{ ...guideCardStyle, textDecoration: 'none' }}>
            <strong style={guideTitleStyle}>Documents & compliance</strong>
            <span style={guideTextStyle}>Review documents, insurance, licences, expiry and compliance information.</span>
            <span style={guideLinkStyle}>Open →</span>
          </Link>

          <div style={guideCardStyle}>
            <strong style={guideTitleStyle}>Related operations</strong>
            <span style={guideTextStyle}>Linked users, drivers, vehicles, jobs, invoices and operational records appear below as compact cards.</span>
          </div>

          <div style={guideCardStyle}>
            <strong style={guideTitleStyle}>Audit & cases</strong>
            <span style={guideTextStyle}>Platform Owner actions, active cases and investigation controls are kept in one area.</span>
          </div>

          {requestCompletionEligible ? (
            <details style={{ ...guideCardStyle, borderColor: '#f1c36b', background: '#fffaf0' }}>
              <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
                <strong style={{ ...guideTitleStyle, color: '#8a5800' }}>Request completion</strong>
                <span style={guideTextStyle}>Check what onboarding steps or required documents are missing before sending a request.</span>
                <span style={{ ...guideLinkStyle, color: '#b26a00' }}>Preview workflow →</span>
              </summary>
              <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid #f3d28e', color: '#6d5a31', fontSize: 9.5, lineHeight: 1.5 }}>
                1. Run live onboarding/document preflight.<br />
                2. List missing, expired or rejected requirements.<br />
                3. Platform Owner confirms what to request.<br />
                4. Send and record the request in audit history.<br />
                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 6px', borderRadius: 6, background: '#fff3d8', color: '#8a5800', fontWeight: 800 }}>Visual preview only — no mutation yet</span>
              </div>
            </details>
          ) : null}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, color: '#082a61', fontSize: 15, fontWeight: 900 }}>Record information</h2>
          <p style={{ margin: '3px 0 0', color: '#66778e', fontSize: 10 }}>Sections are collapsed by default. Open only what you need.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
          {sections.map((section, index) => (
            <details key={section.id} id={section.id} open={index === 0} style={{ border: '1px solid #dfe6ef', borderRadius: 13, background: '#fff', overflow: 'hidden', boxShadow: '0 5px 18px rgba(8,42,97,.025)' }}>
              <summary style={{ minHeight: 54, padding: '0 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', listStyle: 'none', background: '#fbfcfe', borderBottom: '1px solid #edf1f6' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: '#082a61', fontSize: 11.5, fontWeight: 850 }}>{section.title}</strong>
                  {section.description ? <span style={{ display: 'block', marginTop: 2, color: '#7b8ba1', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.description}</span> : null}
                </span>
                <span style={{ color: '#1d57d8', fontSize: 9, fontWeight: 800 }}>Open</span>
              </summary>

              {section.unavailable ? (
                <div style={{ padding: 12, color: '#b26a00', fontSize: 10 }}>Unavailable{section.unavailableReason ? ` — ${section.unavailableReason}` : ''}</div>
              ) : (
                <div style={{ padding: 12 }}>
                  {section.fields?.length ? (
                    <dl className="sa-inspector-fields" style={{ margin: 0 }}>
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
                  {section.content ? <div style={{ marginTop: section.fields?.length ? 12 : 0 }}>{section.content}</div> : null}
                  {!section.fields?.length && !section.content ? <div style={{ color: '#667085', fontSize: 10 }}>No data available for this section.</div> : null}
                </div>
              )}
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

const guideCardStyle = {
  minHeight: 112,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  textAlign: 'left',
  border: '1px solid #dfe6ef',
  borderRadius: 12,
  background: '#f9fbfd',
  padding: 11,
  color: '#172033',
  fontFamily: 'inherit',
} as const;

const guideTitleStyle = { display: 'block', color: '#082a61', fontSize: 11.5, fontWeight: 850 } as const;
const guideTextStyle = { display: 'block', marginTop: 6, color: '#66778e', fontSize: 9.5, lineHeight: 1.45 } as const;
const guideLinkStyle = { display: 'block', marginTop: 'auto', paddingTop: 9, color: '#1d57d8', fontSize: 9.5, fontWeight: 800 } as const;
