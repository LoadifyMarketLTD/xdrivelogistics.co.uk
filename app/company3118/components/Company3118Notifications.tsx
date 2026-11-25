"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  filterCompanyNotifications, notificationCategory, notificationCategoryLabel, notificationModule,
  type CompanyNotification, type CompanyNotificationFilter, type NotificationCategory,
} from "../../components/workspace/companyAdminNotificationsModel";
import { londonDay } from "../../components/workspace/companyAdminDiaryCalendarModel";
import "./demo-notifications.css";

type N = { type: "Jobs" | "Quotes" | "Bookings" | "Invoices" | "System" };
const labels: Record<NotificationCategory, N["type"]> = {
  jobs: "Jobs", quotes: "Quotes", bookings: "Bookings", invoices: "Invoices", system: "System", load_alerts: "Jobs",
};
const categories: Record<string, CompanyNotificationFilter["tab"]> = {
  All: "all", Jobs: "jobs", Quotes: "quotes", Bookings: "bookings", Invoices: "invoices",
  System: "system", Unread: "unread", "Load Alerts": "load_alerts", Operational: "operational",
};
const extraTabs = ["Unread", "Load Alerts", "Operational"];
const timestamp = new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"});

type Props = {
  rows: CompanyNotification[];
  selected: CompanyNotification | null;
  loading: boolean;
  busy: boolean;
  error: string;
  preferences: ReactNode;
  removalDialog: ReactNode;
  onPreferences: () => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRefresh: () => void;
  onNavigate: (href: string) => void;
};
const colors:Record<N["type"],string>={Jobs:"#ff7900",Quotes:"#1165e5",Bookings:"#12aa39",Invoices:"#176de5",System:"#e62929"};
const icons:Record<N["type"],string>={Jobs:"🚚",Quotes:"◇",Bookings:"▣",Invoices:"▤",System:"⚠"};

export default function Company3118Notifications({
  rows, selected, loading, busy, error, preferences, removalDialog, onPreferences,
  onOpen, onClose, onRemove, onMarkRead, onMarkAllRead, onRefresh, onNavigate,
}: Props) {
  const [tab,setTab] = useState("All");
  const [query,setQuery] = useState("");
  const [kind,setKind] = useState("All Types");
  const [readFilter,setReadFilter] = useState("All (Unread & Read)");
  const [range,setRange] = useState("All Time");
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  const [sort,setSort] = useState("Newest First");
  const [filters,setFilters] = useState<Omit<CompanyNotificationFilter,"tab">>({query:"",from:"",to:"",status:"all"});
  const [appliedKind,setAppliedKind] = useState("All Types");

  const invalidRange = range === "Custom" && Boolean(from && to && from > to);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidRange) return;
    const past = new Date();
    const days = range === "Last 7 Days" ? 6 : 29;
    past.setUTCDate(past.getUTCDate() - days);
    const start = range === "Custom" ? from : range === "All Time" ? "" : londonDay(past);
    setFilters({query,from:start,to:range === "Custom" ? to : "",status:readFilter === "Unread Only" ? "unread" : readFilter === "Read Only" ? "read" : "all"});
    setAppliedKind(kind);
  }
  function clearFilters() {
    setQuery("");
    setKind("All Types");
    setReadFilter("All (Unread & Read)");
    setRange("All Time");
    setFrom("");
    setTo("");
    setTab("All");
    setAppliedKind("All Types");
    setFilters({query:"",from:"",to:"",status:"all"});
  }
  const total = rows.length;
  const unread = rows.filter(row=>!row.read_at).length;
  const counts = (name: string) => filterCompanyNotifications(rows,{query:"",from:"",to:"",status:"all",tab:categories[name]}).length;
  const toEvent = (row: CompanyNotification) => {
    const category = notificationCategory(row.type);
    const date = new Date(row.created_at);
    return {
      id:row.id,type:labels[category],category:notificationCategoryLabel[category],title:row.title,
      description:row.body?.trim() || "No additional details supplied.",
      time:Number.isNaN(date.getTime()) ? "Date unavailable" : timestamp.format(date),
      read:Boolean(row.read_at),destination:notificationModule(row.type),
    };
  };
  const matched = filterCompanyNotifications(rows,{...filters,tab:categories[tab]})
    .filter(row=>appliedKind === "All Types" || notificationCategory(row.type) === categories[appliedKind]);
  const filtered = (sort === "Oldest First" ? matched.reverse() : matched).map(toEvent);
  const active = selected ? toEvent(selected) : null;
