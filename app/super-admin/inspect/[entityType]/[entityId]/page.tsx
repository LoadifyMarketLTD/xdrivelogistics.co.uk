'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import {
  Company360Panel,
  PlatformEntityLink,
  type PlatformEntityType,
} from '@/app/super-admin/_components/control-plane';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const C = {
  navy: '#0B2F6B',
  blue: '#1D57D8',
  white: '#FFFFFF',
  charcoal: '#1A1F2B',
  light: '#F4F6F8',
  border: '#D9E1EA',
  muted: '#64748B',
  orange: '#F5A300',
  danger: '#DC2626',
  success: '#168553',
} as const;

const INSPECTABLE_TYPES = new Set<PlatformEntityType>([
  'job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute', 'case',
]);

type ApiField = {
  key: string;
  label: string;
  value: string;
  copyValue?: string | null;
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'danger';
};

type ApiSection = {
  id: string;
  title: string;
  description?: string;
  fields?: ApiField[];
  unavailable?: boolean;
  unavailableReason?: string;
};

type ApiRelation = {
  entityType: string;
  entityId: string;
  label: string;
  reference?: string | null;
  status?: string | null;
};

type ApiRelationGroup = {
  id: string;
  title: string;
  description?: string;
  rows: ApiRelation[];
  total?: number | null;
};

type InspectorPayload = {
  available?: boolean;
  entityType?: string;
  entityId?: string;
  reference?: string;
  title?: string;
  subtitle?: string;
  status?: string | null;
  stableId?: string;
  sections?: ApiSection[];
  relationshipGroups?: ApiRelationGroup[];
  note?: string;
  error?: string;
};

const toneColor = {
  default: C.charcoal,
  muted: C.muted,
  success: C.success,
  warning: '#A15A00',
  danger: C.danger,
} as const;

function toEntityType(value: string): PlatformEntityType | null {
  return INSPECTABLE_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : null;
}

async function copyText(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
}

function RelationGroup({ group }: { group: ApiRelationGroup }) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: 'hidden' }}>
      <div style={{ minHeight: 46, padding: '8px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${C.border}`, background: '#FBFCFE' }}>
        <div>
          <strong style={{ display: 'block', color: C.navy, fontSize: 11 }}>{group.title}</strong>
          {group.description ? <span style={{ display: 'block', marginTop: 2, color: C.muted, fontSize: 9 }}>{group.description}</span> : null}
        </div>
        <span style={{ color: C.muted, fontSize: 9 }}>{group.total ?? group.rows.length}</span>
      </div>
      <div style={{ display: 'grid', gap: 6, padding: 10 }}>
        {group.rows.length ? group.rows.map((row, index) => {
          const linkedType = toEntityType(row.entityType);
          return (
            <div key={`${row.entityType}:${row.entityId}:${index}`} style={{ minHeight: 42, padding: '7px 9px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 9, background: C.white }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', color: C.charcoal, fontSize: 10.5, overflowWrap: 'anywhere' }}>{row.label}</strong>
                <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', color: C.muted, fontSize: 8.8 }}>
                  <span>{row.entityType}</span>
                  {row.reference ? <code>{row.reference}</code> : null}
                  {row.status ? <span>· {row.status}</span> : null}
                </div>
              </div>
              {linkedType ? <PlatformEntityLink entityType={linkedType} entityId={row.entityId} compact>Inspect</PlatformEntityLink> : null}
            </div>
          );
        }) : <div style={{ color: C.muted, fontSize: 10 }}>No linked records returned.</div>}
      </div>
    </section>
  );
}

