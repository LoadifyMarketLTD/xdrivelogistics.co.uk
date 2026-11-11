'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import { AlertBanner, EmptyState, PageFrame, PageHeader } from './WorkspaceUI';
import '../../try-xdrive-demo/components/demo-freight-vision.css';

type Tab='Company Overview'|'Lane Activity'|'Demand & Supply'|'Market Rates';
const tabs:Tab[]=['Company Overview','Lane Activity','Demand & Supply','Market Rates'];

export default function MemberFreightVisionPage({role}:{role:'customer'|'broker'}) {
  const data=useCompanyWorkspaceData();
  const router=useRouter();
  const [tab,setTab]=useState<Tab>('Company Overview');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [vehicle,setVehicle]=useState('');
  const [filters,setFilters]=useState({from:'',to:'',vehicle:''});
  const jobsVerified=data.companyId!=null&&data.datasets.jobs.availability==='available'
    &&!data.datasets.jobs.partialData&&!data.datasets.jobs.limitedData&&!data.error&&!data.loading;
  const bidsVerified=data.companyId!=null&&data.datasets.bids.availability==='available'
    &&!data.datasets.bids.partialData&&!data.datasets.bids.limitedData&&!data.error&&!data.loading;
  const jobs=useMemo(()=>data.jobs.filter(job=>
    (!filters.from||(job.pickup_location||job.pickup_postcode||'').toLowerCase().includes(filters.from.toLowerCase()))&&
    (!filters.to||(job.delivery_location||job.delivery_postcode||'').toLowerCase().includes(filters.to.toLowerCase()))&&
    (!filters.vehicle||(job.vehicle_type||'').toLowerCase().includes(filters.vehicle.toLowerCase()))
  ),[data.jobs,filters]);
  const quoteCount=useMemo(()=>data.bids.filter(bid=>jobs.some(job=>job.id===bid.job_id)).length,[data.bids,jobs]);
  const routes=useMemo(()=>{
    const lanes=new Map<string,{route:string;count:number}>();
    for(const job of jobs) {
      const key=`${job.pickup_location||job.pickup_postcode||'Not supplied'} → ${job.delivery_location||job.delivery_postcode||'Not supplied'}`;
      const previous=lanes.get(key);
      lanes.set(key,{route:key,count:(previous?.count??0)+1});
    }
    return [...lanes.values()].sort((a,b)=>b.count-a.count);
  },[jobs]);
  const goToLoads=()=>router.push(role==='customer'?'/customer/loads':'/broker/loads');

  return <PageFrame>
    <PageHeader eyebrow="Freight Vision / Verified XDrive company records" title="Freight Vision"
      description="Operational lanes from jobs accessible to your company. Market-wide rate feeds, traffic predictions and supply forecasts are not connected." />
    {data.error&&<AlertBanner tone="danger">{data.error}</AlertBanner>}
    {(!jobsVerified||!bidsVerified)&&<AlertBanner tone="warning">Some verified company records are unavailable or incomplete; statistics are not inferred from an empty dataset.</AlertBanner>}
    <section className="xd-fv">
      <div className="xd-fv-kpis">
        {([['Company Loads',jobsVerified?jobs.length:'Unavailable','Verified accessible jobs'],['Company Quotes',jobsVerified&&bidsVerified?quoteCount:'Unavailable','Related verified bids'],['Verified Lanes',jobsVerified?routes.length:'Unavailable','Observed company routes'],['Average Market Rate','Unavailable','Independent market feed required'],['Return Matches','Unavailable','Matching service required']] as const).map(([name,value,description],index)=>
          <article key={name} style={{borderLeftColor:['#f97316','#176de5','#16a34a','#f59e0b','#176de5'][index]}}><div><b>{name}</b><strong>{value}</strong><small>{description}</small></div></article>)}
      </div>
      <nav className="xd-fv-tabs" aria-label="Freight Vision categories">{tabs.map(id=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{id}</button>)}</nav>
      <div className="xd-fv-body">
        <aside className="xd-fv-filters"><h2>Find company lanes</h2>
          <form onSubmit={event=>{event.preventDefault();setFilters({from:from.trim(),to:to.trim(),vehicle:vehicle.trim()});}}>
            <label>From (Town/Outcode)<input value={from} onChange={e=>setFrom(e.target.value)}/></label>
            <label>To (Town/Outcode)<input value={to} onChange={e=>setTo(e.target.value)}/></label>
            <label>Vehicle Type<input value={vehicle} onChange={e=>setVehicle(e.target.value)}/></label>
            <button type="submit" className="xd-fv-search">Search records</button>
            <button type="button" className="xd-fv-clear" onClick={()=>{setFrom('');setTo('');setVehicle('');setFilters({from:'',to:'',vehicle:''});}}>Clear</button>
          </form>
          <small>These filters use verified accessible company jobs, not an independent market-wide Exchange feed.</small>
        </aside>
        <div className="xd-fv-main">
          {tab==='Company Overview'||tab==='Lane Activity'?<div className="xd-fv-top">
            <div className="xd-fv-lanes"><h3>Observed company lanes</h3>{jobsVerified&&routes.slice(0,15).map(lane=>
              <div key={lane.route}><span>{lane.route}</span><small>{lane.count} recorded load(s)</small></div>)}
              {!jobsVerified?<p>Company lanes unavailable.</p>:routes.length===0?<p>No company lanes match these filters.</p>:null}
            </div>
            <div className="xd-fv-insights">
              <article><h3>Market trend</h3><p>Unavailable</p><small>Independent historical marketplace feed required</small></article>
              <article><h3>Demand versus supply</h3><p>Unavailable</p><small>Verified vehicle supply history required</small></article>
            </div>
            <div className="xd-fv-latest"><h3>Company loads</h3>{jobsVerified&&jobs.slice(0,15).map(job=>
              <article key={job.id}><div><strong>{job.pickup_location||job.pickup_postcode||'Not supplied'} → {job.delivery_location||job.delivery_postcode||'Not supplied'}</strong>
                <small>XDL-{job.id.slice(0,8).toUpperCase()} · {job.vehicle_type||'Vehicle not recorded'}</small></div><button type="button" onClick={goToLoads}>View Load</button></article>)}
              {!jobsVerified?<p>Company job records unavailable.</p>:jobs.length===0?<p>No matching jobs.</p>:null}
            </div>
          </div>:<div className="xd-fv-placeholder"><h2>{tab}</h2><EmptyState title="Verified market feed not connected" description="No independent market rates, live supply forecasts or return matching estimates are invented. Company operations remain available in Loads."/><button type="button" onClick={goToLoads}>Open company Loads</button></div>}
        </div>
      </div>
    </section>
  </PageFrame>;
}
