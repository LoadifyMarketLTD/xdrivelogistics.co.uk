'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  PlatformActionPanel,
  PlatformAuditTimeline,
  PlatformEntityInspector,
  PlatformEntityLink,
  type PlatformAuditEntry,
  type PlatformEntitySection,
  type PlatformEntityType,
  type PlatformSemanticAction,
} from '@/app/super-admin/_components/control-plane';

const X = { navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626', orange: '#F5A300', success: '#15803D' } as const;
const ENTITY_TYPES = new Set<PlatformEntityType>(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute', 'notification', 'health_check', 'case']);

function entityType(value: string): PlatformEntityType {
  return ENTITY_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : 'case';
}

type CaseRecord = {
  id: string; reference: string; source: string; case_type: string; severity: 'P0'|'P1'|'P2'|'P3';
  status: 'open'|'acknowledged'|'investigating'|'waiting'|'resolved'|'closed'; title: string; description: string | null;
  entity_type: string; entity_id: string; entity_label: string; company_id: string | null; assigned_to_user_id: string | null;
  metadata: Record<string, unknown> | null; detected_at: string; acknowledged_at: string | null; resolved_at: string | null; closed_at: string | null; created_at: string; updated_at: string;
};

type EventRecord = { id: string; event_type: string; actor_label: string; old_status: string | null; new_status: string | null; reason: string | null; metadata: Record<string, unknown> | null; created_at: string };

const statusTone = (status: CaseRecord['status']) => status === 'closed' || status === 'resolved' ? X.success : status === 'open' ? X.danger : status === 'waiting' ? X.orange : X.blue;

export default function Page() {
  const params = useParams<{ caseId: string }>();
  const caseId = String(params?.caseId ?? '');
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const res = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, { headers: { Authorization: auth } });
      const body = await res.json().catch(() => ({})) as { case?: CaseRecord; events?: EventRecord[]; error?: string };
      if (!res.ok || !body.case) { setError(body.error ?? 'Platform case is unavailable.'); return; }
      setRecord(body.case); setEvents(body.events ?? []);
    } catch { setError('Platform case is unavailable.'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  const mutate = useCallback(async (action: string, reason: string) => {
    const auth = await getAuthHeader();
    if (!auth) throw new Error('No active Platform Owner session.');
    const res = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify({ action, reason: reason || undefined }) });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? 'Case action failed.');
  }, [caseId]);

  const actions = useMemo<PlatformSemanticAction[]>(() => {
    if (!record) return [];
    const make = (id: string, label: string, description: string, tone: PlatformSemanticAction['tone'] = 'primary', requiresReason = true): PlatformSemanticAction => ({ id, label, description, tone, requiresReason, reasonPlaceholder: `Explain why this case should ${label.toLowerCase()}…`, onExecute: (reason) => mutate(id, reason) });
    switch (record.status) {
      case 'open': return [make('acknowledge', 'Acknowledge', 'Take ownership of this detected exception.', 'primary', false), make('investigate', 'Investigate', 'Move directly into active investigation.', 'warning')];
      case 'acknowledged': return [make('investigate', 'Investigate', 'Begin active investigation.', 'primary'), make('wait', 'Wait', 'Pause while awaiting an external dependency.', 'secondary'), make('resolve', 'Resolve', 'Mark the verified exception as resolved.', 'primary')];
      case 'investigating': return [make('wait', 'Wait', 'Pause while awaiting an external dependency.', 'secondary'), make('resolve', 'Resolve', 'Mark the verified exception as resolved.', 'primary')];
      case 'waiting': return [make('investigate', 'Resume investigation', 'Return the case to active investigation.', 'primary'), make('resolve', 'Resolve', 'Mark the verified exception as resolved.', 'primary')];
      case 'resolved': return [make('close', 'Close', 'Close a resolved case after final verification.', 'primary'), make('reopen', 'Reopen', 'Reopen because the exception recurred or resolution was incomplete.', 'warning')];
      case 'closed': return [make('reopen', 'Reopen', 'Reopen because the exception recurred or resolution was incomplete.', 'warning')];
    }
  }, [mutate, record]);

  if (loading) return <ProtectedRoute allowedRoles={['owner']}><div style={{ minHeight: '100vh', background: X.light, padding: '18px', color: X.muted, fontSize: '12px' }}>Loading Platform Case…</div></ProtectedRoute>;
  if (error || !record) return <ProtectedRoute allowedRoles={['owner']}><div style={{ minHeight: '100vh', background: X.light, padding: '12px' }}><div role="alert" style={{ border: `1px solid ${X.danger}`, borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '11px' }}>{error ?? 'Platform case not found.'}</div><Link href="/super-admin/action-centre" style={{ display: 'inline-flex', marginTop: '12px', color: X.blue, fontSize: '11px', fontWeight: 800 }}>← Action Centre</Link></div></ProtectedRoute>;

  const sections: PlatformEntitySection[] = [
    { id: 'case-overview', title: 'Case overview', fields: [
      { key: 'severity', label: 'Severity', value: record.severity, tone: record.severity === 'P0' ? 'danger' : record.severity === 'P1' ? 'warning' : 'default' },
      { key: 'status', label: 'Status', value: record.status.replace(/_/g, ' '), tone: ['resolved','closed'].includes(record.status) ? 'success' : 'warning' },
      { key: 'source', label: 'Source', value: record.source }, { key: 'type', label: 'Case type', value: record.case_type },
      { key: 'detected', label: 'Detected', value: new Date(record.detected_at).toLocaleString('en-GB') }, { key: 'updated', label: 'Updated', value: new Date(record.updated_at).toLocaleString('en-GB') },
    ], content: record.description ? <p style={{ margin: 0, color: X.charcoal, fontSize: '11px', lineHeight: 1.5 }}>{record.description}</p> : undefined },
    { id: 'entity', title: 'Affected entity', description: 'The domain entity remains authoritative; the case records investigation and closure.', fields: [
      { key: 'entity-type', label: 'Entity type', value: record.entity_type }, { key: 'entity-label', label: 'Entity', value: <PlatformEntityLink entityType={entityType(record.entity_type)} entityId={record.entity_id}>{record.entity_label}</PlatformEntityLink> },
      { key: 'entity-id', label: 'Stable entity ID', value: record.entity_id, copyValue: record.entity_id }, { key: 'company', label: 'Company ID', value: record.company_id ?? '—', copyValue: record.company_id },
    ] },
    { id: 'metadata', title: 'Case metadata', content: <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '10px', color: X.muted }}>{JSON.stringify(record.metadata ?? {}, null, 2)}</pre> },
  ];

  const auditEntries: PlatformAuditEntry[] = events.map((event) => ({ id: event.id, action: event.event_type.replace(/_/g, ' '), actorLabel: event.actor_label, createdAt: event.created_at, reason: event.reason, before: event.old_status, after: event.new_status, correlationId: record.reference }));

  return <ProtectedRoute allowedRoles={['owner']}>
    <div style={{ background: X.light, minHeight: '100vh' }}>
      <div style={{ padding: '8px 12px 0' }}><Link href="/super-admin/action-centre" style={{ color: X.blue, fontSize: '10px', fontWeight: 800, textDecoration: 'none' }}>← Platform Action Centre</Link></div>
      <PlatformEntityInspector entityType="case" reference={record.reference} title={record.title} subtitle="Persistent Platform Owner exception case." stableId={record.id} status={<span style={{ color: statusTone(record.status), fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{record.status}</span>} sections={sections} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,.8fr) minmax(0,1.2fr)', gap: '12px', padding: '0 12px 16px' }}>
        <PlatformActionPanel actions={actions} onCompleted={() => load()} />
        <PlatformAuditTimeline entries={auditEntries} />
      </div>
    </div>
  </ProtectedRoute>;
}
