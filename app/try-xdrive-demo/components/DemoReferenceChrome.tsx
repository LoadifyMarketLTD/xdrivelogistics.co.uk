"use client";

import {useState} from "react";
import Link from "next/link";
import {
  Bell, ChevronDown, ChevronsLeft, ChevronsRight, Truck, Plus, LayoutDashboard,
  PackagePlus, Tags, ClipboardCheck, Users, CalendarDays, FileText,
  Network, ContactRound, MapPin, Route, TrendingUp, MessageCircle, BarChart3,
  Menu, UserRound, ClipboardList, ShieldCheck, Grid3X3, CircleHelp,
  Search, BriefcaseBusiness, BadgeCheck, Warehouse, MapPinned, PackageCheck
} from "lucide-react";
import type {LucideIcon} from "lucide-react";

/** Visual shell approved by the 1 November sidebar reference images.
 *  Do not display this component inside the frozen Post Load page.
 */
const ICONS:Record<string,LucideIcon>={
  "Dashboard":LayoutDashboard, "Post Load":PackagePlus, "Loads":Truck,
  "My Loads":Truck, "Quotes":Tags, "My Quotes":Tags, "Carrier Quotes":Tags,
  "Bookings":ClipboardCheck, "Awards":BadgeCheck, "Allocations":ClipboardCheck,
  "My Fleet":Truck, "Drivers":Users, "Drivers & Vehicles":Users,
  "Diary":CalendarDays, "Invoices":FileText, "Network & Tools":Network,
  "Directory":ContactRound, "Live Availability":MapPinned,
  "Return Journeys":Route, "Freight Vision":TrendingUp,
  "Messages":MessageCircle, "Notifications":Bell, "Reports":BarChart3,
  "More":Menu, "Dispatch Board":ClipboardList, "Live Jobs":Truck,
  "Tracking":MapPin, "Documents":FileText, "POD Review":PackageCheck,
  "Find Loads":Search, "Operations":BriefcaseBusiness, "Compliance":ShieldCheck,
  "Overview":Grid3X3, "Help & Support":CircleHelp, "Vehicles":Warehouse,
  "Shipper":UserRound,
};

export function DemoReferenceNavIcon({label}:{label:string}){
  const Icon=ICONS[label]||Grid3X3;
  return <Icon className="xd-ref-nav-icon" size={19} strokeWidth={2.3} aria-hidden="true"/>;
}

export function DemoReferenceCollapse({collapsed,onToggle}:{collapsed:boolean;onToggle:()=>void}){
  return <div className="xd-ref-sidebar-footer">
    <button type="button" className="xd-ref-collapse" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"} onClick={onToggle}>
      {collapsed?<ChevronsRight size={21}/>:<ChevronsLeft size={21}/>}
    </button>
  </div>;
}

export function DemoReferenceTopbar({
  label,postLoadIndex,notificationsIndex,onNavigate,notificationCount,
}:{
  label:string;
  postLoadIndex?:number;
  notificationsIndex?:number;
  notificationCount?:number;
  onNavigate:(index:number)=>void;
}){
  const [accountOpen,setAccountOpen]=useState(false);
  const [alertOpen,setAlertOpen]=useState(false);
  return <div className="xd-ref-header">
    <div className="xd-ref-header-title">
      <Truck size={24} strokeWidth={2.2} className="xd-ref-header-truck" aria-hidden="true"/>
      <strong>{label}</strong>
    </div>
    <div className="xd-ref-header-actions">
      {postLoadIndex!==undefined&&<button type="button" className="xd-ref-post-load" aria-label="Post Load" title="Post Load" onClick={()=>onNavigate(postLoadIndex)}>
        <Plus size={20} aria-hidden="true"/> <span>Post Load</span>
      </button>}
      <div className="xd-ref-header-action-wrap">
        <button type="button" className="xd-ref-alert-button" aria-label="Notifications" aria-expanded={notificationsIndex===undefined?alertOpen:undefined} onClick={()=>{if(notificationsIndex!==undefined){onNavigate(notificationsIndex)}else{setAlertOpen(v=>!v);setAccountOpen(false)}}}>
          <Bell size={23} aria-hidden="true"/>
          {typeof notificationCount==="number"&&notificationCount>0&&<span className="xd-ref-alert-count">{notificationCount}</span>}
        </button>
        {alertOpen&&notificationsIndex===undefined&&<div className="xd-ref-header-popup" role="status">No notifications displayed in this demo workspace.</div>}
      </div>
      <div className="xd-ref-divider" aria-hidden="true"/>
      <div className="xd-ref-account-wrap">
        <button type="button" className="xd-ref-account" aria-label="Workspace account menu" aria-expanded={accountOpen} onClick={()=>{setAccountOpen(v=>!v);setAlertOpen(false)}}>
          <span className="xd-ref-avatar">XD</span>
          <span className="xd-ref-account-name">XDrive Logistics</span>
          <ChevronDown size={16} aria-hidden="true"/>
        </button>
        {accountOpen&&<div className="xd-ref-header-popup xd-ref-account-menu">
          <strong>{label}</strong>
          <button type="button" onClick={()=>{onNavigate(0);setAccountOpen(false)}}>Dashboard</button>
          <Link href="/try-xdrive" onClick={()=>setAccountOpen(false)}>All workspaces</Link>
        </div>}
      </div>
    </div>
  </div>;
}
