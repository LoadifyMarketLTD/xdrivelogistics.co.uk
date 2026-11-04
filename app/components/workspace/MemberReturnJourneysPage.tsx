'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AlertBanner, EmptyState, PageFrame, PageHeader } from './WorkspaceUI';
import '../../try-xdrive-demo/return-journeys.css';

type Journey={id:string;from:string;to:string;availableFrom:string|null;availableTo:string|null;vehicleType:string|null;member?:{name?:string|null;code?:string|null}};
type ApiResult={journeys?:Journey[];limited?:boolean;error?:string;source?:string};
const when=(raw:string|null)=>{if(!raw)return 'Date not supplied';const d=new Date(raw);return Number.isNaN(d.getTime())?'Invalid date':d.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});};

export default function MemberReturnJourneysPage() {
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [vehicle,setVehicle]=useState('');
  const [filters,setFilters]=useState({from:'',to:'',vehicle:''});
  const [journeys,setJourneys]=useState<Journey[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [limited,setLimited]=useState(false);
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(i=>i+1),[]);
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      setError('');setJourneys([]);setLoading(true);setLimited(false);
      const {data:session}=await supabase.auth.getSession();
      const token=session.session?.access_token;
      if(!token){if(alive){setError('Your session has expired.');setLoading(false);}return;}
      try{
        const res=await fetch('/api/workspace/return-journeys',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
        const body=await res.json().catch(()=>null) as ApiResult|null;
        if(!res.ok)throw new Error(body?.error||'Return Journeys unavailable.');
        if(body?.source!=='published-return-journeys'||!Array.isArray(body.journeys))throw new Error('Unverified return journey data.');
        if(alive){setJourneys(body.journeys);setLimited(body.limited===true);}
      }catch(reason){if(alive){setError(reason instanceof Error?reason.message:'Return Journeys unavailable.');setJourneys([]);}}
      finally{if(alive)setLoading(false);}
    };
    void load();
    return()=>{alive=false;};
  },[revision]);
  const visible=useMemo(()=>journeys.filter(j=>
    (!filters.from||j.from.toLowerCase().includes(filters.from.toLowerCase()))&&
    (!filters.to||j.to.toLowerCase().includes(filters.to.toLowerCase()))&&
    (!filters.vehicle||(j.vehicleType||'').toLowerCase().includes(filters.vehicle.toLowerCase()))
  ),[journeys,filters]);
  return <PageFrame>
    <PageHeader title="Return Journeys" eyebrow="XDrive Exchange / Published Returns"
      description="Verified published return journeys only. Exact addresses and driver identities remain private."
      actions={<button type="button" disabled={loading} onClick={refresh}>Refresh</button>} />
    {error&&<AlertBanner tone="danger">{error}</AlertBanner>}
    {limited&&<AlertBanner tone="warning">More published journeys may exist. Results are limited; a full market total is unavailable.</AlertBanner>}
    <section className="rj-page">
      <div className="rj-metrics"><article><span>R</span><div>Return Opportunities<strong>{loading?'Loading...':error||limited?'Unavailable':journeys.length}</strong><small>Published, active journeys</small></div></article></div>
      <div className="rj-layout"><aside className="rj-filter">
        <h3>Find Return Journeys</h3>
        <form onSubmit={event=>{event.preventDefault();setFilters({from:from.trim(),to:to.trim(),vehicle:vehicle.trim()});}}>
          <label>Current / Delivery Area<input value={from} placeholder="e.g. DA8" onChange={e=>setFrom(e.target.value)}/></label>
          <label>Return To<input value={to} placeholder="e.g. BB1" onChange={e=>setTo(e.target.value)}/></label>
          <label>Vehicle Type<input value={vehicle} placeholder="Any type" onChange={e=>setVehicle(e.target.value)}/></label>
          <button className="rj-search" type="submit">Search returns</button>
          <button className="rj-clear" type="button" onClick={()=>{setFrom('');setTo('');setVehicle('');setFilters({from:'',to:'',vehicle:''});}}>Clear</button>
        </form>
      </aside><div className="rj-results">
        <div className="rj-result-head"><strong>{loading?'Loading...':error||limited?'Unverified total':`${visible.length} return journeys`}</strong></div>
        {!loading&&!error&&visible.map(row=><article className="rj-card" key={row.id}>
          <div className="rj-date"><strong>{when(row.availableFrom)}</strong><small>Published return</small></div>
          <div className="rj-route"><strong>{row.from} → {row.to}</strong><small>{row.vehicleType||'Vehicle unspecified'} · Until {when(row.availableTo)}</small></div>
          <div className="rj-company"><small>Posted by</small><strong>{row.member?.name||'Verified member'}</strong><small>{row.member?.code||'Member number not supplied'}</small></div>
        </article>)}
        {(loading||error||visible.length===0)&&<EmptyState title={loading?'Loading return journeys':error?'Return Journeys unavailable':'No published returns match your filters'} description={error||'Only active published return journeys are shown; no jobs or matches are invented.'}/>}
      </div></div>
    </section>
  </PageFrame>;
}
