'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { company3150AuthorizedFetch } from './company3150AuthorizedFetch';
import { useCompany3150Live } from './Company3150LiveData';
import '../network.css';

type View = 'Overview' | 'Directory' | 'Live Availability' | 'Return Journeys' | 'Freight Vision' | 'Messages' | 'Notifications' | 'Finance' | 'Reports' | string;
const labels: View[] = ['Overview', 'Directory', 'Live Availability', 'Return Journeys', 'Messages', 'Notifications', 'Finance', 'Reports'];
const pathFor: Record<string, string> = {
  Directory: '/admin/marketplace',
  'Live Availability': '/admin/live-availability',
  'Return Journeys': '/admin/returns',
  'Freight Vision': '/admin/freight-vision',
  Messages: '/admin/messages',
  Notifications: '/admin/notifications',
  Finance: '/admin/invoices',
  Reports: '/admin/operations-centre',
};

export default function Company3150LiveNetwork({ initialView = 'Overview' }: { initialView?: View }) {
  const live = useCompany3150Live();
  const [view, setView] = useState(initialView);
  const [directory,setDirectory] = useState<{companyId:string;name:string;memberId:string|null;city:string|null;postcode:string|null}[]>([]);
  const [availability,setAvailability] = useState<{company_id:string|null;member_name?:string;member_code?:string;vehicle_type?:string;recorded_at?:string;distance_miles?:number}[]>([]);
  const [threads,setThreads] = useState<{key:string;conversationId:string|null;counterpartName:string;latestAt:string|null;latestBody:string;canReply:boolean;messages:{id:string;body:string;direction:string}[]}[]>([]);
  const [selectedThread,setSelectedThread] = useState<string|null>(null);
  const [reply,setReply] = useState("");
  const [error,setError] = useState("");
  useEffect(()=>{
    let active=true;
    const request=async()=>{
      if(view!=="Directory"&&view!=="Live Availability"&&view!=="Messages")return;
      try{
        if(view==="Directory"){
          const data=await company3150AuthorizedFetch<{companies:typeof directory}>("/api/directory");
          if(active)setDirectory(data.companies||[]);
        } else if(view==="Live Availability"){
          const data=await company3150AuthorizedFetch<{positions:typeof availability}>("/api/availability/nearby?scope=all&radiusMiles=50");
          if(active)setAvailability(data.positions||[]);
        }else{
          const data=await company3150AuthorizedFetch<{threads:typeof threads}>("/api/workspace/messages");
          if(active)setThreads(data.threads||[]);
        }
        if(active)setError("");
      }catch(e){if(active)setError(e instanceof Error?e.message:"Data unavailable")}
    };
    void request();
    return()=>{active=false};
  },[view]);
  const sendReply=async()=>{
    const thread=threads.find(x=>x.key===selectedThread);
    if(!thread?.conversationId||!thread.canReply||!reply.trim())return;
    try{
      await company3150AuthorizedFetch("/api/workspace/messages",{method:"POST",body:JSON.stringify({conversationId:thread.conversationId,body:reply.trim()})});
      setReply("");
      const updated=await company3150AuthorizedFetch<{threads:typeof threads}>("/api/workspace/messages");
      setThreads(updated.threads||[]);
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"Reply unavailable")}
  };

  if (!live) return null;
  const { data, loads, quotes, bookings } = live;
  const dataError = data.error;
  const missing = (value: string) => <p className="muted">{value}</p>;
  const jobItems = bookings.filter(b => b.status === 'Awarded');
  const invoices = data.invoices;
  const completed = loads.filter(l => l.podReceived);
  return (
    <div className="network">
      <div className="panel">
        <div className="panel-title"><h2>Company network & operations</h2><span>AUTHENTICATED COMPANY RECORDS</span></div>
        {(dataError||error) && <p role="alert">{dataError||error}</p>}
        <p className="muted">Information is limited to records visible to your signed-in company. No illustrative accounts, vehicles or messages are shown.</p>
        {view === 'Overview' && <div className="network-tabs">{labels.map(x => <button key={x} className={view === x ? 'selected' : ''} onClick={() => setView(x)}>{x}</button>)}</div>}
      </div>
      {view === 'Overview' && <>
        <div className="metrics">
          <div><small>VISIBLE JOBS</small><b>{loads.length}</b><span>Company operational records</span></div>
          <div><small>QUOTE RECORDS</small><b>{quotes.length}</b><span>Company quote records</span></div>
          <div><small>FLEET VEHICLES</small><b>{data.vehicles.length}</b><span>Registered company vehicles</span></div>
          <div><small>POD RECEIVED</small><b>{completed.length}</b><span>Evidence in job records</span></div>
        </div>
        <div className="panel"><h2>Live operations snapshot</h2><div className="network-table">
          {!loads.length && missing('No company jobs available.')}
          {loads.map(l => <div key={l.id} className="network-job"><div><small>{l.id}</small><strong>{l.from} — {l.to}</strong><span>{l.assignedDriver || 'Unallocated'}</span></div><div><span className="network-status">{l.operationalStatus || l.status}</span></div></div>)}
        </div></div>
        <div className="network-shortcuts">{labels.slice(1).map(x => <button key={x} onClick={() => setView(x)}>{x} <span>›</span></button>)}</div>
      </>}
      {view === 'Directory' && <div className="panel"><h2>Member Directory</h2><div className="network-directory">{directory.map(m=><div className="network-job" key={m.companyId}><div><strong>{m.name}</strong><small>{m.memberId||"Member ID unavailable"} · {m.city||""} {m.postcode||""}</small></div></div>)}</div>{!directory.length&&missing("No directory members available.")}<Link href={pathFor.Directory}>Open full directory</Link></div>}
      {view === 'Live Availability' && <div className="panel"><div className="panel-title"><h2>Who&apos;s nearby — Live Availability</h2><span>VERIFIED AVAILABILITY ONLY</span></div><div className="network-map">{missing("Live availability: "+availability.length+" verified visible positions. Open the interactive live map for exact locations.")}</div><div className="network-directory">{availability.map((v,i)=><div className="network-job" key={v.company_id+":"+i}><div><strong>{v.member_name||v.member_code||"Visible member"}</strong><small>{v.vehicle_type||"Vehicle not provided"}{v.distance_miles!=null?" · "+v.distance_miles+" miles":""}</small></div></div>)}</div>{!availability.length&&missing("No eligible nearby drivers or vehicles currently available.")}<Link href={pathFor['Live Availability']}>Open live map</Link></div>}
      {view === 'Return Journeys' && <div className="panel"><div className="panel-title"><h2>Return Journeys</h2><span>LIVE RECORDS ONLY</span></div>{missing('Return journeys are managed in the authorised company workspace.')}<Link href={pathFor['Return Journeys']}>Open return journeys</Link></div>}
      {view === 'Freight Vision' && <div className="panel"><div className="panel-title"><h2>Freight Vision</h2><span>COMPANY BOOKINGS</span></div><div className="network-table">{jobItems.length === 0 && missing('No in-progress company bookings available.')}{jobItems.map(l => <div className="network-job" key={l.id}><div><small>{l.id}</small><strong>{l.from} — {l.to}</strong><span>{l.assignedDriver || 'Unallocated'}</span></div><div><span className="network-status">{l.operationalStatus || l.status}</span></div></div>)}</div><Link href={pathFor['Freight Vision']}>Open live tracking</Link></div>}
      {view === 'Messages' && <div className="panel"><div className="panel-title"><h2>Member Messages</h2><span>PRIVATE CONVERSATIONS</span></div><div className="network-table">{threads.map(t=><button key={t.key} className="network-notice" onClick={()=>setSelectedThread(t.key)}><strong>{t.counterpartName}</strong><span>{t.latestBody}</span></button>)}</div>{!threads.length&&missing("No conversations for this user.")}{threads.filter(t=>t.key===selectedThread).map(t=><div className="network-chat" key={t.key}><h3>{t.counterpartName}</h3>{t.messages.map(m=><div className={"network-bubble "+(m.direction==="outbound"?"mine":"")} key={m.id}><p>{m.body}</p></div>)}{t.canReply&&<label className="network-search">Reply<input value={reply} onChange={e=>setReply(e.target.value)}/></label>}{t.canReply&&<button className="primary" disabled={!reply.trim()} onClick={()=>void sendReply()}>Send message</button>}</div>)}<Link href={pathFor.Messages}>Open all messages</Link></div>}
      {view === 'Notifications' && <div className="panel"><div className="panel-title"><h2>Notifications & Alerts</h2><span>ACCOUNT NOTIFICATIONS</span></div>{missing('No fabricated notifications are displayed.')}<Link href={pathFor.Notifications}>Open notifications</Link></div>}
      {view === 'Finance' && <div className="panel"><div className="panel-title"><h2>Invoices & payment status</h2><span>LIVE INVOICES</span></div><div className="network-finance">{invoices.map(i => <div key={i.id}><small>{i.invoice_number || i.id}</small><strong>{i.currency || 'GBP'} {Number(i.amount ?? 0).toFixed(2)} — {i.payment_status || i.status}</strong></div>)}</div>{invoices.length === 0 && missing('No invoice records available.') }<Link href={pathFor.Finance}>Open invoices</Link></div>}
      {view === 'Reports' && <div className="panel"><div className="panel-title"><h2>Reports & Statistics</h2><span>VISIBLE COMPANY RECORDS</span></div><div className="metrics">
        <div><small>VISIBLE LOADS</small><b>{loads.length}</b></div>
        <div><small>QUOTE RECORDS</small><b>{quotes.length}</b></div>
        <div><small>BOOKINGS WITH POD</small><b>{completed.length}</b></div>
        <div><small>INVOICES</small><b>{invoices.length}</b></div>
      </div><p className="muted">Counts represent records available to the signed-in company; where data is unavailable, consult the source workspace.</p></div>}
    </div>
  );
}
