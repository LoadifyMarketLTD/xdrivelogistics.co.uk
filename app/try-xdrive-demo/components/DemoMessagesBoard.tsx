"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {
  Building2, CalendarDays, CheckCheck, ChevronRight, Download, FileImage, FileText,
  Info, Mail, MapPin, MessageCircle, MoreVertical, Paperclip, Phone, Plus,
  Search, Send, Smile, Truck, UsersRound, Video, X, SlidersHorizontal,
} from "lucide-react";
import "./demo-messages-board.css";
import AutonomousMessagesHub from "./AutonomousMessagesHub";

type Kind = "Customers"|"Drivers"|"Companies";
type ChatMessage = {id:string;from:"me"|"them";text:string;time:string};
type Conversation = {
  id:string;name:string;kind:Kind;initials:string;lastTime:string;unread:number;
  messages:ChatMessage[];jobId?:string;memberId?:string;sampleBooking?:boolean;
};
type Job = {id:string;from:string;to:string;vehicle:string;cargo:string;company:string;status:string;
  price:number;driver:string;vehicleId:string;stage:number;pod:boolean};
type Upload = {id:string;name:string;size:string;url:string;type:string};
type DirectoryTarget={id:string;name:string;kind:Kind;requestId:number};
const STORE = "xdrive-company-demo-messages-v2";
const seed:Conversation[] = [
  {id:"skyhaul",name:"Skyhaul Logistics Ltd",kind:"Companies",initials:"SL",lastTime:"10:24",unread:1,
    memberId:"273844",jobId:"XDR-10457",sampleBooking:true,messages:[
      {id:"s1",from:"them",time:"09:12",text:"Hi Daniel, can you confirm the collection time for job XDR-10457?"},
      {id:"s2",from:"me",time:"09:18",text:"Yes, driver is on route now. ETA at collection: 08:30."},
      {id:"s3",from:"them",time:"09:20",text:"Great, please send us the POD once delivered. ✅"},
      {id:"s4",from:"me",time:"10:24",text:"Driver is on site for collection. I'll update the status and send the POD after delivery."},
    ]},
  {id:"john",name:"John P. (Driver)",kind:"Drivers",initials:"JP",lastTime:"09:57",unread:0,
    jobId:"XDR-10457",messages:[
      {id:"j1",from:"them",time:"09:57",text:"POD uploaded. Job completed."},
    ]},
  {id:"baron",name:"Baron Logistics Ltd",kind:"Companies",initials:"BL",lastTime:"09:21",unread:0,
    messages:[{id:"b1",from:"them",time:"09:21",text:"Can you confirm delivery time?"}]},
  {id:"alex",name:"Alex M. (Driver)",kind:"Drivers",initials:"AM",lastTime:"08:46",unread:0,
    messages:[{id:"a1",from:"them",time:"08:46",text:"Running 10 mins late due to traffic."}]},
  {id:"fr",name:"F&R Distribution Ltd",kind:"Companies",initials:"FR",lastTime:"Yesterday",unread:0,
    messages:[{id:"f1",from:"them",time:"Yesterday",text:"Quote accepted. Please allocate."}]},
  {id:"customer",name:"Demo Customer Ltd",kind:"Customers",initials:"DC",lastTime:"Yesterday",unread:0,
    messages:[{id:"c1",from:"them",time:"Yesterday",text:"Please confirm the collection slot."}]},
];
const tabs = ["All","Customers","Drivers","Companies"] as const;
const colors:Record<string,string> = {skyhaul:"#1265e9",john:"#16a34a",baron:"#7c3aed",alex:"#ff8800",fr:"#1265e9",customer:"#0891b2"};

