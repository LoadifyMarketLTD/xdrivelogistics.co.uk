"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {
  Activity, ArrowRight, Building2, Check, CheckCircle2, ChevronRight, ClipboardCopy,
  Cloud, Code2, CreditCard, Database, Download, ExternalLink, FileSpreadsheet,
  FileText, Link2, Mail, MapPin, MapPinned, PackageCheck, Route, ScanLine,
  Settings, ShieldCheck, SlidersHorizontal, Truck, Upload, UserRound, UsersRound,
  Weight, Wrench, X, LayoutGrid, Search,
} from "lucide-react";
import {authenticatedDemoFetch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import {useDemoLoads} from "./demoExchange";
import {useDemoQuotes} from "./DemoQuotes";
import "./demo-network-tools-board.css";

type DirectoryMember={id:string;name:string;area?:string;type?:string};
type Tab="Overview"|"Integrations"|"Operational Tools"|"Data & Export"|"API & Access"|"Settings";
type Utility="Route Planner"|"Distance & ETA"|"Postcode Tools"|"Address Lookup"|"Document Scanner"|"POD & ePOD"|"Weight & Load"|"Export & Reports";
type LookupResponse={suggestions?:string[];addresses?:string[];streets?:string[];area?:string;display?:string;complete?:boolean;error?:string};
type AttachedFile={name:string;size:number;type:string;url:string};
const tabs:Tab[]=["Overview","Integrations","Operational Tools","Data & Export","API & Access","Settings"];
const localKey="xdrive-company-network-tools-prefs-v1";
const integrations=[
  {name:"Supabase (Database)",description:"Staging database and member data",icon:Database,color:"#14a44d"},
  {name:"Stripe (Payments)",description:"Subscription and billing integration",icon:CreditCard,color:"#6548dd"},
  {name:"Mapbox (Maps & Routes)",description:"Routing and location services",icon:MapPin,color:"#166de8"},
  {name:"Email (Notifications)",description:"Notification delivery",icon:Mail,color:"#ed8b14"},
];
const networkGroups=[
  {name:"Customers / Shippers",category:"customer",icon:UserRound,color:"#176de5",go:10},
  {name:"Brokers / Companies",category:"broker",icon:Building2,color:"#176de5",go:10},
  {name:"Carriers",category:"carrier",icon:Truck,color:"#f58116",go:10},
  {name:"Owner Drivers",category:"owner",icon:UsersRound,color:"#176de5",go:10},
  {name:"Company Drivers",category:"company driver",icon:UsersRound,color:"#176de5",go:6},
];
const tools:{name:Utility;detail:string;icon:typeof Route;color:string}[]=[
  {name:"Route Planner",detail:"Plan and open routes",icon:Route,color:"#176de5"},
  {name:"Distance & ETA",detail:"Calculate via a routing service",icon:MapPinned,color:"#e98713"},
  {name:"Postcode Tools",detail:"Validate and look up postcodes",icon:MapPin,color:"#176de5"},
  {name:"Address Lookup",detail:"Find available addresses",icon:Search,color:"#f18a0e"},
  {name:"Document Scanner",detail:"Attach local documents",icon:ScanLine,color:"#7c3aed"},
  {name:"POD & ePOD",detail:"Proof of delivery & signatures",icon:PackageCheck,color:"#16a34a"},
  {name:"Weight & Load",detail:"Pallet, weight and volume tools",icon:Weight,color:"#176de5"},
  {name:"Export & Reports",detail:"Export visible DEMO records",icon:FileSpreadsheet,color:"#176de5"},
];

function csvEscape(value:unknown){return '"'+String(value??"").replaceAll('"','""')+'"'}
function createDownload(name:string,content:string,mime:string){
  const blob=new Blob(["\uFEFF",content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function csvOf(rows:(string|number|boolean|null|undefined)[][]){
  return rows.map(r=>r.map(csvEscape).join(",")).join("\r\n");
}
function classify(member:DirectoryMember,category:string){
  const t=(member.type||"").toLowerCase();
  if(category==="customer")return /customer|shipper/.test(t);
  if(category==="broker")return /broker|company/.test(t)&&!/driver/.test(t);
  if(category==="carrier")return /carrier|transport/.test(t);
  if(category==="owner")return /owner/.test(t);
  return /company driver|employed driver/.test(t);
}
const ukPostcode=/^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i;

export default function DemoNetworkToolsBoard({onNavigate}:{onNavigate:(index:number)=>void}){
  const loads=useDemoLoads();
  const sent=useDemoQuotes("mine");
  const received=useDemoQuotes("received");
  const [active,setActive]=useState<Tab>("Overview");
  const [tool,setTool]=useState<Utility|null>(null);
  const [members,setMembers]=useState<DirectoryMember[]>([]);
  const [directoryState,setDirectoryState]=useState<"loading"|"ready"|"error">("loading");
  const [directoryError,setDirectoryError]=useState("");
  const [recordAccess,setRecordAccess]=useState<{loads:boolean;quotes:boolean;checked:boolean}>({loads:false,quotes:false,checked:false});
  const [selectedIntegration,setSelectedIntegration]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const [origin,setOrigin]=useState(""),[destination,setDestination]=useState("");
  const [postcode,setPostcode]=useState(""),[lookup,setLookup]=useState<LookupResponse|null>(null);
  const [lookupError,setLookupError]=useState(""),[lookingUp,setLookingUp]=useState(false);
  const [pallets,setPallets]=useState(""),[weight,setWeight]=useState(""),[length,setLength]=useState("");
  const [width,setWidth]=useState(""),[height,setHeight]=useState("");
  const [attachment,setAttachment]=useState<AttachedFile|null>(null);
  const [importedName,setImportedName]=useState(""),[importedPreview,setImportedPreview]=useState<string[][]>([]);
  const [radius,setRadius]=useState("10"),[showWarnings,setShowWarnings]=useState(true);
  const [settingsReady,setSettingsReady]=useState(false);
  const filePicker=useRef<HTMLInputElement>(null);
  const importPicker=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    let active=true;
    const loadMembers=async()=>{
      try{
        const response=await authenticatedDemoFetch("/api/try-xdrive-demo/directory",{cache:"no-store"});
        const data:unknown=await response.json().catch(()=>null);
        if(!response.ok)throw new Error("Directory unavailable ("+response.status+")");
        if(!Array.isArray(data))throw new Error("Unexpected directory response");
        if(active){setMembers(data as DirectoryMember[]);setDirectoryState("ready");setDirectoryError("")}
      }catch(err){
        if(active){setMembers([]);setDirectoryState("error");setDirectoryError(err instanceof Error?err.message:"Directory unavailable")}
      }
    };
    void loadMembers();return()=>{active=false};
  },[]);
  useEffect(()=>{
    let mounted=true;
    void Promise.all([
      authenticatedDemoFetch("/api/try-xdrive-demo/loads",{cache:"no-store"}),
      authenticatedDemoFetch("/api/try-xdrive-demo/quotes",{cache:"no-store"}),
    ]).then(([l,q])=>{if(mounted)setRecordAccess({loads:l.ok,quotes:q.ok,checked:true})})
      .catch(()=>{if(mounted)setRecordAccess({loads:false,quotes:false,checked:true})});
    return()=>{mounted=false};
  },[]);
  useEffect(()=>{
    try{
      const raw=localStorage.getItem(localKey);
      if(raw){const p=JSON.parse(raw) as {radius?:string;showWarnings?:boolean};
        if(typeof p.radius==="string"&&["5","10","25","50","100"].includes(p.radius))setRadius(p.radius);
        if(typeof p.showWarnings==="boolean")setShowWarnings(p.showWarnings);
      }
    }catch{ /* Local preference recovery is optional; defaults remain safe. */ }
    setSettingsReady(true);
  },[]);
  useEffect(()=>{
    if(!settingsReady)return;
    try{localStorage.setItem(localKey,JSON.stringify({radius,showWarnings}));}
    catch{ /* Browser may deny local persistence. Settings remain in this session. */ }
  },[radius,showWarnings,settingsReady]);
  useEffect(()=>()=>{if(attachment)URL.revokeObjectURL(attachment.url)},[attachment]);
  const quotes=useMemo(()=>[...sent,...received.filter(q=>!sent.some(s=>s.id===q.id))],[sent,received]);
  const awarded=loads.filter(l=>l.status==="Awarded");
  const completed=loads.filter(l=>l.podReceived);
  const quotesExchanged=quotes.length;
  const visibleMemberCount=directoryState==="ready"?String(members.length):"—";
  const memberCount=(category:string)=>directoryState==="ready"?String(members.filter(m=>classify(m,category)).length):"—";
  const countInfo=directoryState==="loading"?"Checking member access":directoryState==="error"?"Directory access unavailable":"Visible members only";
  const topStats=[
    {label:"Network Partners",value:visibleMemberCount,note:countInfo,icon:UsersRound,tone:"#fa7417"},
    {label:"In Your Directory",value:"—",note:"Saved partners not connected",icon:Building2,tone:"#176de5"},
    {label:"Active Integrations",value:"—",note:"Connection status not verified",icon:Link2,tone:"#12a034"},
    {label:"Tools Available",value:String(tools.length),note:"Operational utilities",icon:Wrench,tone:"#f18a0e"},
    {label:"Data Sync",value:"DEMO",note:"Live sync not verified",icon:Cloud,tone:"#176de5"},
  ];
  const go=(idx:number)=>onNavigate(idx);
  const copyApiPath=async(path:string)=>{
    try{await navigator.clipboard.writeText(path);setNotice("API path copied.");return;}
    catch{ /* Some browsers restrict Clipboard API even on localhost. */ }
    const textarea=document.createElement("textarea");textarea.value=path;textarea.setAttribute("readonly","");
    textarea.style.position="fixed";textarea.style.left="-9999px";document.body.appendChild(textarea);textarea.select();
    let copied=false;try{copied=document.execCommand("copy")}catch{copied=false}textarea.remove();
    setNotice(copied?"API path copied.":"Clipboard access unavailable. Select and copy the displayed API path.");
  };
  const setTab=(name:Tab)=>{setActive(name);setTool(null);setNotice("")};
  const openTool=(name:Utility)=>{setTool(name);setActive("Operational Tools");setNotice("")};
  const exportLoads=()=>createDownload("xdrive-demo-loads.csv",csvOf([
    ["Reference","Collection","Delivery","Vehicle","Pallets","Weight (kg)","Status","Customer","POD"],
    ...loads.map(l=>[l.id,l.from,l.to,l.vehicle,l.pallets,l.weight,l.status,l.customer,l.podReceived?"Yes":"No"])
  ]),"text/csv;charset=utf-8");
  const exportQuotes=()=>createDownload("xdrive-demo-quotes.csv",csvOf([
    ["Quote ID","Load Reference","Role","Amount GBP","Status","Submitted"],
    ...quotes.map(q=>[q.id,q.loadId,q.role,q.amount,q.status,q.createdAt])
  ]),"text/csv;charset=utf-8");
  const exportJson=()=>createDownload("xdrive-demo-operations.json",JSON.stringify({
    source:"XDrive Company DEMO — records visible to the current session",
    exportedAt:new Date().toISOString(),
    loads:loads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,pallets:l.pallets,
      weight:l.weight,status:l.status,podReceived:Boolean(l.podReceived)})),
    quotes:quotes.map(q=>({id:q.id,loadId:q.loadId,amount:q.amount,status:q.status}))
  },null,2),"application/json");
  const directions=origin.trim()&&destination.trim()?
    "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(origin.trim())+
    "&destination="+encodeURIComponent(destination.trim())+"&travelmode=driving":null;
  const lookUpPostcode=async()=>{
    if(!postcode.trim())return;
    setLookingUp(true);setLookup(null);setLookupError("");
    try{
      const response=await fetch("/api/try-xdrive-demo/postcode?postcode="+encodeURIComponent(postcode.trim()),{cache:"no-store"});
      const result=await response.json() as LookupResponse;
      if(!response.ok)throw new Error(result.error||"Postcode lookup unavailable");
      setLookup(result);
    }catch(err){setLookupError(err instanceof Error?err.message:"Lookup failed")}
    finally{setLookingUp(false)}
  };
  const attachFile=(file:File|undefined)=>{
    if(!file)return;
    if(file.size>10*1024*1024||!(file.type==="application/pdf"||file.type.startsWith("image/"))){
      setNotice("Only PDF and images up to 10 MB are supported in this DEMO.");return;
    }
    setAttachment({name:file.name,size:file.size,type:file.type,url:URL.createObjectURL(file)});
    setNotice("The selected file is available only in this browser session; no upload occurred.");
  };
  const importCsv=async(file:File|undefined)=>{
    if(!file)return;
    if(file.size>2*1024*1024||!(file.name.toLowerCase().endsWith(".csv")||file.type==="text/csv")){
      setNotice("Preview supports CSV files up to 2 MB.");return;
    }
    try{
      const text=await file.text();
      const lines=text.split(/\r?\n/).filter(Boolean).slice(0,12);
      setImportedPreview(lines.map(line=>line.split(",")));setImportedName(file.name);
      setNotice("CSV preview loaded locally. No records have been imported into XDrive.");
    }catch{setNotice("Unable to read this CSV file.")}
  };
  const volume=Number(length)*Number(width)*Number(height);
  const validDims=[length,width,height].every(v=>v.trim()!==""&&Number(v)>0);
  const validKg=weight.trim()!==""&&Number(weight)>=0;
  const validPallets=pallets.trim()!==""&&Number(pallets)>=0;
  const toolContent=()=>{
    if(!tool)return null;
    if(tool==="Route Planner"||tool==="Distance & ETA")return <div className="xd-network-tool-form">
      <p>Enter the collection and delivery points. The route opens in Google Maps, where current road distances, restrictions and travel times can be checked. No ETA is invented by this DEMO.</p>
      <div className="xd-network-form-grid">
        <label>Collection location<input aria-label="Route collection location" value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="e.g. BB1 9QL"/></label>
        <label>Delivery location<input aria-label="Route delivery location" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="e.g. DA8 1NY"/></label>
      </div>
      {directions?<a className="xd-network-primary xd-network-external" href={directions} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Open route and ETA in Google Maps</a>
        :<button className="xd-network-primary" disabled>Enter both locations to plan route</button>}
      <small>Check vehicle height, weight, access restrictions and applicable road charges independently before driving.</small>
    </div>;
    if(tool==="Postcode Tools"||tool==="Address Lookup")return <div className="xd-network-tool-form">
      <p>Search the DEMO postcode service for available town, street and address results. Nearby street suggestions are approximate and require manual verification.</p>
      <div className="xd-network-form-grid">
        <label>UK postcode<input aria-label="Lookup postcode" value={postcode} onChange={e=>setPostcode(e.target.value.toUpperCase())} placeholder="e.g. BB1 9QL"/></label>
        <button className="xd-network-primary" disabled={lookingUp||!postcode.trim()} onClick={()=>void lookUpPostcode()}><Search size={16}/>{lookingUp?"Searching…":"Search postcode"}</button>
      </div>
      {postcode.trim()&&<p className="xd-network-validation">Format: {ukPostcode.test(postcode.trim())?"Valid UK postcode format":"Not yet a complete UK postcode"}. This is syntax validation only.</p>}
      {lookupError&&<p role="alert" className="xd-network-error">{lookupError}</p>}
      {lookup&&<div className="xd-network-lookup-results">
        <strong>{lookup.area||lookup.display||"Lookup results"}</strong>
        {lookup.suggestions?.length? <p>Suggestions: {lookup.suggestions.slice(0,8).join(", ")}</p>:null}
        {lookup.addresses?.length?<ul>{lookup.addresses.slice(0,10).map((a,i)=><li key={i}>{a}</li>)}</ul>:null}
        {lookup.streets?.length?<p>Nearby streets: {lookup.streets.slice(0,10).join(", ")}</p>:null}
        {!lookup.suggestions?.length&&!lookup.addresses?.length&&!lookup.streets?.length&&<p>No detailed addresses returned. Enter the full address manually.</p>}
      </div>}
    </div>;
    if(tool==="Document Scanner")return <div className="xd-network-tool-form">
      <p>Attach a document or a photograph to preview it locally. The DEMO does not perform OCR, send documents or certify compliance.</p>
      <input ref={filePicker} aria-label="Choose document" type="file" accept="application/pdf,image/*" hidden
        onChange={e=>attachFile(e.target.files?.[0])}/>
      <button className="xd-network-primary" onClick={()=>filePicker.current?.click()}><Upload size={17}/> Choose PDF or image</button>
      {attachment&&<div className="xd-network-file-preview"><FileText size={22}/><span>{attachment.name} · {(attachment.size/1024).toFixed(0)} KB</span>
        <a download={attachment.name} href={attachment.url}><Download size={16}/> Download local copy</a>
        <button aria-label="Remove document" onClick={()=>setAttachment(null)}><X size={16}/></button>
      </div>}
    </div>;
    if(tool==="POD & ePOD")return <div className="xd-network-tool-form">
      <p>POD records belong to bookings. The DEMO currently has <strong>{recordAccess.loads?completed.length:"—"}</strong> load(s) with POD marked as received. Use the booking workflow to review actual files and status.</p>
      <button className="xd-network-primary" onClick={()=>go(4)}><PackageCheck size={17}/> Open Bookings and POD</button>
    </div>;
    if(tool==="Weight & Load")return <div className="xd-network-tool-form">
      <p>Calculate load volume from entered dimensions. Vehicle limits must be checked against the actual registration and payload documentation.</p>
      <div className="xd-network-form-grid">
        <label>Number of pallets<input aria-label="Number of pallets" min="0" type="number" value={pallets} onChange={e=>setPallets(e.target.value)}/></label>
        <label>Total cargo weight (kg)<input aria-label="Cargo weight kg" min="0" type="number" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
        <label>Length (metres)<input aria-label="Cargo length metres" min="0" step="0.01" type="number" value={length} onChange={e=>setLength(e.target.value)}/></label>
        <label>Width (metres)<input aria-label="Cargo width metres" min="0" step="0.01" type="number" value={width} onChange={e=>setWidth(e.target.value)}/></label>
        <label>Height (metres)<input aria-label="Cargo height metres" min="0" step="0.01" type="number" value={height} onChange={e=>setHeight(e.target.value)}/></label>
      </div>
      <div className="xd-network-calculated">
        <span><strong>{validDims?volume.toFixed(2)+" m³":"—"}</strong><small>Calculated cargo volume</small></span>
        <span><strong>{validKg?Number(weight).toLocaleString("en-GB")+" kg":"—"}</strong><small>Entered cargo weight</small></span>
        <span><strong>{validPallets?String(Number(pallets)):"—"}</strong><small>Pallets</small></span>
      </div>
      <small>These are arithmetic results, not a vehicle-capacity or regulatory clearance.</small>
    </div>;
    return <div className="xd-network-tool-form"><p>Download records visible to your Company DEMO session, or open the reports dashboard.</p>
      <div className="xd-network-tool-actions"><button onClick={exportLoads}><Download size={16}/> Export Loads CSV</button>
        <button onClick={exportQuotes}><Download size={16}/> Export Quotes CSV</button>
        <button onClick={()=>go(16)}><Activity size={16}/> View Reports</button>
      </div>
    </div>;
  };

  return <section className="xd-network-board" aria-label="Network and Tools">
    <p className="xd-network-intro">Manage your network, integrations and operational tools</p>
    <div className="xd-network-kpis">{topStats.map(item=><article className="xd-network-kpi" style={{borderLeftColor:item.tone}} key={item.label}>
      <item.icon style={{color:item.tone}} size={35} strokeWidth={2.2}/>
      <div><b>{item.label}</b><strong>{item.value}</strong><small>{item.note}</small></div>
    </article>)}</div>
    <nav className="xd-network-tabs" aria-label="Network tool sections">{tabs.map((name,i)=>{
      const icons=[LayoutGrid,Link2,Wrench,Download,Code2,Settings];const Icon=icons[i];
      return <button key={name} className={active===name?"active":""} aria-current={active===name?"page":undefined} onClick={()=>setTab(name)}>
        <Icon size={19}/>{name}
      </button>;
    })}</nav>

    {active==="Overview"&&<>
      <div className="xd-network-overview-grid">
        <article className="xd-network-panel">
          <h2><UsersRound size={23}/> Your Network</h2>
          <div className="xd-network-row-list">{networkGroups.map(group=><button key={group.name} onClick={()=>go(group.go)}>
            <group.icon size={21} style={{color:group.color}}/><span>{group.name}</span><b>{memberCount(group.category)}</b><ChevronRight size={19}/>
          </button>)}</div>
          {directoryState==="error"&&<small className="xd-network-panel-note">Directory unavailable: {directoryError}. Counts cannot be verified.</small>}
          {directoryState==="ready"&&<small className="xd-network-panel-note">Counts reflect only accessible directory members, not all platform users.</small>}
        </article>
        <article className="xd-network-panel">
          <h2><Activity size={23}/> Partner Activity <small>(visible DEMO records)</small></h2>
          <div className="xd-network-activity-list">
            <div><UsersRound size={20} color="#15a23a"/><span>New connections</span><b>—</b></div>
            <div><Link2 size={20} color="#176de5"/><span>Quotes exchanged</span><b>{recordAccess.quotes?quotesExchanged:"—"}</b></div>
            <div><Truck size={20} color="#f18a0e"/><span>Bookings awarded</span><b>{recordAccess.loads?awarded.length:"—"}</b></div>
            <div><Check size={20} color="#15a23a"/><span>Jobs completed (POD)</span><b>{recordAccess.loads?completed.length:"—"}</b></div>
          </div>
          <small className="xd-network-panel-note">{recordAccess.checked&&!recordAccess.loads&&!recordAccess.quotes
  ?"Load and quote records require an authenticated DEMO session."
  :"No partner history or historical 7-day series is available."}</small>
        </article>
        <article className="xd-network-panel">
          <h2><Link2 size={23}/> Integrations <span className="xd-network-neutral-pill">Unverified</span></h2>
          <div className="xd-network-row-list">{integrations.map(item=><button key={item.name} onClick={()=>{setSelectedIntegration(item.name);setTab("Integrations")}}>
            <item.icon size={22} style={{color:item.color}}/><span>{item.name}</span><b className="xd-network-status-unverified">Not checked</b><ChevronRight size={19}/>
          </button>)}</div>
        </article>
      </div>
      <div className="xd-network-overview-bottom">
        <article className="xd-network-panel xd-network-ops-panel">
          <h2><Wrench size={24}/> Operational Tools</h2>
          <div className="xd-network-tools-grid">{tools.map(item=><button key={item.name} onClick={()=>openTool(item.name)}>
            <item.icon size={28} style={{color:item.color}}/><span><strong>{item.name}</strong><small>{item.detail}</small></span>
          </button>)}</div>
        </article>
        <article className="xd-network-panel xd-network-quick">
          <h2><Activity size={24} color="#f59e0b"/> Quick Actions</h2>
          <button onClick={()=>go(10)}><UsersRound size={21}/> Manage Directory <ChevronRight size={18}/></button>
          <button onClick={()=>setTab("Data & Export")}><Download size={21}/> Import / Export Data <ChevronRight size={18}/></button>
          <button onClick={()=>setTab("API & Access")}><Code2 size={21}/> API Access & Keys <ChevronRight size={18}/></button>
          <button onClick={()=>setTab("Settings")}><Settings size={21}/> Network Settings <ChevronRight size={18}/></button>
        </article>
      </div>
    </>}

    {active==="Integrations"&&<div className="xd-network-detail-grid">
      <article className="xd-network-panel"><h2><Link2 size={23}/> Integration Services</h2><p>Services listed here are part of the intended platform architecture. Connection health is not established from this DEMO page.</p>
        <div className="xd-network-integration-list">{integrations.map(item=><button key={item.name} className={selectedIntegration===item.name?"selected":""}
          onClick={()=>setSelectedIntegration(item.name)}><item.icon color={item.color} size={24}/><span><strong>{item.name}</strong><small>{item.description}</small></span><em>Not verified</em><ChevronRight size={18}/></button>)}</div>
      </article>
      <article className="xd-network-panel"><h2><ShieldCheck size={23}/> Connection Details</h2>
        {selectedIntegration? <><h3>{selectedIntegration}</h3><p>No authenticated server-side health check is available here. This page does not expose API keys or perform a live billing operation.</p>
          <button className="xd-network-outline" onClick={()=>setSelectedIntegration(null)}>Back to integration list</button></>:
          <p>Select a service to review its current DEMO limitations.</p>}
        <div className="xd-network-info">A green Connected indicator must only appear after a trusted integration health check.</div>
      </article>
    </div>}

    {active==="Operational Tools"&&<>
      <div className="xd-network-panel xd-network-tool-landing"><h2><Wrench size={23}/> Operational Tools</h2>
        <div className="xd-network-tools-grid">{tools.map(item=><button key={item.name} className={tool===item.name?"selected":""}
          onClick={()=>openTool(item.name)}><item.icon size={27} style={{color:item.color}}/><span><strong>{item.name}</strong><small>{item.detail}</small></span></button>)}</div>
      </div>
      {tool&&<article className="xd-network-panel xd-network-tool-detail"><div className="xd-network-detail-title">
        <h2>{tool}</h2><button aria-label="Close selected tool" onClick={()=>setTool(null)}><X size={19}/></button>
      </div>{toolContent()}</article>}
    </>}

    {active==="Data & Export"&&<div className="xd-network-detail-grid">
      <article className="xd-network-panel"><h2><Download size={23}/> Export DEMO Data</h2>
        <p>Exports include only loads and quotes available to the current browser session. No database write is performed.</p>
        <div className="xd-network-export-actions">
          <button onClick={exportLoads}><FileSpreadsheet size={24}/> Loads CSV <small>{loads.length} visible loads</small></button>
          <button onClick={exportQuotes}><FileSpreadsheet size={24}/> Quotes CSV <small>{quotes.length} visible quotes</small></button>
          <button onClick={exportJson}><Download size={24}/> Operations JSON <small>Selected non-sensitive fields</small></button>
          <button onClick={()=>go(16)}><Activity size={24}/> Open Reports <small>Detailed operational reporting</small></button>
        </div>
      </article>
      <article className="xd-network-panel"><h2><Upload size={23}/> Import Preview</h2>
        <p>Review a CSV file locally before a future verified import workflow. No imported rows are written to XDrive.</p>
        <input type="file" accept=".csv,text/csv" hidden ref={importPicker} aria-label="Import CSV file"
          onChange={e=>void importCsv(e.target.files?.[0])}/>
        <button className="xd-network-primary" onClick={()=>importPicker.current?.click()}><Upload size={16}/> Select CSV File</button>
        {importedName&&<div className="xd-network-import-preview"><strong>{importedName}</strong>
          <p>{importedPreview.length} preview line(s), including header</p>
          <div className="xd-network-import-scroll"><table><tbody>{importedPreview.map((row,i)=><tr key={i}>{row.slice(0,6).map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
        </div>}
      </article>
    </div>}

    {active==="API & Access"&&<div className="xd-network-detail-grid">
      <article className="xd-network-panel"><h2><Code2 size={23}/> DEMO API & Access</h2>
        <p>Staging APIs are protected by authentication and row-level access controls. This screen does not display tokens or API secrets.</p>
        {[
          {name:"Loads",endpoint:"/api/try-xdrive-demo/loads",purpose:"Load and booking data"},
          {name:"Quotes",endpoint:"/api/try-xdrive-demo/quotes",purpose:"Quote records"},
          {name:"Directory",endpoint:"/api/try-xdrive-demo/directory",purpose:"Visible directory members"},
          {name:"Postcode",endpoint:"/api/try-xdrive-demo/postcode",purpose:"UK postcode search"},
        ].map(api=><div className="xd-network-api-row" key={api.name}>
          <div><strong>{api.name}</strong><code>{api.endpoint}</code><small>{api.purpose}</small></div>
          <button aria-label={"Copy "+api.name+" API path"} onClick={()=>void copyApiPath(api.endpoint)}><ClipboardCopy size={17}/></button>
        </div>)}
      </article>
      <article className="xd-network-panel"><h2><ShieldCheck size={23}/> Access & Security</h2>
        <div className="xd-network-security"><p><CheckCircle2 size={18}/> Only public path names are displayed</p>
          <p><CheckCircle2 size={18}/> No account keys or secrets are exposed</p>
          <p><ShieldCheck size={18}/> Authorisation is enforced by the API</p></div>
        <p>Access status depends on the authenticated DEMO session; a route being listed here does not prove it is accessible or healthy.</p>
      </article>
    </div>}

    {active==="Settings"&&<div className="xd-network-detail-grid">
      <article className="xd-network-panel"><h2><Settings size={23}/> Local DEMO Preferences</h2>
        <p>Preferences are saved only in this browser. They do not change the production company account or any notification service.</p>
        <label className="xd-network-setting">Preferred search radius
          <select aria-label="Preferred search radius" value={radius} onChange={e=>setRadius(e.target.value)}>
            {["5","10","25","50","100"].map(r=><option key={r} value={r}>{r} miles</option>)}
          </select>
        </label>
        <label className="xd-network-setting xd-network-setting-check"><input type="checkbox" checked={showWarnings} onChange={e=>setShowWarnings(e.target.checked)}/> Show DEMO limitation notices</label>
        <button className="xd-network-outline" onClick={()=>{setRadius("10");setShowWarnings(true);setNotice("Local preferences reset.")}}>Restore Defaults</button>
        <span className="xd-network-settings-status">{settingsReady?"Preferences active in this browser":"Loading local preferences"}</span>
      </article>
      <article className="xd-network-panel"><h2><SlidersHorizontal size={23}/> Workspace Navigation</h2>
        <div className="xd-network-setting-links"><button onClick={()=>go(10)}>Directory <ArrowRight size={17}/></button>
          <button onClick={()=>go(11)}>Live Availability <ArrowRight size={17}/></button>
          <button onClick={()=>go(12)}>Return Journeys <ArrowRight size={17}/></button>
          <button onClick={()=>go(16)}>Reports <ArrowRight size={17}/></button>
        </div>
      </article>
    </div>}

    {notice&&<div className="xd-network-notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice("")}><X size={16}/></button></div>}
    {showWarnings&&<p className="xd-network-disclaimer">Company DEMO: statistics reflect accessible records only. Unverified services, partner membership, payments and data-sync status are not represented as connected.</p>}
  </section>;
}
