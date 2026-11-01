"use client";
import {Bell,CalendarClock,ClipboardCheck,FileText,MapPin,MessageCircle,Network,Route,Search,Truck,Users,Wallet} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {useDemoBookings,useExchangeLoads} from "./demoExchange";
import {useDemoQuotes} from "./DemoQuotes";
import "./owner-driver-network.css";
type Quick={name:string;description:string;Icon:LucideIcon};
const links:Quick[]=[
 {name:"Directory",description:"Members and company profiles",Icon:Users},
 {name:"Live Availability",description:"Vehicle and driver availability",Icon:MapPin},
 {name:"Return Journeys",description:"Return freight opportunities",Icon:Route},
 {name:"Messages",description:"Local DEMO conversations",Icon:MessageCircle},
 {name:"Notifications",description:"Load, quote and booking alerts",Icon:Bell},
 {name:"Finance",description:"Invoices and payment records",Icon:Wallet},
 {name:"Reports",description:"Operational summaries",Icon:FileText}
];
export default function DemoOwnerDriverNetworkOverview({onSelect,onOpenLoads,onOpenQuotes,onOpenBookings}:{onSelect:(page:string)=>void;onOpenLoads:()=>void;onOpenQuotes:()=>void;onOpenBookings:()=>void}){
 const {loads:exchange,error}=useExchangeLoads(),quotes=useDemoQuotes(),{loads:bookings,error:bookingsError}=useDemoBookings();
 const open=exchange.filter(l=>l.status==="Open").length,active=bookings.filter(l=>!l.podReceived).length,complete=bookings.filter(l=>l.podReceived).length;
 return <section className="xd-owner-network">
  <header><h2>Owner Driver Network Overview</h2><p>Directory, transport availability, communication and operational reporting</p></header>
  <div className="xd-owner-network-metrics">
   {[
    {title:"Available Loads",value:open,description:"Verified shared exchange",tone:"orange",Icon:Truck,onClick:onOpenLoads},
    {title:"My Quotes",value:quotes.length,description:"Your submitted quotations",tone:"blue",Icon:FileText,onClick:onOpenQuotes},
    {title:"Active Bookings",value:active,description:"Awaiting completion",tone:"green",Icon:ClipboardCheck,onClick:onOpenBookings},
    {title:"POD Received",value:complete,description:"Completion evidence",tone:"amber",Icon:CalendarClock,onClick:onOpenBookings}
   ].map(k=><button type="button" className={"xd-owner-network-kpi "+k.tone} key={k.title} onClick={k.onClick}><k.Icon size={24}/><span><strong>{k.title}</strong><b>{k.value}</b><small>{k.description}</small></span></button>)}
  </div>
  {(error||bookingsError)&&<p className="xd-owner-network-auth" role="status">A connected DEMO session is required for live loads and bookings. The directory and illustrative tools can still be explored; nothing here represents a live GPS position.</p>}
  <div className="xd-owner-network-columns">
   <article className="xd-owner-network-panel"><div className="xd-owner-network-panel-head"><h3><Network size={18}/> Network & Tools</h3></div>
    <div className="xd-owner-network-shortcuts">{links.map(x=><button key={x.name} onClick={()=>onSelect(x.name)}><x.Icon size={18}/><span><strong>{x.name}</strong><small>{x.description}</small></span><b>›</b></button>)}</div>
   </article>
   <article className="xd-owner-network-panel"><div className="xd-owner-network-panel-head"><h3><CalendarClock size={18}/> Current Transport</h3><button onClick={onOpenLoads}>Find Loads →</button></div>
    {bookings.length?bookings.slice(0,4).map(x=><div key={x.id} className="xd-owner-network-booking"><b>{x.from} → {x.to}</b><small>{x.id} · {x.assignedDriver||"Driver pending"} · {x.podReceived?"POD completed":"In progress"}</small></div>):<div className="xd-owner-network-empty"><Truck size={27}/><strong>No awarded bookings in this session</strong><p>Confirmed transport appears after a quotation is accepted and the job is assigned.</p><button onClick={onOpenLoads}><Search size={16}/> Browse Loads</button></div>}
    <div className="xd-owner-network-notes"><h4>Location & availability</h4><p>GPS positions, driving distance and ETA are not connected to this DEMO. Any sample availability map is clearly labelled as illustrative.</p></div>
   </article>
  </div>
 </section>;
}
