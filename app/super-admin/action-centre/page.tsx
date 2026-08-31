'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download, Info, Search, ShieldAlert } from 'lucide-react';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  PlatformCaseCentre,
  type PlatformCaseStatus,
  type PlatformCaseSummary,
  type PlatformEntityType,
} from '@/app/super-admin/_components/control-plane';

const ENTITY_TYPES = new Set<PlatformEntityType>(['job','company','user','driver','vehicle','invoice','pod','ticket','dispute','notification','health_check','case']);
const entityType = (value:string):PlatformEntityType => ENTITY_TYPES.has(value as PlatformEntityType) ? value as PlatformEntityType : 'case';

type ApiCaseRow={id:string;reference:string;severity:PlatformCaseSummary['severity'];status:PlatformCaseStatus;title:string;description:string|null;entity_type:string;entity_id:string;entity_label:string;assigned_to_label:string|null;detected_at:string;updated_at:string};
type CasesPayload={available?:boolean;rows?:ApiCaseRow[];note?:string;pagination?:{total?:number}};

export default function Page(){
  const router=useRouter();
  const [cases,setCases]=useState<PlatformCaseSummary[]>([]);
  const [available,setAvailable]=useState<boolean|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [note,setNote]=useState<string|null>(null);
  const [status,setStatus]=useState('active');
  const [severity,setSeverity]=useState('ALL');
  const [assignee,setAssignee]=useState('all');
  const [query,setQuery]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError(null);setNote(null);setAvailable(null);
    try{
      const auth=await getAuthHeader();
      if(!auth){setError('No active Platform Owner session.');return;}
      const params=new URLSearchParams({limit:'100',status});
      if(severity!=='ALL')params.set('severity',severity);
      if(assignee!=='all')params.set('assignee',assignee);
      const res=await fetch(`/api/super-admin/cases?${params.toString()}`,{headers:{Authorization:auth},cache:'no-store'});
      const body=await res.json().catch(()=>({})) as CasesPayload&{error?:string};
      if(!res.ok){setCases([]);setError(body.error??'Platform Case Centre is unavailable.');return;}
      if(body.available===false){setCases([]);setAvailable(false);setNote(body.note??'Platform Case Centre schema is unavailable.');return;}
      setAvailable(true);
      setCases((body.rows??[]).map((row):PlatformCaseSummary=>({id:row.id,reference:row.reference,title:row.title,description:row.description,severity:row.severity,status:row.status,entityType:entityType(row.entity_type),entityId:row.entity_id,entityLabel:row.entity_label,assignedToLabel:row.assigned_to_label,detectedAt:row.detected_at,updatedAt:row.updated_at})));
    }catch{setCases([]);setError('Platform Case Centre is unavailable.');}
    finally{setLoading(false);}
  },[assignee,severity,status]);

  useEffect(()=>{void load();},[load]);

  const filteredCases=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return cases;
    return cases.filter((item)=>[item.reference,item.title,item.description??'',item.entityLabel,item.assignedToLabel??''].some((value)=>value.toLowerCase().includes(q)));
  },[cases,query]);

  const summary=useMemo(()=>available===true?{
    open:cases.filter((item)=>item.status==='open').length,
    high:cases.filter((item)=>item.severity==='P0'||item.severity==='P1').length,
    investigating:cases.filter((item)=>item.status==='investigating').length,
    resolved:cases.filter((item)=>item.status==='resolved').length,
    blocked:cases.filter((item)=>item.status==='waiting').length,
  }:null,[available,cases]);

  return <ProtectedRoute allowedRoles={['owner']}>
    <div className="sa-page sa-action-centre-premium">
      <header className="sa-page-header">
        <div>
          <div className="sa-eyebrow">Support & Cases</div>
          <h1 className="sa-page-title">Platform Action Centre</h1>
          <p className="sa-page-description">Centralised view of platform issues, complaints and escalations. Triage, investigate and drive resolution.</p>
        </div>
        <div className="sa-page-actions"><button type="button" className="sa-secondary-button" disabled><Download size={15}/> Export report</button></div>
      </header>

      <div className="sa-executive-alert-grid">
        <div className="sa-executive-alert" data-tone="info"><span className="sa-executive-alert-icon"><Info size={19}/></span><div><strong>Stay on top of critical issues</strong><p>{available===true?`${summary?.high??0} high-priority cases currently require Platform Owner attention.`:'Persistent case metrics become available when the Platform Case Centre schema is applied.'}</p></div></div>
        <div className="sa-executive-alert" data-tone="warning"><span className="sa-executive-alert-icon"><ShieldAlert size={19}/></span><div><strong>SLA and ownership visibility</strong><p>{available===true?'Use severity, ownership and status filters to focus the active queue.':'No SLA or case-count zeroes are inferred while the persistent registry is unavailable.'}</p></div></div>
      </div>

      {loading?<div className="sa-state-block" data-tone="info">Loading persistent case summary…</div>:available===true&&summary?<div className="sa-metric-grid sa-metric-grid-five">
        {[['Open cases',summary.open,'blue'],['High priority',summary.high,'orange'],['Investigating',summary.investigating,'purple'],['Resolved',summary.resolved,'green'],['Blocked / On hold',summary.blocked,'red']].map(([label,value,tone])=><div key={String(label)} className="sa-metric-card" data-tone={tone}><div className="sa-metric-value">{value}</div><div className="sa-metric-label">{label}</div></div>)}
      </div>:null}

      {note?<div className="sa-state-block" data-tone="warning">{note}</div>:null}
      {error?<div className="sa-state-block" data-tone="danger"><strong>Service temporarily unavailable</strong><div style={{marginTop:3}}>{error}</div></div>:null}

      <section className="sa-filter-bar sa-action-filter-bar" aria-label="Action Centre filters">
        <label className="sa-filter-label">Status<select className="sa-filter-select" value={status} onChange={(e)=>setStatus(e.target.value)} disabled={available===false}><option value="active">Active cases</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="investigating">Investigating</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option></select></label>
        <label className="sa-filter-label">Severity<select className="sa-filter-select" value={severity} onChange={(e)=>setSeverity(e.target.value)} disabled={available===false}><option value="ALL">All severity</option><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option></select></label>
        <label className="sa-filter-label">Ownership<select className="sa-filter-select" value={assignee} onChange={(e)=>setAssignee(e.target.value)} disabled={available===false}><option value="all">All owners</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option></select></label>
        <div className="sa-action-search"><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search cases, companies, tickets…" disabled={available===false}/></div>
        <button type="button" className="sa-primary-button" onClick={()=>void load()} disabled={loading}><AlertTriangle size={14}/> Refresh</button>
      </section>

      {available===false&&!error?<section className="sa-panel"><div className="sa-empty">Case registry is unavailable until the SA-02 schema is applied. No empty registry or synthetic KPI values are fabricated.</div></section>:<PlatformCaseCentre cases={filteredCases} loading={loading} error={error} onOpenCase={(caseId)=>router.push(`/super-admin/action-centre/${caseId}`)}/>} 
    </div>
  </ProtectedRoute>;
}