function ReadOnlyInspector() {
  const params = useParams<{ entityType: string; entityId: string }>();
  const entityTypeParam = decodeURIComponent(params?.entityType ?? '').toLowerCase();
  const entityIdParam = decodeURIComponent(params?.entityId ?? '').trim();
  const entityType = toEntityType(entityTypeParam);

  const [payload, setPayload] = useState<InspectorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityType || !entityIdParam) {
      setError('Invalid Platform Entity Inspector route.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setPayload(null);
        setError('No active Platform Owner session.');
        return;
      }

      const response = await fetch(
        `/api/super-admin/inspect/${encodeURIComponent(entityType)}/${encodeURIComponent(entityIdParam)}`,
        { headers: { Authorization: auth }, cache: 'no-store' },
      );
      const body = await response.json().catch(() => ({})) as InspectorPayload;
      if (!response.ok) {
        setPayload(null);
        setError(body.error ?? 'Platform Entity Inspector is unavailable.');
        return;
      }
      setPayload(body);
    } catch {
      setPayload(null);
      setError('Platform Entity Inspector is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [entityIdParam, entityType]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div style={messageStyle}>Loading canonical entity data…</div>;
  }

  if (error || !payload || !entityType) {
    return <div role="alert" style={{ ...messageStyle, borderLeft: `4px solid ${C.danger}`, color: C.danger }}>{error ?? 'Inspector unavailable.'}</div>;
  }

  const sections = payload.sections ?? [];
  const relationGroups = payload.relationshipGroups ?? [];
  const stableId = payload.stableId ?? payload.entityId ?? entityIdParam;

  return (
    <div style={{ padding: '0 14px 24px' }}>
      <header style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: C.blue, fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>{entityType}</span>
              <span style={{ border: `1px solid ${C.success}45`, borderRadius: 999, background: '#F1FBF6', color: C.success, padding: '2px 7px', fontSize: 8.5, fontWeight: 900 }}>READ ONLY</span>
              {payload.status ? <span style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: C.light, color: C.charcoal, padding: '2px 6px', fontSize: 9, fontWeight: 800 }}>{payload.status}</span> : null}
            </div>
            <h1 style={{ margin: '6px 0 0', color: C.navy, fontSize: 20, fontWeight: 900 }}>{payload.title ?? 'Platform entity'}</h1>
            {payload.subtitle ? <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 10.5 }}>{payload.subtitle}</p> : null}
            <div style={{ marginTop: 8, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ color: C.muted, fontSize: 9.5 }}>{payload.reference ?? entityIdParam}</code>
              <code style={{ color: C.muted, fontSize: 8.8 }}>{stableId}</code>
              <button type="button" onClick={() => void copyText(stableId)} className="sa-button" style={{ minHeight: 26, padding: '0 8px' }}>Copy ID</button>
            </div>
          </div>
          <div style={{ maxWidth: 420, borderLeft: `4px solid ${C.blue}`, background: C.light, padding: '8px 10px', color: C.charcoal, fontSize: 9.5, lineHeight: 1.45 }}>
            Layer 2A inspection surface. This page performs GET-only Platform Owner reads and contains no semantic action or mutation endpoint.
          </div>
        </div>
      </header>

      {payload.available === false ? (
        <div style={{ ...messageStyle, marginBottom: 14, borderLeft: `4px solid ${C.orange}` }}>
          <strong>Source unavailable.</strong> {payload.note ?? 'The required schema is not applied in this environment.'}
        </div>
      ) : null}

      {entityType === 'company' && payload.available !== false ? <Company360Panel companyId={stableId} /> : null}

      <section style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 9 }}>
          <h2 style={{ margin: 0, color: C.navy, fontSize: 14, fontWeight: 900 }}>Canonical record</h2>
          <p style={{ margin: '3px 0 0', color: C.muted, fontSize: 9.5 }}>Open a section to inspect the authoritative values returned by the read model.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
          {sections.length ? sections.map((section, index) => (
            <details key={section.id} open={index === 0} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: 'hidden' }}>
              <summary style={{ minHeight: 48, padding: '0 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, listStyle: 'none', cursor: 'pointer', background: '#FBFCFE' }}>
                <span>
                  <strong style={{ display: 'block', color: C.navy, fontSize: 11 }}>{section.title}</strong>
                  {section.description ? <span style={{ display: 'block', marginTop: 2, color: C.muted, fontSize: 8.8 }}>{section.description}</span> : null}
                </span>
                <span style={{ color: C.blue, fontSize: 8.5, fontWeight: 800 }}>Open</span>
              </summary>
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 10 }}>
                {section.unavailable ? (
                  <div style={{ color: '#A15A00', fontSize: 9.5 }}>Unavailable{section.unavailableReason ? ` — ${section.unavailableReason}` : ''}</div>
                ) : section.fields?.length ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {section.fields.map((entry) => (
                      <div key={entry.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,0.45fr) minmax(0,1fr)', gap: 9, alignItems: 'center', minHeight: 34, borderBottom: `1px solid ${C.light}`, padding: '4px 0' }}>
                        <span style={{ color: C.muted, fontSize: 9, fontWeight: 800 }}>{entry.label}</span>
                        <span style={{ minWidth: 0, color: toneColor[entry.tone ?? 'default'], fontSize: 9.8, fontWeight: 650, overflowWrap: 'anywhere' }}>
                          {entry.value}
                          {entry.copyValue ? <button type="button" className="sa-button" onClick={() => void copyText(entry.copyValue as string)} style={{ minHeight: 24, padding: '0 7px', marginLeft: 6 }}>Copy</button> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ color: C.muted, fontSize: 9.5 }}>No fields returned for this section.</div>}
              </div>
            </details>
          )) : <div style={messageStyle}>No record sections returned.</div>}
        </div>
      </section>

      <section>
        <div style={{ marginBottom: 9 }}>
          <h2 style={{ margin: 0, color: C.navy, fontSize: 14, fontWeight: 900 }}>Related entities</h2>
          <p style={{ margin: '3px 0 0', color: C.muted, fontSize: 9.5 }}>Follow canonical relationships without changing the underlying records.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 10 }}>
          {relationGroups.length ? relationGroups.map((group) => <RelationGroup key={group.id} group={group} />) : <div style={messageStyle}>No related entities returned.</div>}
        </div>
      </section>
    </div>
  );
}

const messageStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: C.white,
  padding: 13,
  color: C.muted,
  fontSize: 10,
} as const;

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ReadOnlyInspector />
    </ProtectedRoute>
  );
}
