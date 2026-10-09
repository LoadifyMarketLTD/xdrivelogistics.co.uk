'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isExecutionStage, normalizedJobStatus } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import { JobOperationalExceptionsPanel } from '../../components/workspace/JobOperationalExceptionsPanel';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

const exceptionStatuses = new Set(['cancelled','failed','exception','disputed','collection_failed','delivery_failed','damaged','breakdown']);

type ExceptionRow = {
  id: string;
  job_id: string;
  company_id: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'monitoring' | 'resolved';
  description: string;
  occurred_at: string;
  resolution_note: string | null;
  resolved_at: string | null;
  job: { id: string; pickup_location: string | null; pickup_postcode: string | null; delivery_location: string | null; delivery_postcode: string | null; current_status: string | null; status: string | null } | null;
};

const when=(value:string|null|undefined)=>value?new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Not set';
const human=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());

export default function IncidentsPage(){
  const data=useCompanyWorkspaceData();
  const router=useRouter();
  const [exceptions,setExceptions]=useState<ExceptionRow[]>([]);
  const [loadingExceptions,setLoadingExceptions]=useState(false);
  const [exceptionError,setExceptionError]=useState('');
  const [selectedJobId,setSelectedJobId]=useState('');

  const derivedRows=useMemo(()=>data.jobs.map((job)=>{
    const status=normalizedJobStatus(job);
    const overdue=isExecutionStage(job)&&Boolean(job.delivery_datetime)&&new Date(job.delivery_datetime??0).getTime()<Date.now();
    return {job,status,overdue};
  }).filter(({status,overdue})=>exceptionStatuses.has(status)||overdue),[data.jobs]);

  const loadExceptions=useCallback(async()=>{
    if(!data.companyId){setExceptions([]);return;}
    setLoadingExceptions(true); setExceptionError('');
    const {data:session}=await supabase.auth.getSession();
    const token=session.session?.access_token;
    if(!token){setLoadingExceptions(false);setExceptionError('Session expired.');return;}
    const response=await fetch(`/api/workspace/exceptions?companyId=${encodeURIComponent(data.companyId)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    const payload=await response.json().catch(()=>({})) as {exceptions?:ExceptionRow[];error?:string};
    setLoadingExceptions(false);
    if(!response.ok){setExceptionError(payload.error??'Operational exceptions could not be loaded.');return;}
    setExceptions(payload.exceptions??[]);
  },[data.companyId]);

  useEffect(()=>{void loadExceptions();},[loadExceptions]);
  useEffect(()=>{if(!selectedJobId){const first=exceptions[0]?.job_id??derivedRows[0]?.job.id??'';if(first)setSelectedJobId(first);}},[derivedRows,exceptions,selectedJobId]);

  const openCount=exceptions.filter((row)=>row.status!=='resolved').length;
  const criticalCount=exceptions.filter((row)=>row.status!=='resolved'&&row.severity==='critical').length;

  return <PageFrame>
    <PageHeader eyebrow="Operational exceptions" title="Incidents" description="Operational exceptions are execution facts such as delay, breakdown, failed collection/delivery or damage. Formal commercial disagreements remain in Disputes." actions={<><ActionButton tone="secondary" disabled={loadingExceptions} onClick={()=>void loadExceptions()}>{loadingExceptions?'Refreshing…':'Refresh'}</ActionButton><ActionButton tone="secondary" onClick={()=>router.push('/admin/disputes')}>Open Disputes</ActionButton></>} />
    {data.error?<AlertBanner>{data.error}</AlertBanner>:null}
    {exceptionError?<AlertBanner tone="danger">{exceptionError}</AlertBanner>:null}
    <KpiGrid><KpiCard label="Open recorded exceptions" value={openCount} tone="red"/><KpiCard label="Critical open" value={criticalCount} tone="red"/><KpiCard label="Derived operational signals" value={derivedRows.length} tone="orange"/></KpiGrid>

    <Panel title="Recorded operational exceptions" description="Persistent execution exceptions. Resolving an exception does not resolve or close a commercial dispute.">
      <DataTable columns={['Job','Category','Severity','Status','Occurred','Issue','Action']} rows={exceptions.map((row)=>[
        <strong key="job">{row.job_id.slice(0,8).toUpperCase()}</strong>,
        human(row.category),
        <StatusBadge key="severity" value={row.severity} tone={row.severity==='critical'?'red':row.severity==='warning'?'orange':'blue'}/>,
        <StatusBadge key="status" value={row.status} tone={row.status==='resolved'?'green':row.status==='monitoring'?'orange':'red'}/>,
        when(row.occurred_at),
        row.description,
        <ActionButton key="manage" tone="secondary" onClick={()=>setSelectedJobId(row.job_id)}>Manage</ActionButton>,
      ])} empty={<EmptyState title={loadingExceptions?'Loading exceptions…':'No recorded operational exceptions'} description="Operational exceptions recorded from booking details or this register appear here."/>}/>
    </Panel>

    <Panel title="Derived operational signals" description="Compatibility view from existing job states and overdue execution. These signals are not automatically formal disputes." style={{marginTop:12}}>
      <DataTable columns={['Job','Route','Planned delivery','Signal','Updated','Action']} rows={derivedRows.map(({job,status,overdue})=>[
        job.id.slice(0,8).toUpperCase(),
        <strong key="route">{job.pickup_location??'Collection'} → {job.delivery_location??'Delivery'}</strong>,
        when(job.delivery_datetime),
        <StatusBadge key="status" value={overdue&&!exceptionStatuses.has(status)?'delivery overdue':status} tone={overdue?'red':'orange'}/>,
        when(job.updated_at),
        <ActionButton key="action" tone="secondary" onClick={()=>setSelectedJobId(job.id)}>Record / Manage Exception</ActionButton>,
      ])} empty={<EmptyState title="No derived operational signals" description="Failed, cancelled, disputed or overdue execution jobs appear here without being converted into formal disputes."/>}/>
    </Panel>

    <Panel title="Report / manage booking exception" description="Choose any booking in company scope. This register is deliberately separate from commercial Disputes." style={{marginTop:12}}>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:8}}><select value={selectedJobId} onChange={(event)=>setSelectedJobId(event.target.value)} style={{minWidth:260}}><option value="">Choose booking</option>{data.jobs.map((job)=><option key={job.id} value={job.id}>{job.id.slice(0,8).toUpperCase()} · {job.pickup_postcode??job.pickup_location??'Collection'} → {job.delivery_postcode??job.delivery_location??'Delivery'}</option>)}</select>{selectedJobId?<ActionButton tone="secondary" onClick={()=>router.push(`/admin/jobs/${encodeURIComponent(selectedJobId)}`)}>Open booking</ActionButton>:null}</div>
      {selectedJobId?<JobOperationalExceptionsPanel jobId={selectedJobId} companyId={data.companyId}/>:<EmptyState compact title="Choose a booking to manage operational exceptions"/>}
    </Panel>
  </PageFrame>;
}
