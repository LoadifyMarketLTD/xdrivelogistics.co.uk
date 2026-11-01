"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
  ArrowRight, Building2, ChevronDown, Filter, MapPin,
  MessageCircle, Phone, RefreshCw, Search, ShieldAlert, Star,
  UserRound, X,
} from "lucide-react";
import {authenticatedDemoFetch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import "./demo-member-directory.css";

type MemberKind="company"|"driver";
type Member={
  id:string;kind:MemberKind;name:string;companyId:string|null;companyName:string|null;
  memberId:string|null;memberType:string;city:string|null;postcode:string|null;country:string|null;
  businessPhone:string|null;availability:string|null;vehicleTypes:string[];specialistServices:string[];
  maxPallets:number|null;distanceMiles:number|null;recordCreatedAt:string|null;
};
type Result={
  companies:Member[];drivers:Member[];
  paging:{nextOffset:number;hasMoreCompanies:boolean;hasMoreDrivers:boolean;limit:number;partial:boolean};
  nearest:{near:string;radiusMiles:number;locationType:string;resolved:boolean}|null;
  warnings:string[];privacy:string;memberIdsAvailable:boolean;error?:string;
};
type MemberTab="All Members"|"Companies"|"Drivers"|"Saved";
type ProfileTab="Member Details"|"Vehicles & Services"|"Compliance";
type SortOption="Name (A-Z)"|"Name (Z-A)"|"Distance (Closest)"|"Member Type";
type Props={onMessage?:(recipient:{name:string;kind:"Companies"|"Drivers";id:string})=>void;onPostLoad?:()=>void};
const STORE="xdrive-company-demo-saved-directory-v2";
const tabs:MemberTab[]=["All Members","Companies","Drivers","Saved"];
const profileTabs:ProfileTab[]=["Member Details","Vehicles & Services","Compliance"];
const emptyPaging={nextOffset:0,hasMoreCompanies:false,hasMoreDrivers:false,limit:50,partial:false};
function contains(value:string|null|undefined,search:string){return (value||"").toLowerCase().includes(search.toLowerCase())}
function readable(value:string|null|undefined){return value&&value.trim()?value:"Not supplied"}
function address(member:Member){return [member.city,member.postcode?.trim(),member.country].filter(Boolean).join(", ")||"Location not supplied"}
function memberTypeKind(member:Member){return member.kind==="driver"?"Driver":member.memberType}
function keyFor(member:Member){return member.kind+":"+member.id}
function isAuthError(error:string){return /auth|session|sign in|staging configuration|member profile required|active company/i.test(error)}
function formatMemberDate(value:string|null){if(!value)return "Not supplied";const d=new Date(value);return Number.isNaN(d.getTime())?"Not supplied":d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}

export default function DemoMemberDirectory({onMessage,onPostLoad}:Props){
  const [tab,setTab]=useState<MemberTab>("All Members");
  const [query,setQuery]=useState(""),[location,setLocation]=useState("");
  const [memberType,setMemberType]=useState(""),[vehicle,setVehicle]=useState(""),[service,setService]=useState("");
  const [availability,setAvailability]=useState(""),[tailLift,setTailLift]=useState(false);
  const [nearest,setNearest]=useState(""),[radius,setRadius]=useState("10");
  const [appliedNear,setAppliedNear]=useState(""),[appliedRadius,setAppliedRadius]=useState("10");
  const [sort,setSort]=useState<SortOption>("Name (A-Z)");
  const [companies,setCompanies]=useState<Member[]>([]),[drivers,setDrivers]=useState<Member[]>([]);
  const [paging,setPaging]=useState(emptyPaging);
  const [warnings,setWarnings]=useState<string[]>([]);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  const [savedIds,setSavedIds]=useState<string[]>([]);
  const [selected,setSelected]=useState<Member|null>(null),[profileTab,setProfileTab]=useState<ProfileTab>("Member Details");
  const [notice,setNotice]=useState("");
  const requestId=useRef(0);
  useEffect(()=>{if(!selected)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[selected]);

  useEffect(()=>{
    try{const value=localStorage.getItem(STORE);if(value){const data=JSON.parse(value);if(Array.isArray(data))setSavedIds(data.filter(x=>typeof x==="string").slice(0,500));}}
    catch{ /* Browser storage is optional. */ }
  },[]);

  const load=useCallback(async(offset:number,append:boolean,signal:AbortSignal)=>{
    const id=++requestId.current;
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams({mode:"expanded",limit:"50",offset:String(offset)});
      if(query.trim())params.set("q",query.trim().slice(0,80));
      if(appliedNear.trim()){params.set("near",appliedNear.trim());params.set("radiusMiles",appliedRadius)}
      const response=await authenticatedDemoFetch("/api/try-xdrive-demo/directory?"+params.toString(),{signal,cache:"no-store"});
      const payload=await response.json().catch(()=>null) as Result|null;
      if(!response.ok)throw new Error(payload?.error||"Directory is not available to this staging member.");
      if(!payload||!Array.isArray(payload.companies)||!Array.isArray(payload.drivers)||!payload.paging)throw new Error("Unexpected Directory response.");
      if(signal.aborted||id!==requestId.current)return;
      setCompanies(current=>append?[...current,...payload.companies]:payload.companies);
      setDrivers(current=>append?[...current,...payload.drivers]:payload.drivers);
      setPaging(payload.paging);setWarnings(payload.warnings||[]);setError("");
    }catch(reason){
      if(signal.aborted||id!==requestId.current)return;
      if(!append){setCompanies([]);setDrivers([]);setPaging(emptyPaging);setWarnings([])}
      setError(reason instanceof Error?reason.message:"Directory unavailable.");
    }finally{
      if(!signal.aborted&&id===requestId.current)setLoading(false);
    }
  },[query,appliedNear,appliedRadius]);

  useEffect(()=>{
    const abort=new AbortController();
    const timer=setTimeout(()=>void load(0,false,abort.signal),query.trim()?300:0);
    return()=>{clearTimeout(timer);abort.abort()};
  },[load,query,refresh]);

  const all=useMemo(()=>[...companies,...drivers],[companies,drivers]);
  const memberTypes=useMemo(()=>[...new Set(companies.map(m=>m.memberType).filter(Boolean))].sort(),[companies]);
  const vehicles=useMemo(()=>[...new Set(all.flatMap(m=>m.vehicleTypes||[]))].sort(),[all]);
  const services=useMemo(()=>[...new Set(all.flatMap(m=>m.specialistServices||[]))].sort(),[all]);
  const visible=useMemo(()=>{
    const filtered=all.filter(m=>
      (tab==="All Members"||(tab==="Companies"&&m.kind==="company")||(tab==="Drivers"&&m.kind==="driver")||
        (tab==="Saved"&&savedIds.includes(keyFor(m))))
      &&(!location.trim()||contains(address(m),location.trim()))
      &&(!memberType||m.kind==="company"&&m.memberType===memberType)
      &&(!vehicle||(m.vehicleTypes||[]).some(x=>contains(x,vehicle)))
      &&(!service||(m.specialistServices||[]).includes(service))
      &&(!availability||m.kind==="driver"&&contains(m.availability,availability))
      &&(!tailLift||(m.specialistServices||[]).includes("Tail lift")));
    const sorted=[...filtered];
    sorted.sort((a,b)=>{
      if(sort==="Distance (Closest)")return (a.distanceMiles??Number.POSITIVE_INFINITY)-(b.distanceMiles??Number.POSITIVE_INFINITY)||a.name.localeCompare(b.name);
      if(sort==="Name (Z-A)")return b.name.localeCompare(a.name);
      if(sort==="Member Type")return memberTypeKind(a).localeCompare(memberTypeKind(b))||a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  },[all,tab,savedIds,location,memberType,vehicle,service,availability,tailLift,sort]);
  const isSaved=(m:Member)=>savedIds.includes(keyFor(m));
  const toggleSave=(m:Member)=>{
    const key=keyFor(m);
    const values=savedIds.includes(key)?savedIds.filter(id=>id!==key):[...savedIds,key];
    setSavedIds(values);setNotice(values.includes(key)?"Saved to this browser's DEMO network.":"Removed from saved DEMO network.");
    try{localStorage.setItem(STORE,JSON.stringify(values))}catch{setNotice("Saved for this browser session only; local storage is unavailable.")}
  };
  const clear=()=>{
    setQuery("");setLocation("");setMemberType("");setVehicle("");setService("");
    setAvailability("");setTailLift(false);setNearest("");setRadius("10");
    setAppliedNear("");setAppliedRadius("10");setSort("Name (A-Z)");setTab("All Members");setNotice("");
    setRefresh(n=>n+1);
  };
  const profile=(m:Member)=>{setSelected(m);setProfileTab("Member Details")};
  const more=()=>{if(!loading&&(paging.hasMoreCompanies||paging.hasMoreDrivers))void load(paging.nextOffset,true,new AbortController().signal)};
  const message=(m:Member)=>{if(onMessage)onMessage({name:m.name,kind:m.kind==="driver"?"Drivers":"Companies",id:m.id});else setNotice("Member messaging is unavailable in this workspace.")};

  return <section className="xd-directory" aria-label="XDrive Member Directory">
    <div className="xd-directory-toolbar">
      <nav aria-label="Directory categories" className="xd-directory-tabs">{tabs.map(t=><button key={t} className={tab===t?"active":""}
        aria-current={tab===t?"page":undefined} onClick={()=>setTab(t)}>{t}<span>{
          t==="All Members"?all.length:t==="Companies"?companies.length:t==="Drivers"?drivers.length:all.filter(m=>savedIds.includes(keyFor(m))).length
        }</span></button>)}</nav>
      <div className="xd-directory-tools">
        <button title="Reload authorized directory records" aria-label="Refresh Directory" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/> Refresh</button>
        <label>Sort by: <select aria-label="Sort directory records" value={sort} onChange={e=>setSort(e.target.value as SortOption)}>
          {(["Name (A-Z)","Name (Z-A)","Distance (Closest)","Member Type"] as SortOption[]).map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
    </div>
    <div className="xd-directory-layout">
      <aside className="xd-directory-filter-rail">
        <h2><Filter size={17}/> Find in Directory</h2>
        <label>Member / Company / Driver<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, town or postcode" aria-label="Search directory members"/></label>
        <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Town or postcode" aria-label="Filter directory location"/></label>
        <label>Member Type<select value={memberType} onChange={e=>setMemberType(e.target.value)}><option value="">Any member type</option>{memberTypes.map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Vehicle<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option value="">Any vehicle</option>{vehicles.map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Specialist Service<select value={service} onChange={e=>setService(e.target.value)}><option value="">Any service</option>{services.map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Driver Availability<select value={availability} onChange={e=>setAvailability(e.target.value)}>
          <option value="">Any availability</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option>
        </select></label>
        <label className="xd-directory-check"><input type="checkbox" checked={tailLift} onChange={e=>setTailLift(e.target.checked)}/> Tail lift only</label>
        <div className="xd-directory-nearest">
          <h3><MapPin size={16}/> Find My Nearest</h3>
          <label>UK Postcode / Outcode<input value={nearest} onChange={e=>setNearest(e.target.value.toUpperCase())}
            placeholder="e.g. BB1 9QL" aria-label="Nearest-search postcode"/></label>
          <label>Radius<select value={radius} onChange={e=>setRadius(e.target.value)} aria-label="Nearest-search radius">
            {["5","10","20","30","50","100","200"].map(v=><option key={v} value={v}>{v} miles</option>)}</select></label>
          <button className="xd-directory-search" onClick={()=>{setAppliedNear(nearest.trim());setAppliedRadius(radius);setSort(nearest.trim()?"Distance (Closest)":"Name (A-Z)");setRefresh(n=>n+1)}}><Search size={16}/> Find Nearest</button>
          {appliedNear&&<small>Approximate postcode-centre distance from {appliedNear}; not GPS</small>}
        </div>
        <button className="xd-directory-clear" onClick={clear}><RefreshCw size={15}/> Clear Filters</button>
      </aside>
      <div className="xd-directory-results">
        {error&&<div className="xd-directory-alert" role="alert"><ShieldAlert size={22}/><div><strong>{isAuthError(error)?"Staging Directory requires authentication":"Directory unavailable"}</strong><p>{error}</p>
          {isAuthError(error)&&<small>Sign in to your authorized XDrive Staging account. No synthetic members are substituted.</small>}</div>
        </div>}
        {warnings.map((w,i)=><div className="xd-directory-warning" role="status" key={i}>{w}</div>)}
        {appliedNear&&<div className="xd-directory-warning">Distances are estimates between postcode centres. Records without resolvable coordinates are excluded from nearest results.</div>}
        <div className="xd-directory-result-bar">
          <div><strong>{tab}</strong><small>{loading?"Loading authorized members…":visible.length+" visible loaded record(s)"}{paging.partial?" · More pages available":""}</small></div>
          <span>Restricted to Staging permissions · No public directory access</span>
        </div>
        {loading&&all.length===0?<div className="xd-directory-empty">Loading authorized Directory records…</div>
          :visible.length===0?<div className="xd-directory-empty">
            {error?"Member records are not available in this session.":"No members match these filters in the loaded records."}
          </div>:<div className="xd-directory-cards">
            {visible.map(m=><article className={"xd-directory-card "+(m.kind==="driver"?"driver":"company")} key={m.kind+":"+m.id}>
              <div className="xd-directory-identity">
                <span className="xd-directory-avatar">{m.kind==="company"?<Building2 size={25}/>:<UserRound size={25}/>}</span>
                <div><button className="xd-directory-member-name" onClick={()=>profile(m)}>{m.name}</button>
                  <small>{m.kind==="driver"?readable(m.companyName):m.memberType}</small>
                  <small>Member ID: {m.memberId||"Not supplied in Staging"}</small>
                </div>
              </div>
              <div className="xd-directory-cell"><label>Location</label><strong>{[m.city,m.postcode].filter(Boolean).join(", ")||"Not supplied"}</strong>
                <small>{m.distanceMiles!==null?m.distanceMiles.toFixed(1)+" miles · postcode estimate":readable(m.country)}</small></div>
              <div className="xd-directory-cell"><label>Vehicle / Capability</label>
                <strong>{m.vehicleTypes.length?m.vehicleTypes.join(", "):"Not supplied"}</strong>
                <small>{m.specialistServices.length?m.specialistServices.join(", "):"Services not supplied"}{m.maxPallets!==null?" · up to "+m.maxPallets+" pallets":""}</small>
              </div>
              <div className="xd-directory-cell xd-directory-status"><label>{m.kind==="driver"?"Reported availability":"Member type"}</label>
                <span className={"xd-directory-status-pill "+(m.availability?.toLowerCase()==="available"?"available":"")}>{m.kind==="driver"?readable(m.availability):m.memberType}</span>
                <small>{m.kind==="driver"?"Status is not a live GPS signal":"Compliance not verified"}</small>
              </div>
              <div className="xd-directory-card-actions">
                <button className="xd-directory-outline" onClick={()=>profile(m)}>View Profile</button>
                <button className="xd-directory-icon" title={isSaved(m)?"Remove from saved":"Save member in this DEMO browser"}
                  aria-label={isSaved(m)?"Remove saved member":"Save member"} onClick={()=>toggleSave(m)}>
                  <Star size={17} fill={isSaved(m)?"#f4aa0b":"none"} color={isSaved(m)?"#b77d04":"#1769e8"}/></button>
                <button className="xd-directory-icon" title="Open local DEMO messaging" aria-label={"Message "+m.name} onClick={()=>message(m)} disabled={!onMessage}>
                  <MessageCircle size={17}/></button>
                {m.kind==="company"&&m.businessPhone&&<a title="Call business phone" aria-label={"Call "+m.name} href={"tel:"+m.businessPhone}><Phone size={16}/></a>}
              </div>
            </article>)}
          </div>}
        {!loading&&(paging.hasMoreCompanies||paging.hasMoreDrivers)&&<div className="xd-directory-paging">
          <p>More records are available under your current permissions. Filters apply to loaded records.</p>
          <button onClick={more}>Load More Members <ChevronDown size={17}/></button></div>}
        {notice&&<div className="xd-directory-notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice("")}><X size={15}/></button></div>}
        <p className="xd-directory-privacy">Directory details are limited to records permitted by Staging row-level security. Member IDs, verification status and documents are not inferred. Saved members are stored only in this browser.</p>
      </div>
    </div>
    {selected&&<div className="xd-directory-overlay" onClick={()=>setSelected(null)}>
      <div className="xd-directory-profile" role="dialog" aria-modal="true" aria-label={"Member profile "+selected.name} onClick={e=>e.stopPropagation()}>
        <header><span className="xd-directory-profile-avatar">{selected.kind==="company"?<Building2 size={28}/>:<UserRound size={28}/>}</span>
          <div><h2>{selected.name}</h2><p>{selected.kind==="company"?selected.memberType:readable(selected.companyName)} · Member ID {selected.memberId||"not supplied"}</p></div>
          <button aria-label="Close member profile" onClick={()=>setSelected(null)}><X size={20}/></button>
        </header>
        <nav aria-label="Member profile sections">{profileTabs.map(t=><button key={t} className={profileTab===t?"active":""}
          onClick={()=>setProfileTab(t)}>{t}</button>)}</nav>
        <div className="xd-directory-profile-body">
          {profileTab==="Member Details"&&<div className="xd-directory-profile-grid">
            <div><label>Member / Display Name</label><strong>{selected.name}</strong></div>
            <div><label>Member Type</label><strong>{memberTypeKind(selected)}</strong></div>
            <div><label>Company</label><strong>{readable(selected.companyName)}</strong></div>
            <div><label>Location</label><strong>{address(selected)}</strong></div>
            <div><label>Member ID</label><strong>{readable(selected.memberId)}</strong></div>
            <div><label>Record Created</label><strong>{formatMemberDate(selected.recordCreatedAt)}</strong></div>
            <div><label>Reported Availability</label><strong>{readable(selected.availability)}</strong></div>
            <div><label>Distance from Search</label><strong>{selected.distanceMiles!==null?selected.distanceMiles.toFixed(1)+" mi (postcode approximate)":"Not available"}</strong></div>
          </div>}
          {profileTab==="Vehicles & Services"&&<div className="xd-directory-profile-grid">
            <div><label>Recorded Vehicle Types</label><strong>{selected.vehicleTypes.length?selected.vehicleTypes.join(", "):"Not supplied"}</strong></div>
            <div><label>Maximum Recorded Pallet Capacity</label><strong>{selected.maxPallets??"Not supplied"}</strong></div>
            <div><label>Capabilities</label><strong>{selected.specialistServices.length?selected.specialistServices.join(", "):"Not supplied"}</strong></div>
            <div><label>Document Verification</label><strong>Not available in DEMO Directory</strong></div>
          </div>}
          {profileTab==="Compliance"&&<div className="xd-directory-profile-warning"><ShieldAlert size={24}/><div>
            <strong>Verification details unavailable</strong><p>No licence, insurance, MOT, ID, CPC or business documents are retrieved by this Staging Directory endpoint. None are certified as compliant.</p>
          </div></div>}
        </div>
        <footer>
          <button onClick={()=>toggleSave(selected)}><Star size={16}/>{isSaved(selected)?"Remove Saved":"Save Member"}</button>
          {onMessage&&<button onClick={()=>{message(selected);setSelected(null)}}><MessageCircle size={16}/> Message</button>}
          {selected.kind==="company"&&onPostLoad&&<button className="xd-directory-primary" onClick={()=>{setSelected(null);onPostLoad()}}>Post Load <ArrowRight size={17}/></button>}
          <button onClick={()=>setSelected(null)}>Close</button>
        </footer>
      </div>
    </div>}
  </section>;
}
