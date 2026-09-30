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
const statusColor:Record<PlatformCaseStatus,string> = {open:'#D92D20',acknowledged:'#9A6700',investigating:'#1D57D8',waiting:'#9A6700',resolved:'#168553',closed:'#667085'};
const when = (value:string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}); };
const toLocalInput = (value:string|null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0,16);
};
const toIsoOrNull = (value:string) => value ? new Date(value).toISOString() : null;

type CaseRecord = {
  id:string; reference:string; source:string; case_type:string; severity:'P0'|'P1'|'P2'|'P3'; status:PlatformCaseStatus; title:string; description:string|null;
  entity_type:string; entity_id:string; entity_label:string; company_id:string|null; assigned_to_user_id:string|null; metadata:Record<string,unknown>|null;
  detected_at:string; acknowledged_at:string|null; resolved_at:string|null; closed_at:string|null; created_at:string; updated_at:string;
  sla_due_at:string|null; sla_breached_at:string|null; escalated_at:string|null; escalation_level:number;
  next_action:string|null; next_action_due_at:string|null; customer_update_due_at:string|null; customer_updated_at:string|null; customer_update_note:string|null;
  closure_due_at:string|null; closure_verified_at:string|null; closure_verified_by:string|null; closure_evidence:string|null;
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
  const [savingPlan,setSavingPlan] = useState(false);
  const [nextAction,setNextAction] = useState('');
  const [nextActionDueAt,setNextActionDueAt] = useState('');
  const [customerUpdateDueAt,setCustomerUpdateDueAt] = useState('');
  const [closureDueAt,setClosureDueAt] = useState('');
  const [customerUpdateNote,setCustomerUpdateNote] = useState('');
  const [customerUpdateChannel,setCustomerUpdateChannel] = useState('manual');
  const [closureEvidence,setClosureEvidence] = useState('');
  const [recordingCustomerUpdate,setRecordingCustomerUpdate] = useState(false);
  const [verifyingClosure,setVerifyingClosure] = useState(false);
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
      setNextAction(body.case.next_action ?? '');
      setNextActionDueAt(toLocalInput(body.case.next_action_due_at));
      setCustomerUpdateDueAt(toLocalInput(body.case.customer_update_due_at));
      setClosureDueAt(toLocalInput(body.case.closure_due_at));
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

  const savePlan = async () => {
    if (readOnly) { setFeedback({tone:'danger',message:'Deploy Preview is read-only. No case mutation was attempted.'}); return; }
    setSavingPlan(true); setFeedback(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, {
        method:'PATCH',
        headers:{'Content-Type':'application/json',Authorization:auth},
        body:JSON.stringify({
          action:'plan',
          nextAction:nextAction.trim() || null,
          nextActionDueAt:toIsoOrNull(nextActionDueAt),
          customerUpdateDueAt:toIsoOrNull(customerUpdateDueAt),
          closureDueAt:toIsoOrNull(closureDueAt),
        }),
      });
      const body = await response.json().catch(() => ({})) as {error?:string};
      if (!response.ok) throw new Error(body.error ?? 'Operational plan update failed.');
      setFeedback({tone:'success',message:'Operational plan updated.'});
      await load();
    } catch (cause) { setFeedback({tone:'danger',message:cause instanceof Error ? cause.message : 'Operational plan update failed.'}); }
    finally { setSavingPlan(false); }
  };

  const recordCustomerUpdate = async () => {
    const note = customerUpdateNote.trim();
    if (note.length < 5) { setFeedback({tone:'danger',message:'Customer update evidence must contain at least 5 characters.'}); return; }
    if (readOnly) { setFeedback({tone:'danger',message:'Deploy Preview is read-only. No case mutation was attempted.'}); return; }
    setRecordingCustomerUpdate(true); setFeedback(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:auth},
        body:JSON.stringify({action:'customer_update',customerUpdateNote:note,customerUpdateChannel}),
      });
      const body = await response.json().catch(() => ({})) as {error?:string};
      if (!response.ok) throw new Error(body.error ?? 'Customer update evidence could not be recorded.');
      setCustomerUpdateNote(''); setFeedback({tone:'success',message:'Customer update recorded.'}); await load();
    } catch (cause) { setFeedback({tone:'danger',message:cause instanceof Error ? cause.message : 'Customer update evidence could not be recorded.'}); }
    finally { setRecordingCustomerUpdate(false); }
  };

  const verifyClosure = async () => {
    const evidence = closureEvidence.trim();
    if (evidence.length < 5) { setFeedback({tone:'danger',message:'Closure evidence must contain at least 5 characters.'}); return; }
    if (readOnly) { setFeedback({tone:'danger',message:'Deploy Preview is read-only. No case mutation was attempted.'}); return; }
    setVerifyingClosure(true); setFeedback(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/cases/${encodeURIComponent(caseId)}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:auth},
        body:JSON.stringify({action:'verify_closure',closureEvidence:evidence}),
      });
      const body = await response.json().catch(() => ({})) as {error?:string};
      if (!response.ok) throw new Error(body.error ?? 'Closure verification failed.');
      setClosureEvidence(''); setFeedback({tone:'success',message:'Closure evidence verified.'}); await load();
    } catch (cause) { setFeedback({tone:'danger',message:cause instanceof Error ? cause.message : 'Closure verification failed.'}); }
    finally { setVerifyingClosure(false); }
  };

  return <ProtectedRoute allowedRoles={['owner']}>
    <div className={styles.page}>
      <Link href="/super-admin/action-centre" className={styles.back}>← Platform Action Centre</Link>
      {loading ? <div className={styles.notice}>Loading persistent case…</div> : error || !record ? <div className={styles.notice} data-tone="danger">{error ?? 'Platform case not found.'}</div> : <>
        <header className={styles.header}><div><div className={styles.eyebrow}>{record.reference} · {record.severity}</div><h1 className={styles.title}>{record.title}</h1><p className={styles.description}>Persistent Platform Owner exception case. The affected domain record remains authoritative.</p></div><div className={styles.badges}><span className={styles.badge} style={{color:statusColor[record.status]}}>{record.status.replace(/_/g,' ')}</span>{readOnly ? <span className={styles.badge} data-tone="warning">Deploy Preview · read only</span> : null}</div></header>
        {readOnly ? <div className={styles.notice} data-tone="warning">Inspection only. Semantic lifecycle actions are disabled in Deploy Preview and also fail closed server-side.</div> : null}
        {feedback ? <div className={styles.feedback} data-tone={feedback.tone}>{feedback.message}</div> : null}
        <div className={styles.detailGrid}>
          <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Case record</h2><p className={styles.panelSubtitle}>Stable identity, lifecycle and affected entity.</p></div></div><div className={styles.fields}>
            <DataField label="Severity" value={record.severity}/><DataField label="Status" value={record.status.replace(/_/g,' ')}/><DataField label="Source" value={record.source}/><DataField label="Case type" value={record.case_type}/><DataField label="Detected" value={when(record.detected_at)}/><DataField label="Updated" value={when(record.updated_at)}/><DataField label="SLA due" value={record.sla_due_at ? when(record.sla_due_at) : '—'}/><DataField label="SLA state" value={record.sla_breached_at ? `Breached ${when(record.sla_breached_at)}` : 'Within SLA'}/><DataField label="Escalation" value={record.escalation_level > 0 ? `Level ${record.escalation_level}${record.escalated_at ? ` · ${when(record.escalated_at)}` : ''}` : 'Not escalated'}/><DataField label="Customer update" value={record.customer_update_due_at ? (record.customer_updated_at ? `Completed ${when(record.customer_updated_at)}` : `Due ${when(record.customer_update_due_at)}`) : 'Not required'}/><DataField label="Closure verification" value={record.closure_verified_at ? `Verified ${when(record.closure_verified_at)}` : 'Not verified'}/><DataField label="Case ID" value={record.id}/><DataField label="Company ID" value={record.company_id ?? '—'}/>
          </div>{record.description ? <div className={styles.sectionBody}><strong>Description</strong><div style={{marginTop:5}}>{record.description}</div></div> : null}<div className={styles.sectionBody}><strong>Affected entity</strong><div style={{marginTop:6}}><PlatformEntityLink entityType={entityType(record.entity_type)} entityId={record.entity_id}>{record.entity_label}</PlatformEntityLink></div><div className={styles.muted}>{record.entity_type} · {record.entity_id}</div></div></section>

          <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Semantic lifecycle actions</h2><p className={styles.panelSubtitle}>Only transitions valid for the current state are exposed.</p></div></div><div className={styles.actions}>
            {actions.some((action) => action.requiresReason) ? <label className={styles.field}>Operational reason<textarea className={styles.textarea} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record the reason for this intervention…" disabled={readOnly || Boolean(running)}/></label> : null}
            {actions.map((action) => <div className={styles.actionCard} key={action.id}><div className={styles.actionTitle}>{action.label}</div><div className={styles.actionDescription}>{action.id === 'close' && !record.closure_verified_at ? 'Final closure evidence must be verified before this case can close.' : action.description}</div><button type="button" className={styles.button} disabled={readOnly || Boolean(running) || (action.id === 'close' && !record.closure_verified_at)} onClick={() => void mutate(action)}>{running === action.id ? 'Working…' : action.label}</button></div>)}
          </div></section>
        </div>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Operational plan</h2><p className={styles.panelSubtitle}>Make ownership actionable with explicit next-step and communication/closure deadlines.</p></div></div>
          <div className={styles.actions}>
            <label className={styles.field}>Next action<textarea className={styles.textarea} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="What must happen next?" maxLength={1000} disabled={readOnly || savingPlan}/></label>
            <div className={styles.fields}>
              <label className={styles.field}>Next action due<input className={styles.input} type="datetime-local" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} disabled={readOnly || savingPlan}/></label>
              <label className={styles.field}>Customer update due<input className={styles.input} type="datetime-local" value={customerUpdateDueAt} onChange={(event) => setCustomerUpdateDueAt(event.target.value)} disabled={readOnly || savingPlan}/></label>
              <label className={styles.field}>Verified closure due<input className={styles.input} type="datetime-local" value={closureDueAt} onChange={(event) => setClosureDueAt(event.target.value)} disabled={readOnly || savingPlan}/></label>
            </div>
            <button type="button" className={styles.button} onClick={() => void savePlan()} disabled={readOnly || savingPlan}>{savingPlan ? 'Saving…' : 'Save operational plan'}</button>
          </div>
        </section>
        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Customer communication</h2><p className={styles.panelSubtitle}>Record evidence that the required customer update was completed.</p></div></div>
            <div className={styles.actions}>
              {record.customer_update_due_at ? <div className={styles.actionDescription}>{record.customer_updated_at ? `Completed ${when(record.customer_updated_at)}${record.customer_update_note ? ` · ${record.customer_update_note}` : ''}` : `Update due ${when(record.customer_update_due_at)}`}</div> : <div className={styles.actionDescription}>No customer update obligation is currently recorded.</div>}
              <label className={styles.field}>Update channel<select className={styles.select} value={customerUpdateChannel} onChange={(event) => setCustomerUpdateChannel(event.target.value)} disabled={readOnly || recordingCustomerUpdate}><option value="manual">Manual</option><option value="email">Email</option><option value="phone">Phone</option><option value="sms">SMS</option><option value="platform">Platform message</option></select></label>
              <label className={styles.field}>Update evidence<textarea className={styles.textarea} value={customerUpdateNote} onChange={(event) => setCustomerUpdateNote(event.target.value)} placeholder="What was communicated, to whom and what recovery/ETA was confirmed?" maxLength={5000} disabled={readOnly || recordingCustomerUpdate}/></label>
              <button type="button" className={styles.button} onClick={() => void recordCustomerUpdate()} disabled={readOnly || recordingCustomerUpdate}>{recordingCustomerUpdate ? 'Recording…' : 'Record customer update'}</button>
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Verified closure</h2><p className={styles.panelSubtitle}>A resolved case cannot close until final closure evidence is verified.</p></div></div>
            <div className={styles.actions}>
              <div className={styles.actionDescription}>{record.closure_verified_at ? `Verified ${when(record.closure_verified_at)}${record.closure_evidence ? ` · ${record.closure_evidence}` : ''}` : record.status === 'resolved' ? 'Resolution is recorded; final closure evidence is still required.' : 'Resolve the case before final closure verification.'}</div>
              <label className={styles.field}>Closure evidence<textarea className={styles.textarea} value={closureEvidence} onChange={(event) => setClosureEvidence(event.target.value)} placeholder="State the evidence that proves the operational exception is fully closed." maxLength={5000} disabled={readOnly || verifyingClosure || record.status !== 'resolved'}/></label>
              <button type="button" className={styles.button} onClick={() => void verifyClosure()} disabled={readOnly || verifyingClosure || record.status !== 'resolved' || Boolean(record.closure_verified_at)}>{verifyingClosure ? 'Verifying…' : record.closure_verified_at ? 'Closure verified' : 'Verify closure evidence'}</button>
            </div>
          </section>
        </div>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2 className={styles.panelTitle}>Audit timeline</h2><p className={styles.panelSubtitle}>Append-only case lifecycle events with actor and reason evidence.</p></div><span className={styles.count}>{events.length} events</span></div>{events.length === 0 ? <div className={styles.empty}>No case lifecycle events recorded.</div> : <ol className={styles.timeline}>{events.map((event) => <li className={styles.event} key={event.id}><div className={styles.eventHead}><span className={styles.eventAction}>{event.event_type.replace(/_/g,' ')}</span><span className={styles.eventTime}>{when(event.created_at)}</span></div><div className={styles.eventMeta}>by {event.actor_label}{event.reason ? ` · ${event.reason}` : ''}</div>{event.old_status || event.new_status ? <div className={styles.stateChange}>{event.old_status ?? '—'} → {event.new_status ?? '—'}</div> : null}</li>)}</ol>}</section>
      </>}
    </div>
  </ProtectedRoute>;
}

function DataField({label,value}:{label:string;value:string}) { return <div className={styles.dataField}><div className={styles.fieldLabel}>{label}</div><div className={styles.fieldValue}>{value}</div></div>; }
