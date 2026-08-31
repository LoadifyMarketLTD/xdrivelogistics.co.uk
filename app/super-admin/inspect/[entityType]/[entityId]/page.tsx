'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import {
  PlatformActionPanel,
  PlatformEntityInspector,
  PlatformEntityLink,
  type PlatformEntitySection,
  type PlatformEntityType,
  type PlatformSemanticAction,
} from '@/app/super-admin/_components/control-plane';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X = { navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', orange: '#F5A300', danger: '#DC2626' } as const;
const INSPECTABLE_TYPES = new Set<PlatformEntityType>(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute', 'case']);

type ApiField = { key: string; label: string; value: string; copyValue?: string | null; tone?: 'default' | 'muted' | 'success' | 'warning' | 'danger' };
type ApiSection = { id: string; title: string; description?: string; fields?: ApiField[]; unavailable?: boolean; unavailableReason?: string };
type ApiRelation = { entityType: string; entityId: string; label: string; reference?: string | null; status?: string | null };
type ApiRelationGroup = { id: string; title: string; description?: string; rows: ApiRelation[]; total?: number | null };
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

type ActionDescriptor = {
  id: string;
  label: string;
  description: string;
  requiresReason: boolean;
  tone: 'primary' | 'secondary' | 'warning' | 'danger';
  caseSeverity?: 'P0' | 'P1' | 'P2' | 'P3';
};

type ActiveCase = {
  id: string;
  reference: string;
  severity: string;
  status: string;
  title: string;
};

type ActionState = {
  supported?: boolean;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  companyId?: string | null;
  actions?: ActionDescriptor[];
  activeCases?: ActiveCase[];
  caseCentreAvailable?: boolean | null;
  caseCentreNote?: string | null;
  error?: string;
};

function toEntityType(value: string): PlatformEntityType | null {
  return INSPECTABLE_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : null;
}

function StatusBadge({ value }: { value: string }) {
  return <span style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.light, color: X.charcoal, padding: '2px 6px', fontSize: '9px', fontWeight: 800 }}>{value}</span>;
}

function RelationshipTable({ group }: { group: ApiRelationGroup }) {
  if (!group.rows.length) {
    return <div style={{ color: X.muted, fontSize: '10px' }}>No linked entities returned for this relationship.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: '5px' }}>
      {group.rows.map((row, index) => {
        const entityType = toEntityType(row.entityType);
        return (
          <div key={`${row.entityType}:${row.entityId}:${index}`} style={{ minHeight: '36px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: '8px', border: `1px solid ${X.border}`, borderRadius: '4px', padding: '5px 7px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: X.navy, fontSize: '10px', fontWeight: 800, overflowWrap: 'anywhere' }}>{row.label}</div>
              <div style={{ marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap', color: X.muted, fontSize: '9px' }}>
                <span>{row.entityType}</span>
                {row.reference ? <code>{row.reference}</code> : null}
                {row.status ? <span>{row.status}</span> : null}
              </div>
            </div>
            {entityType ? <PlatformEntityLink entityType={entityType} entityId={row.entityId} compact>Inspect</PlatformEntityLink> : <span style={{ color: X.muted, fontSize: '9px' }}>Unsupported link type</span>}
          </div>
        );
      })}
    </div>
  );
}

