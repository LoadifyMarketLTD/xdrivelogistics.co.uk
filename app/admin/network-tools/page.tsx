'use client';
import {useState,useEffect,useRef} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabaseClient';
import {useAuth} from '../../components/AuthContext';
import {resolveWorkspaceRole} from '../../../lib/workspaceRole';
import {Panel,ActionButton,AlertBanner} from '../../components/workspace/WorkspaceUI';
import {calculateLoad,directionsHref} from '../../components/workspace/companyNetworkTools';

const sections=['Overview','Integrations','Operational Tools','Data & Export','API & Access','Settings'] as const;
const utilityNames=['Route Planner','Distance & ETA','Postcode Tools','Address Lookup','Document Scanner','POD & ePOD','Weight & Load','Export & Reports'] as const;
type Utility=typeof utilityNames[number];
const link=(href:string,label:string)=><Link className="company-admin-ops-detail" href={href} prefetch={false}>{label}</Link>;
export default function CompanyNetworkToolsPage(){
  const {user}=useAuth();
  const [section,setSection]=useState<typeof sections[number]>('Overview');
  const [utility,setUtility]=useState<Utility>('Route Planner');
  const [origin,setOrigin]=useState(''),[destination,setDestination]=useState('');
  const [location,setLocation]=useState(''),[result,setResult]=useState<string[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[checked,setChecked]=useState(false);
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const [load,setLoad]=useState(['','','','','']);
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
  const company=(user?.workspaceRole??resolveWorkspaceRole(user))==='company_admin';
  const route=directionsHref(origin,destination);
  const calculated=calculateLoad(load[0],load[1],load[2],load[3],load[4]);
  const open=(name:Utility)=>{setUtility(name);setSection('Operational Tools');setResult([]);setError('');setChecked(false)};
  async function lookup(){
    if(!location.trim()||loading)return;
    setLoading(true);setError('');setResult([]);setChecked(false);
    try{
      const address=utility==='Address Lookup';
      const {data}=await supabase.auth.getSession();
      if(!data.session?.access_token)throw Error('Sign in again to use lookup services.');
      const response=await fetch('/api/location/'+(address?'postcode-addresses':'postcode-area')+'?q='+encodeURIComponent(location.trim()),{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
      const payload=await response.json();
      if(!response.ok)throw Error(payload.error||'Lookup unavailable');
      setResult(address?(Array.isArray(payload.suggestions)?payload.suggestions.filter((v:unknown):v is string=>typeof v==='string'):[]):[payload.area||'Area not supplied']);setChecked(true);
    }catch(e){setError(e instanceof Error?e.message:'Lookup unavailable')}finally{setLoading(false)}
  }
  if(!company)return <AlertBanner tone="warning">Company Admin access required.</AlertBanner>;
  return <div className="company-admin-fleet"><h1>Network &amp; Tools</h1><p>Company operational utilities and authoritative platform registers.</p>
    <div className="workspace-tab-strip company-admin-fleet-tabs" role="group" aria-label="Network and tools sections">{sections.map(s=><button key={s} type="button" disabled={loading} data-active={String(section===s)} aria-pressed={section===s} onClick={()=>setSection(s)}>{s}</button>)}</div>
    {section==='Overview'&&<Panel title="Network & operational tools"><div className="company-admin-ops-grid">{utilityNames.map(t=><button type="button" className="company-admin-ops-kpi" key={t} onClick={()=>open(t)}>{t}</button>)}</div>{link('/admin/marketplace/directory','Member Directory')}{link('/admin/live-availability','Live Availability')}{link('/admin/event-log','Event Log')}</Panel>}
    {section==='Integrations'&&<Panel title="Platform integrations" description="Connection health is not inferred from configuration."><div className="company-admin-ops-facts"><span>Database and membership — managed by platform.</span><span>Maps and address services — use live lookup tools.</span><span>Payments and invoices — use finance registers.</span><span>Notifications — use the authoritative notifications register.</span></div>{link('/admin/settings','Company settings')}{link('/admin/invoices','Finance')}{link('/admin/notifications','Notifications')}</Panel>}
    {section==='Operational Tools'&&<><div className="workspace-tab-strip company-admin-fleet-tabs" role="group" aria-label="Operational utilities">{utilityNames.map(t=><button key={t} type="button" disabled={loading} data-active={String(utility===t)} aria-pressed={utility===t} onClick={()=>open(t)}>{t}</button>)}</div>
      <Panel title={utility}>
        {['Route Planner','Distance & ETA'].includes(utility)&&<><label className="company-admin-fleet-search">Origin <input value={origin} onChange={e=>setOrigin(e.target.value)}/></label><label className="company-admin-fleet-search">Destination <input value={destination} onChange={e=>setDestination(e.target.value)}/></label>{route?<a className="company-admin-ops-detail" href={route} target="_blank" rel="noopener noreferrer">Open driving directions and ETA</a>:<p>Enter both locations.</p>}<p>Distance and ETA are calculated by the routing provider. Confirm commercial vehicle restrictions separately.</p></>}
        {['Postcode Tools','Address Lookup'].includes(utility)&&<><label className="company-admin-fleet-search">Postcode / location <input value={location} disabled={loading} onChange={e=>{setLocation(e.target.value);setResult([]);setChecked(false);setError('')}} maxLength={160}/></label><ActionButton onClick={()=>void lookup()} disabled={loading||!location.trim()}>{loading?'Looking up…':'Look up'}</ActionButton>{error&&<AlertBanner tone="warning">{error}</AlertBanner>}{!!result.length&&<ul>{result.map((v,i)=><li key={i}>{v}</li>)}</ul>}{!loading&&!error&&!result.length&&<p>{checked?'No matching suggestions returned.':'Enter a location to search.'} Address suggestions may not include every premises.</p>}</>}
        {utility==='Document Scanner'&&<><p>Select a photo or PDF for local review. No OCR or server upload is implied.</p><input ref={inputRef} type="file" accept="image/*,application/pdf" aria-label="Select local document" onChange={e=>{setPreview('');setFile(e.target.files?.[0]||null)}}/>{file&&<p>{file.name} · {Math.ceil(file.size/1024)} KB</p>}{file&&preview&&<a href={preview} target="_blank" rel="noopener noreferrer" className="company-admin-ops-detail">Open local preview</a>}{file&&<ActionButton tone="secondary" onClick={()=>{setFile(null);setPreview('');if(inputRef.current)inputRef.current.value=''}}>Clear</ActionButton>}{link('/admin/documents','Open document register')}</>}
        {utility==='Weight & Load'&&<><p>Count and dimensions per identical pallet / package. No vehicle-fit or securing guarantee.</p>{['Number of packages','Weight per package (kg)','Length (cm)','Width (cm)','Height (cm)'].map((v,i)=><label key={v} className="company-admin-fleet-search">{v}<input type="number" min={i===0?1:0.01} step={i===0?1:'any'} value={load[i]} onChange={e=>setLoad(old=>old.map((x,n)=>n===i?e.target.value:x))}/></label>)}{calculated?<dl className="company-admin-fleet-facts"><div><dt>Total weight</dt><dd>{calculated.totalKg.toLocaleString('en-GB')} kg</dd></div><div><dt>Total volume</dt><dd>{calculated.volumeM3.toFixed(3)} m³</dd></div><div><dt>Unstacked footprint</dt><dd>{calculated.floorM2.toFixed(2)} m²</dd></div></dl>:<p>Enter valid positive values and a whole package count.</p>}</>}
        {utility==='POD & ePOD'&&<>{link('/admin/pod','POD review queue')}{link('/admin/diary','Booking diary')}</>}
        {utility==='Export & Reports'&&<>{link('/admin/finance/reports','Reports & Data')}{link('/admin/finance/statements','Statements')}{link('/admin/event-log','Event log')}</>}
      </Panel></>}
    {section==='Data & Export'&&<Panel title="Authoritative data and exports">{link('/admin/finance/reports','Reports & Data')}{link('/admin/finance/statements','Statements')}{link('/admin/bulk-import','Bulk Import')}{link('/admin/event-log','Event Log')}</Panel>}
    {section==='API & Access'&&<Panel title="Access management" description="No credentials or administrative API keys are displayed.">{link('/admin/team','Team & Roles')}{link('/admin/settings','Company access settings')}</Panel>}
    {section==='Settings'&&<Panel title="Existing company settings">{link('/admin/settings','Company settings')}{link('/admin/notifications','Notifications')}{link('/admin/support','Help & Support')}</Panel>}
  </div>
}
