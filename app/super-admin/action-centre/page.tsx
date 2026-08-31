'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  PlatformCaseCentre,
  type PlatformCaseStatus,
  type PlatformCaseSummary,
  type PlatformEntityType,
} from '@/app/super-admin/_components/control-plane';

const X = { navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', orange: '#F5A300' } as const;
const ENTITY_TYPES = new Set<PlatformEntityType>(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute', 'notification', 'health_check', 'case']);

function entityType(value: string): PlatformEntityType {
  return ENTITY_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : 'case';
}

type ApiCaseRow = {
  id: string; reference: string; severity: PlatformCaseSummary['severity']; status: PlatformCaseStatus;
  title: string; description: string | null; entity_type: string; entity_id: string; entity_label: string;
  assigned_to_label: string | null; detected_at: string; updated_at: string;
};

type CasesPayload = {
  available?: boolean;
  rows?: ApiCaseRow[];
  note?: string;
  pagination?: { total?: number };
};

export default function Page() {
  const router = useRouter();
  const [cases, setCases] = useState<PlatformCaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('ALL');
  const [assignee, setAssignee] = useState('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null); setNote(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const params = new URLSearchParams({ limit: '100', status });
      if (severity !== 'ALL') params.set('severity', severity);
      if (assignee !== 'all') params.set('assignee', assignee);
      const res = await fetch(`/api/super-admin/cases?${params.toString()}`, { headers: { Authorization: auth } });
      const body = await res.json().catch(() => ({})) as CasesPayload & { error?: string };
      if (!res.ok) { setError(body.error ?? 'Platform Case Centre is unavailable.'); return; }
      if (body.available === false) { setCases([]); setNote(body.note ?? 'Platform Case Centre schema is unavailable.'); return; }
      const rows = body.rows ?? [];
      setCases(rows.map((row): PlatformCaseSummary => ({
        id: row.id,
        reference: row.reference,
        title: row.title,
        description: row.description,
        severity: row.severity,
        status: row.status,
        entityType: entityType(row.entity_type),
        entityId: row.entity_id,
        entityLabel: row.entity_label,
        assignedToLabel: row.assigned_to_label,
        detectedAt: row.detected_at,
        updatedAt: row.updated_at,
      })));
    } catch {
      setError('Platform Case Centre is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [assignee, severity, status]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => ({
    p0: cases.filter((item) => item.severity === 'P0').length,
    p1: cases.filter((item) => item.severity === 'P1').length,
    unassigned: cases.filter((item) => !item.assignedToLabel).length,
    investigating: cases.filter((item) => item.status === 'investigating').length,
  }), [cases]);

  return <ProtectedRoute allowedRoles={['owner']}>
    <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
      <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: X.navy, fontSize: '20px', fontWeight: 800 }}>Platform Action Centre</h1>
          <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>Persistent cross-domain exceptions with ownership, investigation and auditable closure.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${X.blue}`, background: X.blue, color: X.white, fontSize: '11px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>Refresh</button>
      </header>

      {note ? <div style={{ marginBottom: '12px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '9px 12px', color: X.charcoal, fontSize: '11px' }}>{note}</div> : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '12px', marginBottom: '12px' }}>
        {[['P0', summary.p0], ['P1', summary.p1], ['Unassigned', summary.unassigned], ['Investigating', summary.investigating]].map(([label, value]) => <div key={String(label)} style={{ minHeight: '72px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '10px 12px' }}><div style={{ color: X.navy, fontSize: '20px', fontWeight: 800 }}>{value}</div><div style={{ marginTop: '5px', color: X.muted, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div></div>)}
      </section>

      <section style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white }}>
        <label style={filterLabel}>Status<select value={status} onChange={(event) => setStatus(event.target.value)} style={selectStyle}><option value="active">Active cases</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="investigating">Investigating</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option></select></label>
        <label style={filterLabel}>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)} style={selectStyle}><option value="ALL">All</option><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option></select></label>
        <label style={filterLabel}>Ownership<select value={assignee} onChange={(event) => setAssignee(event.target.value)} style={selectStyle}><option value="all">All</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option></select></label>
      </section>

      <PlatformCaseCentre cases={cases} loading={loading} error={error} onOpenCase={(caseId) => router.push(`/super-admin/action-centre/${caseId}`)} />
    </div>
  </ProtectedRoute>;
}

const filterLabel = { display: 'flex', alignItems: 'center', gap: '5px', color: X.muted, fontSize: '10px', fontWeight: 800 } as const;
const selectStyle = { height: '32px', borderRadius: '4px', border: `1px solid ${X.border}`, background: X.white, color: X.charcoal, padding: '0 8px', fontSize: '10px' } as const;
