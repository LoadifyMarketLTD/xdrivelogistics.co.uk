"use client";
import {useState,type ReactNode} from "react";
import {LayoutDashboard,PackagePlus,Truck,Tags,ClipboardCheck,CalendarDays,Menu,Network,MapPinned,FileText,Users,MessageSquare,Bell,BarChart3,Route,ClipboardList,CheckCircle2,ShieldCheck,ChevronsLeft,ChevronsRight,PackageSearch,BriefcaseBusiness} from "lucide-react";
import "./approved-sidebar-3119.css";
import MasterBrandImage from "../../components/workspace/MasterBrandImage";

const icons:Record<string,typeof LayoutDashboard>={
"Dashboard":LayoutDashboard,"Post Load":PackagePlus,"Loads":Truck,"My Loads":Truck,"Live Jobs":Truck,
"Quotes":Tags,"Carrier Quotes":Tags,"My Quotes":Tags,"Awards":CheckCircle2,
"Bookings":ClipboardCheck,"Diary":CalendarDays,"More":Menu,"Network & Tools":Network,
"Live Availability":MapPinned,"My Fleet":Truck,"Drivers":Users,"Invoices":FileText,
"Directory":Users,"Return Journeys":Route,"Freight Vision":MapPinned,
"Messages":MessageSquare,"Notifications":Bell,"Reports":BarChart3,
"Alerts":Bell,"Tracking":MapPinned,"Documents":FileText,"POD Review":ClipboardList,
"Dispatch Board":BriefcaseBusiness,"Allocations":ClipboardCheck,
"Find Loads":PackageSearch
};
export default function ApprovedSidebar({items,activeIndex,onSelect,extra,footerAction,disabledIndices=[],mobileOpen=false,onMobileClose}:{items:string[];activeIndex:number;onSelect:(i:number)=>void;extra?:{label:string;onClick:()=>void};footerAction?:ReactNode;disabledIndices?:readonly number[];mobileOpen?:boolean;onMobileClose?:()=>void}){
const [collapsed,setCollapsed]=useState(false);
return <aside id="xdrive-master-mobile-navigation" aria-label="Master workspace sections" className={"sidebar xd-approved-sidebar"+(collapsed?" is-collapsed":"")+(mobileOpen?" is-mobile-open":"")}>
<div className="brand"><MasterBrandImage priority /></div>
{items.map((label,i)=>{const Icon=icons[label]||ShieldCheck;return <button type="button" key={label} className={activeIndex===i?"active":""} title={disabledIndices.includes(i)?`${label} — unavailable for this role`:label} aria-label={label} disabled={disabledIndices.includes(i)} onClick={()=>{onSelect(i);onMobileClose?.();}}><Icon size={19} strokeWidth={2.3} aria-hidden="true"/><span>{label}</span></button>})}
{extra&&<button type="button" title={extra.label} onClick={extra.onClick}><PackageSearch size={19} strokeWidth={2.3} aria-hidden="true"/><span>{extra.label}</span></button>}
<div className="xd-approved-footer">{footerAction}<button className="xd-mobile-sidebar-close" type="button" aria-label="Close workspace menu" onClick={onMobileClose}>Close</button><button type="button" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<ChevronsRight size={21}/>:<ChevronsLeft size={21}/>}</button></div>
</aside>;
}

