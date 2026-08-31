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

const ENTITY_TYPES = new Set<PlatformEntityType>(['job', 'company', 'user', 'driver', 'vehicle', 'invoice', 'pod', 'ticket', 'dispute', 'notification', 'health_check', 'case']);

function entityType(value: string): PlatformEntityType {
  return ENTITY_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : 'case';
}

type ApiCaseRow = {
  id: string;
  reference: string;
  severity: PlatformCaseSummary['severity'];
  status: PlatformCaseStatus;
  title: string;
  description: string | null;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  assigned_to_label: string | null;
  detected_at: string;
  updated_at: string;
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
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('ALL');
  const [assignee, setAssignee] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNote(null);
    setAvailable(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const params = new URLSearchParams({ limit: '100', status });
      if (severity !== 'ALL') params.set('severity', severity);
      if (assignee !== 'all') params.set('assignee', assignee);
      const res = await fetch(`/api/super-admin/cases?${params.toString()}`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({})) as CasesPayload & { error?: string };
      if (!res.ok) {
        setCases([]);
        setError(body.error ?? 'Platform Case Centre is unavailable.');
        return;
      }
      if (body.available === false) {
        setCases([]);
        setAvailable(false);
        setNote(body.note ?? 'Platform Case Centre schema is unavailable.');
        return;
      }
      setAvailable(true);
      setCases((body.rows ?? []).map((row): PlatformCaseSummary => ({
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
      setCases([]);
      setError('Platform Case Centre is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [assignee, severity, status]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => available === true ? ({
    p0: cases.filter((item) => item.severity === 'P0').length,
    p1: cases.filter((item) => item.severity === 'P1').length,
    unassigned: cases.filter((item) => !item.assignedToLabel).length,
    investigating: cases.filter((item) => item.status === 'investigating').length,
  }) : null, [available, cases]);

  return <ProtectedRoute allowedRoles={['owner']}>
    <div className="sa-page">
      <header className="sa-page-header">
        <div className="sa-heading-row">
          <span aria-hidden="true" className="sa-page-icon">⚠</span>
          <div className="sa-page-heading">
            <div className="sa-eyebrow">Platform control plane <span className="sa-section-pill">Support</span></div>
            <h1 className="sa-page-title">Platform Action Centre</h1>
            <p className="sa-page-description">Persistent cross-domain exceptions with ownership, investigation and auditable closure.</p>
          </div>
        </div>
        <div className="sa-page-actions">
          <button type="button" className="sa-primary-button" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>
      </header>

      {note ? <div className="sa-state-block" data-tone="warning">{note}</div> : null}
      {error ? <div className="sa-state-block" data-tone="danger"><strong>Service temporarily unavailable</strong><div style={{ marginTop: 3 }}>{error}</div></div> : null}

      {loading ? (
        <div className="sa-state-block" data-tone="info">Loading persistent case summary…</div>
      ) : available === true && summary ? (
        <div className="sa-metric-grid">
          {[
            ['P0', summary.p0],
            ['P1', summary.p1],
            ['Unassigned', summary.unassigned],
            ['Investigating', summary.investigating],
          ].map(([label, value]) => (
            <div key={String(label)} className="sa-metric-card">
              <div className="sa-metric-value">{value}</div>
              <div className="sa-metric-label">{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sa-state-block" data-tone="warning">Persistent case counts are unavailable in this environment. No P0/P1/unassigned/investigating zeroes are inferred.</div>
      )}

      <section className="sa-filter-bar" aria-label="Action Centre filters">
        <label className="sa-filter-label">Status
          <select className="sa-filter-select" value={status} onChange={(event) => setStatus(event.target.value)} disabled={available === false}>
            <option value="active">Active cases</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="investigating">Investigating</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="sa-filter-label">Severity
          <select className="sa-filter-select" value={severity} onChange={(event) => setSeverity(event.target.value)} disabled={available === false}>
            <option value="ALL">All</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>
        <label className="sa-filter-label">Ownership
          <select className="sa-filter-select" value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={available === false}>
            <option value="all">All</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
      </section>

      {available === false && !error ? (
        <section className="sa-panel">
          <div className="sa-empty">Case registry is unavailable until the SA-02 schema is applied. No empty registry is fabricated.</div>
        </section>
      ) : (
        <PlatformCaseCentre
          cases={cases}
          loading={loading}
          error={error}
          onOpenCase={(caseId) => router.push(`/super-admin/action-centre/${caseId}`)}
        />
      )}
    </div>
  </ProtectedRoute>;
}