function ActiveCases({ rows }: { rows: ActiveCase[] }) {
  if (!rows.length) return null;
  return (
    <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
      {rows.map((row) => (
        <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center', border: `1px solid ${X.border}`, borderRadius: '4px', padding: '7px 8px', background: X.white }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: X.navy, fontSize: '10px', fontWeight: 800 }}>{row.reference} · {row.severity} · {row.status}</div>
            <div style={{ marginTop: '2px', color: X.muted, fontSize: '10px', overflowWrap: 'anywhere' }}>{row.title}</div>
          </div>
          <PlatformEntityLink entityType="case" entityId={row.id} compact>Open case</PlatformEntityLink>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const params = useParams<{ entityType: string; entityId: string }>();
  const router = useRouter();
  const entityTypeParam = decodeURIComponent(params?.entityType ?? '').toLowerCase();
  const entityIdParam = decodeURIComponent(params?.entityId ?? '');
  const [payload, setPayload] = useState<InspectorPayload | null>(null);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadActions = useCallback(async (auth?: string) => {
    if (!entityTypeParam || !entityIdParam) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const token = auth ?? await getAuthHeader();
      if (!token) {
        setActionState(null);
        setActionError('No active Platform Owner session.');
        return;
      }
      const response = await fetch(`/api/super-admin/inspect/${encodeURIComponent(entityTypeParam)}/${encodeURIComponent(entityIdParam)}/actions`, {
        headers: { Authorization: token },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as ActionState;
      if (!response.ok) {
        setActionState(null);
        setActionError(body.error ?? 'Inspector action state is unavailable.');
        return;
      }
      setActionState(body);
    } catch {
      setActionState(null);
      setActionError('Inspector action state is unavailable.');
    } finally {
      setActionLoading(false);
    }
  }, [entityIdParam, entityTypeParam]);

  const load = useCallback(async () => {
    if (!entityTypeParam || !entityIdParam) {
      setError('Invalid Platform Entity Inspector route.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setActionState(null);
    setActionError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const response = await fetch(`/api/super-admin/inspect/${encodeURIComponent(entityTypeParam)}/${encodeURIComponent(entityIdParam)}`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as InspectorPayload;
      if (!response.ok) {
        setPayload(null);
        setError(body.error ?? 'Platform Entity Inspector is unavailable.');
        return;
      }
      setPayload(body);
      if (body.available !== false) await loadActions(auth);
    } catch {
      setPayload(null);
      setError('Platform Entity Inspector is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [entityIdParam, entityTypeParam, loadActions]);

  useEffect(() => { void load(); }, [load]);

  const executeDescriptor = useCallback((descriptor: ActionDescriptor): PlatformSemanticAction => ({
    id: descriptor.id,
    label: descriptor.label,
    description: descriptor.description,
    requiresReason: descriptor.requiresReason,
    tone: descriptor.tone,
    reasonLabel: descriptor.caseSeverity ? `${descriptor.caseSeverity} investigation reason` : 'Platform intervention reason',
    reasonPlaceholder: descriptor.caseSeverity
      ? 'Describe the exception, evidence and operational impact…'
      : 'Describe why this platform intervention is required…',
    onExecute: async (reason) => {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');

      if (descriptor.caseSeverity) {
        const response = await fetch('/api/super-admin/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({
            source: 'operations',
            caseType: `${entityTypeParam}_exception`,
            severity: descriptor.caseSeverity,
            title: `${descriptor.caseSeverity} ${entityTypeParam} exception · ${actionState?.entityLabel ?? payload?.reference ?? entityIdParam}`,
            description: reason,
            entityType: entityTypeParam,
            entityId: entityIdParam,
            entityLabel: actionState?.entityLabel ?? payload?.reference ?? entityIdParam,
            companyId: actionState?.companyId ?? null,
            dedupeKey: `operations:${entityTypeParam}:${entityIdParam}`,
            metadata: {
              origin: 'platform_entity_inspector',
              inspector_entity_type: entityTypeParam,
              inspector_entity_id: entityIdParam,
            },
          }),
        });
        const body = await response.json().catch(() => ({})) as { error?: string; case?: { id?: string } | null };
        if (!response.ok) throw new Error(body.error ?? 'Platform case creation failed.');
        if (body.case?.id) {
          router.push(`/super-admin/inspect/case/${encodeURIComponent(body.case.id)}`);
          return;
        }
        await loadActions(auth);
        return;
      }

      if (entityTypeParam === 'job' && ['publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel'].includes(descriptor.id)) {
        const response = await fetch(`/api/super-admin/marketplace/${encodeURIComponent(entityIdParam)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ action: descriptor.id, reason: reason || undefined }),
        });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? 'Marketplace governance action failed.');
        await load();
        return;
      }

      throw new Error('This semantic action is not registered for the current inspector.');
    },
  }), [actionState?.companyId, actionState?.entityLabel, entityIdParam, entityTypeParam, load, loadActions, payload?.reference, router]);

  const semanticActions = useMemo(
    () => (actionState?.actions ?? []).map(executeDescriptor),
    [actionState?.actions, executeDescriptor],
  );

  const renderedSections = useMemo<PlatformEntitySection[]>(() => {
    if (!payload) return [];
    const base: PlatformEntitySection[] = (payload.sections ?? []).map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      fields: section.fields?.map((entry) => ({
        key: entry.key,
        label: entry.label,
        value: entry.value,
        copyValue: entry.copyValue,
        tone: entry.tone,
      })),
      unavailable: section.unavailable,
      unavailableReason: section.unavailableReason,
    }));
    const relationships = (payload.relationshipGroups ?? []).map((group): PlatformEntitySection => ({
      id: `relationships-${group.id}`,
      title: group.total == null ? group.title : `${group.title} · ${group.total}`,
      description: group.description,
      content: <RelationshipTable group={group} />,
    }));
    const actionSection: PlatformEntitySection[] = actionState?.supported ? [{
      id: 'platform-actions',
      title: 'Platform exception control',
      description: 'Server-derived semantic actions only. Arbitrary field editing is not available.',
      content: (
        <div>
          {actionState.caseCentreNote ? <div style={{ marginBottom: '8px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${actionState.caseCentreAvailable === false ? X.orange : X.blue}`, borderRadius: '4px', background: X.light, padding: '7px 9px', color: X.charcoal, fontSize: '10px' }}>{actionState.caseCentreNote}</div> : null}
          <ActiveCases rows={actionState.activeCases ?? []} />
          {actionError ? <div role="alert" style={{ marginBottom: '8px', color: X.danger, fontSize: '10px' }}>{actionError}</div> : null}
          {actionLoading ? <div style={{ color: X.muted, fontSize: '10px' }}>Refreshing authorised actions…</div> : <PlatformActionPanel actions={semanticActions} />}
        </div>
      ),
    }] : [];
    return [...base, ...relationships, ...actionSection];
  }, [actionError, actionLoading, actionState, payload, semanticActions]);

  const entityType = toEntityType(payload?.entityType ?? entityTypeParam);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      {loading ? <div style={stateStyle}>Loading authoritative entity context…</div> : null}
      {error ? <div role="alert" style={{ ...stateStyle, color: X.danger }}>{error}</div> : null}
      {!loading && !error && payload?.available === false ? (
        <div style={{ ...stateStyle, borderLeft: `4px solid ${X.orange}`, textAlign: 'left' }}>
          <strong style={{ color: X.navy }}>Inspector source unavailable.</strong> {payload.note ?? 'Required schema is unavailable in this environment.'}
        </div>
      ) : null}
      {!loading && !error && payload?.available !== false && payload && entityType ? (
        <PlatformEntityInspector
          entityType={entityType}
          reference={payload.reference ?? payload.entityId ?? entityIdParam}
          title={payload.title ?? 'Platform entity'}
          subtitle={payload.subtitle}
          stableId={payload.stableId ?? payload.entityId ?? entityIdParam}
          status={payload.status ? <StatusBadge value={payload.status} /> : undefined}
          sections={renderedSections}
          banner={payload.note ? <div style={{ border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '8px 10px', color: X.charcoal, fontSize: '10px' }}>{payload.note}</div> : undefined}
        />
      ) : null}
      {!loading && !error && payload && payload.available !== false && !entityType ? <div style={stateStyle}>Unsupported inspector entity type.</div> : null}
    </ProtectedRoute>
  );
}

const stateStyle = { margin: '12px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '18px', color: X.muted, fontSize: '11px', textAlign: 'center' } as const;
