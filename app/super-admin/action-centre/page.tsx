'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import type { PlatformCaseStatus, PlatformEntityType } from '@/app/super-admin/_components/control-plane/types';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import styles from './actionCentre.module.css';

const ENTITY_TYPES = new Set<PlatformEntityType>(['job','company','user','driver','vehicle','invoice','pod','ticket','dispute','notification','health_check','case']);
const entityType = (value: string): PlatformEntityType => ENTITY_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : 'case';
const severityColor: Record<'P0'|'P1'|'P2'|'P3', string> = { P0:'#DC2626', P1:'#B45309', P2:'#1D57D8', P3:'#64748B' };
const statusColor: Record<PlatformCaseStatus, string> = { open:'#DC2626', acknowledged:'#B45309', investigating:'#1D57D8', waiting:'#B45309', resolved:'#15803D', closed:'#64748B' };
const when = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}); };

type ApiCaseRow = {
  id:string; reference:string; severity:'P0'|'P1'|'P2'|'P3'; status:PlatformCaseStatus; title:string; description:string|null;
  entity_type:string; entity_id:string; entity_label:string; assigned_to_label:string|null; detected_at:string; updated_at:string;
};
type CasesPayload = { available?:boolean; readOnly?:boolean; rows?:ApiCaseRow[]; note?:string; pagination?:{total?:number}; error?:string };

export default function Page() {
  const router = useRouter();
  const [cases,setCases] = useState<ApiCaseRow[]>([]);
  const [available,setAvailable] = useState<boolean|null>(null);
  const [readOnly,setReadOnly] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [note,setNote] = useState<string|null>(null);
  const [status,setStatus] = useState('active');
  const [severity,setSeverity] = useState('ALL');
  const [assignee,setAssignee] = useState('all');
  const [query,setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null); setNote(null); setAvailable(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setCases([]); setError('No active Platform Owner session.'); return; }
      const params = new URLSearchParams({ limit:'100', status });
      if (severity !== 'ALL') params.set('severity',severity);
      if (assignee !== 'all') params.set('assignee',assignee);
      const response = await fetch(`/api/super-admin/cases?${params.toString()}`, { headers:{Authorization:auth}, cache:'no-store' });
      const body = await response.json().catch(() => ({})) as CasesPayload;
      setReadOnly(Boolean(body.readOnly));
      if (!response.ok) { setCases([]); setError(body.error ?? 'Platform Case Centre is unavailable.'); return; }
      if (body.available === false) { setCases([]); setAvailable(false); setNote(body.note ?? 'Platform Case Centre schema is unavailable.'); return; }
      setAvailable(true); setCases(body.rows ?? []);
    } catch { setCases([]); setError('Platform Case Centre is unavailable.'); }
    finally { setLoading(false); }
  },[assignee,severity,status]);

  useEffect(() => { void load(); },[load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => [item.reference,item.title,item.description ?? '',item.entity_label,item.assigned_to_label ?? ''].some((value) => value.toLowerCase().includes(q)));
  },[cases,query]);

  const summary = useMemo(() => ({
    visible: visible.length,
    high: visible.filter((item) => item.severity === 'P0' || item.severity === 'P1').length,
    unassigned: visible.filter((item) => !item.assigned_to_label).length,
    waiting: visible.filter((item) => item.status === 'waiting').length,
  }),[visible]);

  return <ProtectedRoute allowedRoles={['owner']}>
    <div className={styles.page}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>Support & Cases</div><h1 className={styles.title}>Platform Action Centre</h1><p className={styles.description}>Persistent cross-domain exception cases for Platform Owner triage, investigation and verified closure. Domain records remain authoritative.</p></div>
        <div className={styles.badges}><span className={styles.badge}>Case Centre · SA-02</span>{readOnly ? <span className={styles.badge} data-tone="warning">Deploy Preview · read only</span> : null}</div>
      </header>

      {available === true ? <div className={styles.metrics}>
        <Metric label="Visible cases" value={summary.visible}/><Metric label="P0 / P1 visible" value={summary.high}/><Metric label="Unassigned visible" value={summary.unassigned}/><Metric label="Waiting visible" value={summary.waiting}/>
      </div> : null}

      {readOnly ? <div className={styles.notice} data-tone="warning">This Deploy Preview is inspection-only. Case mutations are disabled server-side.</div> : null}
      {note ? <div className={styles.notice} data-tone="warning">{note} No zero-valued registry metrics are inferred.</div> : null}
      {error ? <div className={styles.notice} data-tone="danger"><strong>Service unavailable.</strong> {error}</div> : null}

      <section className={styles.filters} aria-label="Action Centre filters">
        <label className={styles.field}>Status<select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value)} disabled={loading || available === false}><option value="active">Active</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="investigating">Investigating</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option></select></label>
        <label className={styles.field}>Severity<select className={styles.select} value={severity} onChange={(event) => setSeverity(event.target.value)} disabled={loading || available === false}><option value="ALL">All</option><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option></select></label>
        <label className={styles.field}>Ownership<select className={styles.select} value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={loading || available === false}><option value="all">All owners</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option></select></label>
        <label className={styles.field}>Search<input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, title, entity or owner" disabled={available === false}/></label>
        <button type="button" className={styles.button} onClick={() => void load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Platform Case Centre</h2><p className={styles.panelSubtitle}>Human-owned exceptions with semantic lifecycle and durable event history.</p></div><span className={styles.count}>{loading ? 'Loading' : `${visible.length} visible`}</span></div>
        {loading ? <div className={styles.empty}>Loading persistent cases…</div> : available === false ? <div className={styles.empty}>Persistent case registry is not applied in this environment.</div> : visible.length === 0 ? <div className={styles.empty}>No persistent cases match the current filters.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Severity</th><th>Case</th><th>Entity</th><th>Status</th><th>Owner</th><th>Updated</th><th></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}>
          <td><span className={styles.severity} style={{color:severityColor[item.severity]}}>{item.severity}</span></td>
          <td><div className={styles.caseTitle}>{item.reference} · {item.title}</div>{item.description ? <div className={styles.muted}>{item.description}</div> : null}</td>
          <td><PlatformEntityLink compact entityType={entityType(item.entity_type)} entityId={item.entity_id}>{item.entity_label}</PlatformEntityLink></td>
          <td><span className={styles.status} style={{color:statusColor[item.status]}}>{item.status.replace(/_/g,' ')}</span></td>
          <td>{item.assigned_to_label ?? 'Unassigned'}</td><td>{when(item.updated_at)}</td><td><button type="button" className={styles.buttonSecondary} onClick={() => router.push(`/super-admin/action-centre/${item.id}`)}>Open case</button></td>
        </tr>)}</tbody></table></div>}
      </section>
    </div>
  </ProtectedRoute>;
}

function Metric({label,value}:{label:string;value:number}) { return <div className={styles.metric}><div className={styles.metricValue}>{value}</div><div className={styles.metricLabel}>{label}</div></div>; }