function conversationPreview(c:Conversation){
  return c.messages.length?c.messages[c.messages.length-1].text:"New conversation";
}
function timestamp(){
  return new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
}
function sampleBooking(c:Conversation){
  return c.id==="skyhaul"?{
    id:"XDR-10457",from:"BLACKBURN, BB1",to:"ERITH, DA8",vehicle:"Luton (Tail Lift)",
    cargo:"4 Pallets · 1,200 kg",status:"In Progress",collection:"31 Oct, 08:30",delivery:"31 Oct, ~14:30",
  }:null;
}
function LegacyDemoMessagesBoard({jobs,onBooking,targetRecipient,storageScope="company"}:{jobs:Job[];onBooking:()=>void;targetRecipient?:DirectoryTarget|null;storageScope?:string}){
  const storageKey=storageScope==="company"?STORE:STORE+"-"+storageScope;
  const [conversations,setConversations]=useState<Conversation[]>(seed);
  const [selected,setSelected]=useState("skyhaul");
  const [kind,setKind]=useState<(typeof tabs)[number]>("All");
  const [query,setQuery]=useState("");
  const [draft,setDraft]=useState("");
  const [newOpen,setNewOpen]=useState(false);
  const [recipient,setRecipient]=useState("");
  const [recipientKind,setRecipientKind]=useState<Kind>("Companies");
  const [detailOpen,setDetailOpen]=useState(true);
  const [moreOpen,setMoreOpen]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [onlyUnread,setOnlyUnread]=useState(false);
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [uploads,setUploads]=useState<Record<string,Upload[]>>({});
  const [notice,setNotice]=useState("");
  const [hydrated,setHydrated]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const chatBottom=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(storageKey);
      if(raw){
        const saved=JSON.parse(raw) as {conversations?:Conversation[];selected?:string};
        if(Array.isArray(saved.conversations))setConversations(saved.conversations);
        if(typeof saved.selected==="string")setSelected(saved.selected);
      }
    }catch{setNotice("Local browser storage is unavailable for this DEMO session.")}
    setHydrated(true);
  },[storageKey]);
  useEffect(()=>{
    if(!hydrated)return;
    try{localStorage.setItem(storageKey,JSON.stringify({conversations,selected}));}catch{setNotice("Local browser storage is unavailable for this DEMO session.")}
  },[hydrated,conversations,selected,storageKey]);
  useEffect(()=>{
    if(!hydrated||!targetRecipient)return;
    const id="directory-"+targetRecipient.kind.toLowerCase()+"-"+targetRecipient.id;
    setConversations(current=>current.some(c=>c.id===id)?current:[{
      id,name:targetRecipient.name,kind:targetRecipient.kind,
      initials:targetRecipient.name.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||"").join(""),
      lastTime:"New",unread:0,messages:[]
    },...current]);
    setSelected(id);setKind("All");setQuery("");
  },[hydrated,targetRecipient]);
  const current=conversations.find(c=>c.id===selected)||conversations[0];
  const filtered=useMemo(()=>conversations.filter(c=>
    (kind==="All"||c.kind===kind)&&(!onlyUnread||c.unread>0)&&
    [c.name,conversationPreview(c),c.memberId||""].join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ),[conversations,kind,onlyUnread,query]);
  const unread=conversations.reduce((n,c)=>n+c.unread,0);
  const linked=jobs.find(j=>j.id===current?.jobId);
  const example=current?sampleBooking(current):null;
  const booking=linked?{
    id:linked.id,from:linked.from,to:linked.to,vehicle:linked.vehicle,cargo:linked.cargo,
    status:linked.status,collection:"See booking details",delivery:"See booking details",
  }:example;

  const choose=(id:string)=>{
    setSelected(id);setDraft("");setMoreOpen(false);setNotice("");
    setConversations(xs=>xs.map(c=>c.id===id?{...c,unread:0}:c));
  };
  const send=()=>{
    if(!draft.trim()||!current)return;
    const msg:ChatMessage={id:"msg-"+Date.now(),from:"me",text:draft.trim(),time:timestamp()};
    setConversations(xs=>xs.map(c=>c.id===current.id?
      {...c,lastTime:msg.time,messages:[...c.messages,msg]}:c));
    setDraft("");setEmojiOpen(false);
    setNotice("Mesaj salvat local în DEMO. Nu a fost trimis unui destinatar real.");
  };
  const startConversation=()=>{
    const name=recipient.trim();if(!name)return;
    const exists=conversations.find(c=>c.name.toLowerCase()===name.toLowerCase());
    if(exists){choose(exists.id);}
    else{
      const id="local-"+Date.now();
      setConversations(xs=>[{id,name,kind:recipientKind,initials:name.split(/\s+/).slice(0,2).map(x=>x[0].toUpperCase()).join(""),
        lastTime:"New",unread:0,messages:[]},...xs]);setSelected(id);
    }
    setRecipient("");setNewOpen(false);
  };
  const uploadFiles=(list:FileList|null)=>{
    if(!current||!list)return;
    const accepted=Array.from(list).filter(file=>file.size<=10*1024*1024&&
      (file.type==="application/pdf"||file.type.startsWith("image/")));
    if(accepted.length!==list.length)setNotice("Sunt permise doar PDF și imagini de maximum 10 MB.");
    if(accepted.length){
      const files:Upload[]=accepted.map(f=>({id:"file-"+Date.now()+"-"+f.name,name:f.name,
        size:(f.size/1024).toFixed(0)+" KB",type:f.type,url:URL.createObjectURL(f)}));
      setUploads(u=>({...u,[current.id]:[...(u[current.id]||[]),...files]}));
      setNotice("Fișiere atașate local în sesiunea DEMO; nu au fost trimise.");
    }
    if(fileInput.current)fileInput.current.value="";
  };
  const markUnread=()=>{
    setConversations(xs=>xs.map(c=>c.id===selected?{...c,unread:1}:c));
    setMoreOpen(false);setNotice("Conversația a fost marcată ca necitită.");
  };
  const resetDemo=()=>{
    setConversations(seed);setSelected("skyhaul");setDraft("");setKind("All");setQuery("");
    setMoreOpen(false);setNotice("Conversațiile demonstrative au fost resetate.");
  };
  const alertUnavailable=(type:string)=>{
    setNotice(type+" nu este conectat la un serviciu real în acest DEMO.");
  };
  const attachments=uploads[current?.id]||[];
  if(!current)return <section className="xd-messages"><p>No conversations available.</p></section>;
  return <section className="xd-messages" aria-label="Company messages">
    <div className="xd-message-stats" aria-label="Message summary">
      {[
        {title:"All Messages",count:conversations.length,icon:MessageCircle,color:"#f97316"},
        {title:"Customers",count:conversations.filter(c=>c.kind==="Customers").length,icon:UsersRound,color:"#1464e8"},
        {title:"Drivers",count:conversations.filter(c=>c.kind==="Drivers").length,icon:Truck,color:"#15a23a"},
        {title:"Companies",count:conversations.filter(c=>c.kind==="Companies").length,icon:Building2,color:"#f59e0b"},
        {title:"Unread",count:unread,icon:Mail,color:"#e11d25"},
      ].map(k=><div className="xd-message-stat" key={k.title} style={{borderLeftColor:k.color}}>
        <k.icon className="xd-message-stat-icon" style={{color:k.color}} strokeWidth={2.1}/>
        <div><b>{k.title}</b><strong>{k.count}</strong></div>
      </div>)}
    </div>

    <div className={"xd-message-layout"+(!detailOpen?" details-hidden":"")}>
      <aside className="xd-message-conversations">
        <div className="xd-message-conv-title">
          <h2>Conversations ({conversations.length})</h2>
          <button className="xd-message-primary" onClick={()=>setNewOpen(v=>!v)}><Plus size={17}/> New Message</button>
        </div>
        {newOpen&&<div className="xd-message-new">
          <input aria-label="New recipient name" placeholder="Recipient name or company" value={recipient} onChange={e=>setRecipient(e.target.value)}/>
          <select aria-label="Recipient category" value={recipientKind} onChange={e=>setRecipientKind(e.target.value as Kind)}>
            <option>Customers</option><option>Drivers</option><option>Companies</option>
          </select>
          <button onClick={startConversation} disabled={!recipient.trim()}>Start conversation</button>
        </div>}
        <div className="xd-message-searchbox">
          <Search size={18}/><input aria-label="Search conversations" placeholder="Search messages..." value={query} onChange={e=>setQuery(e.target.value)}/>
          <button className={"xd-message-filter-toggle"+(filtersOpen?" active":"")} aria-label="Message filters" aria-expanded={filtersOpen}
            onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={17}/></button>
        </div>
        {filtersOpen&&<div className="xd-message-search-filter"><label><input type="checkbox" checked={onlyUnread}
          onChange={e=>setOnlyUnread(e.target.checked)}/> Unread only</label><button onClick={()=>{setOnlyUnread(false);setQuery("");setKind("All")}}>Clear filters</button></div>}
        <div className="xd-message-filters" role="tablist" aria-label="Conversation categories">
          {tabs.map(t=><button role="tab" aria-selected={kind===t} key={t} className={kind===t?"active":""} onClick={()=>setKind(t)}>{t}</button>)}
        </div>
        <div className="xd-message-list">
          {filtered.map(c=><button key={c.id} className={"xd-message-contact-row"+(selected===c.id?" active":"")}
            onClick={()=>choose(c.id)}>
            <span className="xd-message-avatar" style={{background:colors[c.id]||"#1464e8"}}>{c.initials}</span>
            <span className="xd-message-conv-copy"><strong>{c.name}</strong><small>{conversationPreview(c)}</small></span>
            <span className="xd-message-contact-meta"><small>{c.lastTime}</small>{c.unread>0&&<b className="xd-message-unread">{c.unread}</b>}</span>
          </button>)}
          {!filtered.length&&<p className="xd-message-empty">No conversations match these filters.</p>}
        </div>
      </aside>

      <div className="xd-message-chat">
        <div className="xd-message-chat-head">
          <span className="xd-message-avatar" style={{background:colors[current.id]||"#1464e8"}}>{current.initials}</span>
          <div className="xd-message-chat-title"><strong>{current.name}</strong><small><span className="xd-message-online-dot"/>DEMO · {current.kind.slice(0,-1)}</small></div>
          <div className="xd-message-head-actions">
            <button aria-label="Call contact" title="Call" onClick={()=>alertUnavailable("Apelul telefonic")}><Phone size={19}/></button>
            <button aria-label="Video call" title="Video call" onClick={()=>alertUnavailable("Apelul video")}><Video size={20}/></button>
            <button aria-label="Conversation details" aria-expanded={detailOpen} title="Conversation details" onClick={()=>setDetailOpen(v=>!v)}><Info size={19}/></button>
            <div className="xd-message-more-wrap">
              <button aria-label="More conversation actions" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><MoreVertical size={20}/></button>
              {moreOpen&&<div className="xd-message-more-menu">
                <button onClick={markUnread}>Mark as unread</button>
                <button onClick={()=>{setDetailOpen(true);setMoreOpen(false)}}>View details</button>
                <button onClick={resetDemo}>Reset DEMO messages</button>
              </div>}
            </div>
          </div>
        </div>
        <div className="xd-message-chat-scroll">
          <div className="xd-message-day">Today ·</div>
          {current.messages.map(m=><div key={m.id} className={"xd-message-message "+(m.from==="me"?"mine":"theirs")}>
            {m.from==="them"&&<span className="xd-message-avatar tiny" style={{background:colors[current.id]||"#1464e8"}}>{current.initials}</span>}
            <div className="xd-message-bubble"><span>{m.text}</span><small>{m.time}{m.from==="me"&&<CheckCheck size={15}/>}</small></div>
          </div>)}
          {!current.messages.length&&<p className="xd-message-no-messages">Start a new local DEMO conversation.</p>}
          <div ref={chatBottom}/>
        </div>
        <div className="xd-message-composer-area">
          {emojiOpen&&<div className="xd-message-emojis">{["🙂","👍","✅","🚚","📍","📦"].map(e=><button key={e} onClick={()=>{setDraft(v=>v+e);setEmojiOpen(false)}}>{e}</button>)}</div>}
          <form className="xd-message-compose" onSubmit={e=>{e.preventDefault();send()}}>
            <input ref={fileInput} type="file" accept=".pdf,image/*" multiple hidden onChange={e=>uploadFiles(e.target.files)}/>
            <button type="button" className="xd-message-attach" aria-label="Attach file" onClick={()=>fileInput.current?.click()}><Paperclip size={21}/></button>
            <div className="xd-message-compose-input"><input aria-label="Type a message" placeholder="Type a message..." value={draft}
              onChange={e=>setDraft(e.target.value)}/><button type="button" aria-label="Insert emoji" onClick={()=>setEmojiOpen(v=>!v)}><Smile size={21}/></button></div>
            <button type="submit" className="xd-message-send" aria-label="Send DEMO message" disabled={!draft.trim()}><Send size={20}/></button>
          </form>
        </div>
      </div>
      {detailOpen&&<aside className="xd-message-details">
        <div className="xd-message-details-title"><h2><Info size={22}/> Conversation Details</h2><button aria-label="Close conversation details" onClick={()=>setDetailOpen(false)}><X size={18}/></button></div>
        <div className="xd-message-contact-info">
          <Building2 size={29}/><div><strong>{current.name}</strong><small>{current.memberId?"Member ID: "+current.memberId+" (sample)":current.kind+" · DEMO profile"}</small></div>
          <span className="xd-message-active">Sample</span>
        </div>
        <div className="xd-message-contact-lines"><p><Phone size={17}/> Contact number not verified</p><p><Mail size={17}/> Messaging via local</p></div>
        <h3 className="xd-message-details-section"><Truck size={19}/> Related Booking <ChevronRight size={19}/></h3>
        {booking?<div className="xd-message-booking">
          <div><strong>{booking.id}</strong><span>{linked?booking.status:"Sample"}</span></div>
          <p className="xd-message-booking-route"><MapPin size={16}/> {booking.from} <span>→</span> {booking.to}</p>
          <p><Truck size={16}/> {booking.vehicle} <span>│</span> {booking.cargo}</p>
          <p><CalendarDays size={16}/> Collection: {booking.collection}</p>
          <p><CalendarDays size={16}/> Delivery: {booking.delivery}</p>
        </div>:<p className="xd-message-muted">No booking linked to this conversation.</p>}
        {booking&&<div className="xd-message-booking-actions"><button disabled={!linked} title={!linked?"Example booking only; no real booking to open":undefined} onClick={onBooking}>View Booking</button></div>}
        <h3 className="xd-message-details-section"><Paperclip size={20}/> Shared Files ({attachments.length+(current.id==="skyhaul"?2:0)}) <ChevronRight size={19}/></h3>
        {current.id==="skyhaul"&&<div className="xd-message-shared-files">
          <div className="xd-message-file"><FileText size={29} color="#ef4444"/><span><b>Booking_Confirmation.pdf</b><small>Example attachment · not available for download</small></span></div>
          <div className="xd-message-file"><FileImage size={29} color="#8b5cf6"/><span><b>POD_Collection.jpg</b><small>Example attachment · not available for download</small></span></div>
        </div>}
        {attachments.map(f=><div className="xd-message-file" key={f.id}>
          {f.type==="application/pdf"?<FileText size={29} color="#ef4444"/>:<FileImage size={29} color="#8b5cf6"/>}
          <span><b>{f.name}</b><small>{f.size} · Local attachment</small></span>
          <a href={f.url} download={f.name} aria-label={"Download "+f.name}><Download size={19}/></a>
        </div>)}
        {attachments.length===0&&current.id!=="skyhaul"&&<p className="xd-message-muted">No files attached.</p>}
        <p className="xd-message-disclaimer">DEMO: example conversations and booking details. Messages are saved in this browser only and are not sent externally.</p>
      </aside>}
    </div>
    {notice&&<div className="xd-message-notice" role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice("")}><X size={15}/></button></div>}
  </section>;
}

/** Preserve the user-approved legacy visual preview outside autonomous mode.
 * New isolated mode must never show fabricated conversations or localStorage chat. */
export default function DemoMessagesBoard(props:{jobs:Job[];onBooking:()=>void;targetRecipient?:DirectoryTarget|null;storageScope?:string}){
 if(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1")
  return <AutonomousMessagesHub onBooking={props.onBooking}/>;
 return <LegacyDemoMessagesBoard {...props}/>;
}
