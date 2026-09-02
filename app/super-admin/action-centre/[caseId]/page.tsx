'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import type { PlatformCaseStatus, PlatformEntityType } from '@/app/super-admin/_components/control-plane/types';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import styles from '../actionCentre.module.css';

const ENTITY_TYPES = new Set<PlatformEntityType>(['job','company','user','driver','vehicle','invoice','pod','ticket','dispute','notification','health_check','case']);
const entityType = (value:string):PlatformEntityType => ENTITY_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : 'case';
const statusColor:Record<PlatformCaseStatus,string> = {open:'#DC2626',acknowledged:'#B45309',investigating:'#1D57D8',waiting:'#B45309',resolved:'#15803D',closed:'#64748B'};
const when = (value:string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}); };

type CaseRecord = {
  id:string; reference:string; source:string; case_type:string; severity:'P0'|'P1'|'P2'|'P3'; status:PlatformCaseStatus; title:string; description:string|null;
  entity_type:string; entity_id:string; entity_label:string; company_id:string|null; assigned_to_user_id:string|null; metadata:Record<string,unknown>|null;
  detected_at:string; acknowledged_at:string|null; resolved_at:string|null; closed_at:string|null; created_at:string; updated_at:string;
};
type EventRecord = { id:string; event_type:string; actor_label:string; old_status:string|null; new_status:string|null; reason:string|null; created_at:string };
type DetailPayload = { case?:CaseRecord; events?:EventRecord[]; readOnly?:boolean; error?:string };
type CaseAction = 'acknowledge'|'investigate'|'wait'|'resolve'|'close'|'reopen';

type ActionDefinition = { id:CaseAction; label:string; description:string; requiresReason:boolean };
const actionsFor = (status:PlatformCaseStatus):ActionDefinition[] => {
  if (status === 'open') return [
    {id:'acknowledge',label:'Acknowledge',description:'Take ownership of this detected exception.',requiresReason:false},
    {id:'investigate',label:'Investigate',description:'Move the case directly into active investigation.',requiresReason:true},
  ];
  if (status === 'acknowledged') return [
    {id:'investigate',label:'Investigate',description:'Begin active investigation.',requiresReason:true},
    {id:'wait',label:'Place on hold',description:'Wait for an external dependency.',requiresReason:true},
    {id:'resolve',label:'Resolve',description:'Record verified resolution.',requiresReason:true},
  ];
  if (status === 'investigating') return [
    {id:'wait',label:'Place on hold',description:'Wait for an external dependency.',requiresReason:true},
    {id:'resolve',label:'Resolve',description:'Record verified resolution.',requiresReason:true},
  ];
  if (status === 'waiting') return [
    {id:'investigate',label:'Resume investigation',description:'Return the case to active investigation.',requiresReason:true},
    {id:'resolve',label:'Resolve',description:'Record verified resolution.',requiresReason:true},
  ];
  if (status === 'resolved') return [
    {id:'close',label:'Close',description:'Close after final verification.',requiresReason:true},
    {id:'reopen',label:'Reopen',description:'Reopen because resolution is incomplete or the issue recurred.',requiresReason:true},
  ];
  return [{id:'reopen',label:'Reopen',description:'Reopen because the issue recurred.',requiresReason:true}];
};

