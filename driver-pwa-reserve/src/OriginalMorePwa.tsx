import {useEffect, useState} from 'react';
import {driverGet} from './liveApi';
import MemberDiscoveryPwa from './MemberDiscoveryPwa';
import AvailabilityStatusPwa from './AvailabilityStatusPwa';
import FuturePositionPwa from './FuturePositionPwa';
import ReturnJourneyPwa from './ReturnJourneyPwa';
import './OriginalMorePwa.css';

type Data = Record<string, unknown>;
type Resources = {
  name?:string; email?:string; phone?:string;
  driver?:Data; vehicle?:Data|null; company?:Data|null;
  documents?:Data[]; alerts?:Data[]; return_journey?:Data|null;
  partial?:string[]; profile?:Data; job_search_preferences?:Data[];
};
type Item = {key:string;title:string;description:string;glyph:string};
export const originalMoreItems: readonly Item[] = [
  {key:'profile',title:'My Profile',description:'Personal details and driver account',glyph:'person'},
  {key:'vehicle',title:'My Vehicle',description:'Assigned vehicle and availability',glyph:'vehicle'},
  {key:'documents',title:'My Documents',description:'Driver and vehicle documents',glyph:'document'},
  {key:'events',title:'Event Log',description:'Operational activity history',glyph:'history'},
  {key:'journeys',title:'Return Journeys',description:'Publish and manage return journeys',glyph:'journey'},
  {key:'availability',title:'Availability',description:'Manage your live availability',glyph:'toggle'},
  {key:'nearby',title:"Who's Nearby?",description:'View nearby XDrive members',glyph:'people'},
  {key:'directory',title:'Directory',description:'Find XDrive members and fleets',glyph:'search'},
  {key:'future',title:'Future Position',description:"Set where you'll be available next",glyph:'pin'},
] as const;

