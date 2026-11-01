"use client";

import {useMemo,useState} from "react";
import {BadgeCheck,BookOpen,CalendarDays,CarFront,ClipboardList,FileText,HelpCircle,MapPin,MessageSquare,Navigation,Search,ShieldCheck,Truck,UserRound,Wallet} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import DemoCompliance from "./DemoCompliance";
import DemoOperationalTools from "./DemoOperationalTools";
import "./owner-driver-more.css";

type Item={name:string;description:string;group:"Account"|"Operations"|"Network";Icon:LucideIcon;network?:string};
const options:Item[]=[
 {name:"Driver Profile",description:"Contact details, licence and home base",group:"Account",Icon:UserRound},
 {name:"My Vehicles",description:"Vehicle registration, height and capacity",group:"Account",Icon:CarFront},
 {name:"Documents & Compliance",description:"Licences, vehicle and compliance records",group:"Account",Icon:ShieldCheck},
 {name:"Invoices & Earnings",description:"Local invoice and payment records",group:"Operations",Icon:Wallet},
 {name:"Event Log",description:"Record events against bookings",group:"Operations",Icon:ClipboardList},
 {name:"Return Journeys",description:"Explore return freight opportunities",group:"Network",Icon:Navigation,network:"Return Journeys"},
 {name:"Availability",description:"Search available drivers and vehicles",group:"Network",Icon:CalendarDays,network:"Live Availability"},
 {name:"Who's Nearby",description:"Nearby carrier availability, subject to GPS",group:"Network",Icon:MapPin,network:"Live Availability"},
 {name:"Directory",description:"Look up XDrive members",group:"Network",Icon:BookOpen,network:"Directory"},
 {name:"Messages",description:"View DEMO conversations",group:"Network",Icon:MessageSquare,network:"Messages"},
 {name:"Help & Support",description:"Create a local DEMO support note",group:"Account",Icon:HelpCircle}
];
export default function DemoOwnerDriverMore({onNetwork,onLoads,onQuotes,onBookings,onPostLoad}:{onNetwork:(section:string)=>void;onLoads:()=>void;onQuotes:()=>void;onBookings:()=>void;onPostLoad:()=>void}){
 const [active,setActive]=useState("Driver Profile"),[search,setSearch]=useState("");
 const filtered=useMemo(()=>options.filter(x=>(x.name+" "+x.description).toLowerCase().includes(search.toLowerCase())),[search]);
 const current=options.find(x=>x.name===active)||options[0];
 const change=(item:Item)=>{if(item.network){onNetwork(item.network);return}setActive(item.name)};
 return <section className="xd-owner-more">
  <div className="xd-owner-more-heading"><div><h1>More</h1><p>Owner Driver profile, documents, vehicle tools and operational services</p></div><span>OWNER DRIVER WORKSPACE</span></div>
  <div className="xd-owner-more-kpis">
   {[
    {title:"Driver Account",note:"Profile and identity",Icon:UserRound,target:"Driver Profile",tone:"orange"},
    {title:"My Vehicles",note:"Vehicle information",Icon:Truck,target:"My Vehicles",tone:"blue"},
    {title:"Compliance",note:"Documentation",Icon:ShieldCheck,target:"Documents & Compliance",tone:"green"},
    {title:"Invoices & Earnings",note:"DEMO finance records",Icon:Wallet,target:"Invoices & Earnings",tone:"amber"},
    {title:"Driver Events",note:"Operational notes",Icon:ClipboardList,target:"Event Log",tone:"sky"}
   ].map(k=><button key={k.title} className={"xd-owner-more-kpi "+k.tone} onClick={()=>setActive(k.target)}>
    <k.Icon size={24}/><span><strong>{k.title}</strong><small>{k.note}</small></span>
   </button>)}
  </div>
  <div className="xd-owner-more-layout">
   <aside className="xd-owner-more-menu"><h2>Tools & Services</h2>
    <label className="xd-owner-more-search"><Search size={16}/><input aria-label="Search owner driver tools" placeholder="Search tools..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
    {(["Account","Operations","Network"] as const).map(section=><div key={section} className="xd-owner-more-group"><h3>{section}</h3>{filtered.filter(x=>x.group===section).map(item=><button key={item.name} className={active===item.name?"active":""} onClick={()=>change(item)} aria-current={active===item.name?"page":undefined}><item.Icon size={16}/><span>{item.name}</span><b>›</b></button>)}</div>)}
    {!filtered.length&&<p>No matching tools.</p>}
   </aside>
   <div className="xd-owner-more-body">
    <div className="xd-owner-more-panel">
     <header><current.Icon size={21}/><div><h2>{current.name}</h2><p>{current.description}</p></div></header>
     <p className="xd-owner-more-disclaimer"><BadgeCheck size={16}/> This section stores demonstration records locally only. It does not submit real documents, send emails or update the live XDrive platform.</p>
     {current.name==="Documents & Compliance"?<DemoCompliance drivers={["Demo Driver"]} vehicles={[{id:"demo-van",reg:"DX26 DEM"}]} scope="Owner Driver"/>:<DemoOperationalTools key={current.name} role="Owner Driver" tool={current.name}/>}
    </div>
    <div className="xd-owner-more-quick"><h2>Quick Actions</h2><div>
     <button onClick={onLoads}><Search size={17}/> Find Loads</button>
     <button onClick={onQuotes}><FileText size={17}/> My Quotes</button>
     <button onClick={onBookings}><ClipboardList size={17}/> Bookings</button>
     <button onClick={onPostLoad}><Truck size={17}/> Post Load</button>
    </div></div>
   </div>
  </div>
 </section>;
}