return <section className="xd-notify">
 <header><h1>Notifications</h1><p>Stay updated with your jobs, quotes, bookings, invoices and system alerts</p></header>
 {error && <p role="alert" className="xd-notify-preview">{error}</p>}
 {total >= 150 && <p className="xd-notify-preview">Showing the latest 150 notifications. Mark all as read applies to the entire inbox.</p>}
 {preferences}
 {removalDialog}
 <div className="xd-notify-stats">{[{t:"All",label:"All Notifications",icon:"♧",color:"#ff7900"},{t:"Jobs",label:"Job Updates",icon:"🚚",color:"#176de5"},{t:"Quotes",label:"Quotes",icon:"◇",color:"#0ca632"},{t:"Bookings",label:"Bookings",icon:"▣",color:"#ff7900"},{t:"Invoices",label:"Invoices",icon:"▤",color:"#176de5"},{t:"System",label:"System Alerts",icon:"⚠",color:"#e62929"}].map(x=><button key={x.t} aria-pressed={tab===x.t} className="xd-notify-stat" style={{borderLeftColor:x.color}} onClick={()=>setTab(x.t)}><span style={{color:x.color}}>{x.icon}</span><div><b>{x.label}</b><strong>{counts(x.t)}</strong></div></button>)}</div>
 <div className="xd-notify-tabs">{["All","Jobs","Quotes","Bookings","Invoices","System"].map(t=><button key={t} className={tab===t?"active":""} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t} ({counts(t)})</button>)}{extraTabs.map(t=><button key={t} className={tab===t?"active":""} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t} ({counts(t)})</button>)}<button className="xd-notify-mark" disabled={loading || busy || unread === 0} onClick={onMarkAllRead}>✓ Mark all as read</button></div>
 <div className="xd-notify-layout"><form className="xd-notify-filter" onSubmit={apply}><h3>Filter Notifications</h3><input aria-label="Search notifications" placeholder="⌕  Search notifications..." value={query} onChange={e=>setQuery(e.target.value)}/><label>Type<select value={kind} onChange={e=>setKind(e.target.value)}>{["All Types","Jobs","Quotes","Bookings","Invoices","System","Load Alerts"].map(x=><option key={x}>{x}</option>)}</select></label><label>Status<select value={readFilter} onChange={e=>setReadFilter(e.target.value)}>{["All (Unread & Read)","Unread Only","Read Only"].map(x=><option key={x}>{x}</option>)}</select></label><label>Date Range<select value={range} onChange={e=>setRange(e.target.value)}>{["Last 30 Days","Last 7 Days","All Time","Custom"].map(x=><option key={x}>{x}</option>)}</select></label>{range === "Custom" && <><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}{invalidRange && <p role="alert">From date must not be after To date.</p>}<button type="submit" className="xd-notify-apply">⌕ Apply Filters</button><button className="xd-notify-clear" type="button" onClick={clearFilters}>↻ Clear Filters</button><button type="button" className="xd-notify-clear" disabled={loading || busy} onClick={onRefresh}>Refresh</button><button type="button" className="xd-notify-clear" aria-expanded={Boolean(preferences)} onClick={onPreferences}>Preferences</button></form>
 <section className="xd-notify-feed"><div className="xd-notify-feedhead"><b>{filtered.length} notifications found</b><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Newest First</option><option>Oldest First</option></select></label></div>{filtered.map(n=><button key={n.id} className={"xd-notify-event "+(active?.id===n.id?"selected":"")} style={{borderLeftColor:colors[n.type]}} aria-pressed={active?.id===n.id} disabled={busy || loading} onClick={()=>onOpen(n.id)}><span className="xd-notify-eventicon" style={{color:colors[n.type]}}>{icons[n.type]}</span><span className="xd-notify-eventcopy"><strong>{n.title}</strong><small>{n.description}</small></span><span className="xd-notify-eventright"><small>{n.time}</small>{!n.read&&<i/>}</span><b className="xd-notify-chevron">›</b></button>)}{loading ? <p className="xd-notify-empty" role="status">Loading notifications…</p> : filtered.length===0 && !error && <p className="xd-notify-empty">No notifications match these filters.</p>}</section>
 <section className="xd-notify-detail">{active?<><div className="xd-notify-detailhead"><span>{icons[active.type]}</span><div><h2>{active.title}</h2><small>{active.category} · {active.time}</small></div><button type="button" onClick={onClose} aria-label="Close detail">×</button></div><div className="xd-notify-detailbody"><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{active.description}</p><p>{active.read?"Read":"Unread"}</p></div><div className="xd-notify-detailactions">{active.destination && <button type="button" onClick={()=>onNavigate(active.destination!.href)}>{active.destination.label}</button>}{!active.read && <button type="button" disabled={busy || loading} onClick={()=>onMarkRead(active.id)}>Mark read</button>}<button type="button" disabled={busy || loading} onClick={()=>onRemove(active.id)}>Remove</button></div></>:<p className="xd-notify-empty">Select a notification to view its details.</p>}</section></div>
 </section>
}