function Icon({glyph}:{glyph:string}) {
  const shared={width:27,height:27,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
  const draw:Record<string,React.ReactNode>={
    person:<><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></>,
    vehicle:<><rect x="3" y="9" width="18" height="10" rx="2"/><path d="m6 9 2-5h8l2 5M6 19v2m12-2v2M6 14h2m8 0h2"/></>,
    document:<><path d="M6 2h8l5 5v15H6zM14 2v5h5M9 12h7M9 16h7"/></>,
    history:<><circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2M3 4v5h5"/></>,
    journey:<><path d="M12 21v-7M12 14 5 7m7 7 7-7M3 7h5V2M16 7h5V2"/></>,
    toggle:<><rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="3" fill="currentColor" stroke="none"/></>,
    people:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 20v-2a7 7 0 0 1 14 0v2m0-6a5 5 0 0 1 6 5v1"/></>,
    search:<><circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/></>,
    pin:<><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  };
  return <svg {...shared}>{draw[glyph]}</svg>;
}
function display(value:unknown):string {
  if(value==null||value==='')return 'Not provided';
  if(typeof value==='boolean')return value?'Yes':'No';
  if(typeof value==='number')return String(value);
  if(typeof value==='string')return value.slice(0,400);
  return 'Not provided';
}
function friendlyEnum(value:unknown):string {
  if(typeof value!=='string')return display(value);
  return value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
}
function Row({label,value}:{label:string;value:unknown}) {
  return <div className="xd-native-more-field"><span>{label}</span><strong>{display(value)}</strong></div>;
}
function formatEvent(row:Data) {
  const details=row.payload;
  if(details&&typeof details==='object'&&!Array.isArray(details)) {
    const event=details as Data;
    return display(event.title||event.message||row.event_type);
  }
  return display(row.event_type);
}
function Subsection({section,resources,token}:{section:string;resources:Resources;token:string}) {
  const driver=resources.driver||{},vehicle=resources.vehicle||{},profile=resources.profile||{};
  switch(section) {
    case 'profile':return <div className="xd-native-more-panel">
      <Row label="Name" value={resources.name||profile.display_name}/><Row label="Email" value={resources.email}/>
      <Row label="Phone" value={resources.phone}/><Row label="XDrive Member ID" value={profile.member_id}/>
      <Row label="Driver type" value={friendlyEnum(driver.driver_type)}/><Row label="Account status" value={friendlyEnum(driver.status)}/>
    </div>;
    case 'vehicle':return <div className="xd-native-more-panel">
      {resources.vehicle? <><Row label="Vehicle" value={[vehicle.make,vehicle.model].filter(Boolean).join(' ')||vehicle.type}/><Row label="Registration" value={vehicle.reg_plate}/><Row label="Type" value={vehicle.type}/><Row label="Status" value={vehicle.status}/></>
        : <p>No assigned vehicle was returned for this driver.</p>}
      <Row label="Driver availability" value={friendlyEnum(driver.availability_status)}/>
    </div>;
    case 'documents':return <div className="xd-native-more-panel">
      {resources.documents?.length?resources.documents.map((doc,index)=><div className="xd-native-more-record" key={String(doc.id||index)}>
        <strong>{display(doc.document_type||doc.type||doc.name)}</strong>
        <span>{doc.is_vehicle_document?'Vehicle document':'Driver document'}</span>
        {doc.expiry_date!=null&&doc.expiry_date!==''&&<span>Expires: {display(doc.expiry_date)}</span>}
      </div>):<p>No documents were returned for this driver.</p>}
    </div>;
    case 'events':return <div className="xd-native-more-panel">
      {resources.alerts?.length?resources.alerts.map((alert,index)=><div className="xd-native-more-record" key={String(alert.id||index)}>
        <strong>{formatEvent(alert)}</strong>
        {alert.created_at!=null&&alert.created_at!==''&&<span>{new Date(String(alert.created_at)).toLocaleString('en-GB')}</span>}
      </div>):<p>No operational events were returned.</p>}
    </div>;
    case 'journeys':return <ReturnJourneyPwa token={token} journey={resources.return_journey||null}/>;
    case 'availability':return <AvailabilityStatusPwa token={token}/>;
    case 'nearby':return <MemberDiscoveryPwa token={token} mode="nearby"/>;
    case 'directory':return <MemberDiscoveryPwa token={token} mode="directory"/>;
    case 'future':return <FuturePositionPwa token={token} driver={driver}/>;
    default:return null;
  }
}
export default function OriginalMorePwa({token,ownerDriver=false,onOpenInvoices}:{token:string;ownerDriver?:boolean;onOpenInvoices?:()=>void}) {
  const [selected,setSelected]=useState<string|null>(null);
  const [resources,setResources]=useState<Resources|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let live=true;setLoading(true);setError('');setResources(null);setSelected(null);
    void driverGet('/web/resources',token).then(data=>{
      if(!live)return;
      const raw=data.resources;
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Driver resources response is not available.');
      setResources(raw as Resources);
    }).catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'Driver resources cannot be loaded.');})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[token,attempt]);
  const item=originalMoreItems.find(item=>item.key===selected);
  return <section className="xd-native-more" aria-label="Driver More">
    {item?<><button type="button" className="xd-native-more-back" onClick={()=>setSelected(null)}>← More</button>
      <h1>{item.title}</h1><p className="xd-native-more-kicker">{item.description}</p>
      {resources&&<Subsection section={item.key} resources={resources} token={token}/>}</>:
      <><p className="xd-native-more-kicker">Driver account, tools and records</p>
      <div className="xd-native-more-list">{originalMoreItems.map(item=><button type="button" className="xd-native-more-item" key={item.key} disabled={!resources} onClick={()=>setSelected(item.key)}>
        <span className="xd-native-more-icon"><Icon glyph={item.glyph}/></span>
        <span className="xd-native-more-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
        <span className="xd-native-more-arrow" aria-hidden="true">›</span>
      </button>)}{ownerDriver&&onOpenInvoices&&<button type="button" className="xd-native-more-item" onClick={onOpenInvoices} aria-label="My Invoices — view issued invoices and PDFs"><span className="xd-native-more-icon"><Icon glyph="document"/></span><span className="xd-native-more-copy"><strong>My Invoices</strong><small>Issued invoices and secure PDFs</small></span><span className="xd-native-more-arrow" aria-hidden="true">›</span></button>}</div></>}
    {loading&&<p role="status" className="xd-native-more-status">Loading authorised driver resources…</p>}
    {error&&<div role="alert" className="xd-native-more-error">Driver resources unavailable: {error} <button type="button" onClick={()=>setAttempt(a=>a+1)}>Retry</button></div>}
    {!!resources?.partial?.length&&<p role="status" className="xd-native-more-muted">Some resources are temporarily unavailable: {resources.partial.join(', ')}.</p>}
  </section>;
}
