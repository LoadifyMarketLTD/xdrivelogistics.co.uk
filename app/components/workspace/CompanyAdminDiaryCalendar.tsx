'use client';
import {useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {ActionButton,StatusBadge} from './WorkspaceUI';
import {calendarDays,calendarEvents,londonDay,shiftCalendarMonth,type CalendarBooking} from './companyAdminDiaryCalendarModel';
const label=(day:string)=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
const time=(v:string)=>new Date(v).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
export default function CompanyAdminDiaryCalendar({jobs,onOpen,initialDay}:{jobs:CalendarBooking[];onOpen:(id:string)=>void;initialDay?:string}){
  const today=londonDay(new Date());
  const [day,setDay]=useState(initialDay||today);
  const [month,setMonth]=useState((initialDay||today).slice(0,7));
  const {days,unscheduled}=useMemo(()=>calendarEvents(jobs),[jobs]);
  const cells=calendarDays(month),events=days.get(day)||[];
  const move=(delta:number)=>{const next=shiftCalendarMonth(month,delta);setMonth(next);setDay(next+'-01')};
  const reset=()=>{setDay(today);setMonth(today.slice(0,7))};
  return <section className="company-admin-calendar" aria-label="Booking calendar">
    <header className="company-admin-calendar__header"><div><CalendarDays size={20} aria-hidden="true"/><strong>{new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',month:'long',year:'numeric'})}</strong></div><div><button type="button" aria-label="Previous month" onClick={()=>move(-1)}><ChevronLeft size={19}/></button><ActionButton tone="secondary" onClick={reset}>Today</ActionButton><button type="button" aria-label="Next month" onClick={()=>move(1)}><ChevronRight size={19}/></button></div></header>
    <p>Collections and deliveries within the current Diary filters. UK local time. One booking can have two scheduled events.</p>
    <div className="company-admin-calendar__grid" role="group" aria-label="Calendar dates">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d} className="company-admin-calendar__weekday">{d}</span>)}{cells.map(key=>{const list=days.get(key)||[];return <button type="button" key={key} data-outside={String(!key.startsWith(month))} aria-pressed={key===day} aria-current={key===today?'date':undefined} aria-label={label(key)+', '+list.length+' scheduled events'} onClick={()=>{setDay(key);setMonth(key.slice(0,7))}}><strong>{Number(key.slice(-2))}</strong>{list.length>0&&<small>{list.length} {list.length===1?'event':'events'}</small>}</button>})}</div>
    <h3>{label(day)}</h3>
    {!events.length?<p role="status">No scheduled events for this date in the current view.</p>:<div className="company-admin-calendar__events">{events.map(({job,kind,at})=><article key={job.id+kind}><span className="company-admin-calendar__time">{time(at)}<small>{kind}</small></span><div><strong>{job.booking_reference||job.customer_reference||job.id}</strong><p>{kind==='Collection'?job.pickup_location||'Collection location not supplied':job.delivery_location||'Delivery location not supplied'}</p></div><StatusBadge value={job.status}/><ActionButton tone="secondary" onClick={()=>onOpen(job.id)}>View booking</ActionButton></article>)}</div>}
    {!!unscheduled.length&&<details><summary>Bookings without a valid collection or delivery date ({unscheduled.length})</summary>{unscheduled.map(j=><div className="company-admin-calendar__undated" key={j.id}><span>{j.booking_reference||j.customer_reference||j.id}</span><ActionButton tone="secondary" onClick={()=>onOpen(j.id)}>View booking</ActionButton></div>)}</details>}
  </section>
}