export default function Page() {
  const params = useParams<{caseId:string}>();
  const caseId = String(params?.caseId ?? '');
  const [record,setRecord] = useState<CaseRecord|null>(null);
  const [events,setEvents] = useState<EventRecord[]>([]);
  const [readOnly,setReadOnly] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [reason,setReason] = useState('');
  const [running,setRunning] = useState<CaseAction|null>(null);
  const [feedback,setFeedback] = useState<{tone:'success'|'danger';message:string}|null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, {headers:{Authorization:auth},cache:'no-store'});
      const body = await response.json().catch(() => ({})) as DetailPayload;
      if (!response.ok || !body.case) { setError(body.error ?? 'Platform case is unavailable.'); return; }
      setRecord(body.case); setEvents(body.events ?? []); setReadOnly(Boolean(body.readOnly));
    } catch { setError('Platform case is unavailable.'); }
    finally { setLoading(false); }
  },[caseId]);

  useEffect(() => { void load(); },[load]);
  const actions = useMemo(() => record ? actionsFor(record.status) : [],[record]);

  const mutate = async (action:ActionDefinition) => {
    const normalizedReason = reason.trim();
    if (readOnly) { setFeedback({tone:'danger',message:'Deploy Preview is read-only. No case mutation was attempted.'}); return; }
    if (action.requiresReason && normalizedReason.length < 5) { setFeedback({tone:'danger',message:'A clear reason of at least 5 characters is required.'}); return; }
    if (!window.confirm(`Confirm ${action.label.toLowerCase()} for ${record?.reference ?? 'this case'}?`)) return;
    setRunning(action.id); setFeedback(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, {method:'PATCH',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({action:action.id,reason:normalizedReason || undefined})});
      const body = await response.json().catch(() => ({})) as {error?:string};
      if (!response.ok) throw new Error(body.error ?? 'Case action failed.');
      setReason(''); setFeedback({tone:'success',message:`${action.label} completed.`}); await load();
    } catch (cause) { setFeedback({tone:'danger',message:cause instanceof Error ? cause.message : 'Case action failed.'}); }
    finally { setRunning(null); }
  };

  return <ProtectedRoute allowedRoles={['owner']}>
    <div className={styles.page}>
      <Link href="/super-admin/action-centre" className={styles.back}>← Platform Action Centre</Link>
      {loading ? <div className={styles.notice}>Loading persistent case…</div> : error || !record ? <div className={styles.notice} data-tone="danger">{error ?? 'Platform case not found.'}</div> : <>
        <header className={styles.header}><div><div className={styles.eyebrow}>{record.reference} · {record.severity}</div><h1 className={styles.title}>{record.title}</h1><p className={styles.description}>Persistent Platform Owner exception case. The affected domain record remains authoritative.</p></div><div className={styles.badges}><span className={styles.badge} style={{color:statusColor[record.status]}}>{record.status.replace(/_/g,' ')}</span>{readOnly ? <span className={styles.badge} data-tone="warning">Deploy Preview · read only</span> : null}</div></header>
        {readOnly ? <div className={styles.notice} data-tone="warning">Inspection only. Semantic lifecycle actions are disabled in Deploy Preview and also fail closed server-side.</div> : null}
        <div className={styles.detailGrid}>
          <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Case record</h2><p className={styles.panelSubtitle}>Stable identity, lifecycle and affected entity.</p></div></div><div className={styles.fields}>
            <DataField label="Severity" value={record.severity}/><DataField label="Status" value={record.status.replace(/_/g,' ')}/><DataField label="Source" value={record.source}/><DataField label="Case type" value={record.case_type}/><DataField label="Detected" value={when(record.detected_at)}/><DataField label="Updated" value={when(record.updated_at)}/><DataField label="Case ID" value={record.id}/><DataField label="Company ID" value={record.company_id ?? '—'}/>
          </div>{record.description ? <div className={styles.sectionBody}><strong>Description</strong><div style={{marginTop:5}}>{record.description}</div></div> : null}<div className={styles.sectionBody}><strong>Affected entity</strong><div style={{marginTop:6}}><PlatformEntityLink entityType={entityType(record.entity_type)} entityId={record.entity_id}>{record.entity_label}</PlatformEntityLink></div><div className={styles.muted}>{record.entity_type} · {record.entity_id}</div></div></section>

          <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Semantic lifecycle actions</h2><p className={styles.panelSubtitle}>Only transitions valid for the current state are exposed.</p></div></div><div className={styles.actions}>
            {feedback ? <div className={styles.feedback} data-tone={feedback.tone}>{feedback.message}</div> : null}
            {actions.some((action) => action.requiresReason) ? <label className={styles.field}>Operational reason<textarea className={styles.textarea} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record the reason for this intervention…" disabled={readOnly || Boolean(running)}/></label> : null}
            {actions.map((action) => <div className={styles.actionCard} key={action.id}><div className={styles.actionTitle}>{action.label}</div><div className={styles.actionDescription}>{action.description}</div><button type="button" className={styles.button} disabled={readOnly || Boolean(running)} onClick={() => void mutate(action)}>{running === action.id ? 'Working…' : action.label}</button></div>)}
          </div></section>
        </div>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Audit timeline</h2><p className={styles.panelSubtitle}>Append-only case lifecycle events with actor and reason evidence.</p></div><span className={styles.count}>{events.length} events</span></div>{events.length === 0 ? <div className={styles.empty}>No case lifecycle events recorded.</div> : <ol className={styles.timeline}>{events.map((event) => <li className={styles.event} key={event.id}><div className={styles.eventHead}><span className={styles.eventAction}>{event.event_type.replace(/_/g,' ')}</span><span className={styles.eventTime}>{when(event.created_at)}</span></div><div className={styles.eventMeta}>by {event.actor_label}{event.reason ? ` · ${event.reason}` : ''}</div>{event.old_status || event.new_status ? <div className={styles.stateChange}>{event.old_status ?? '—'} → {event.new_status ?? '—'}</div> : null}</li>)}</ol>}</section>
      </>}
    </div>
  </ProtectedRoute>;
}

function DataField({label,value}:{label:string;value:string}) { return <div className={styles.dataField}><div className={styles.fieldLabel}>{label}</div><div className={styles.fieldValue}>{value}</div></div>; }
