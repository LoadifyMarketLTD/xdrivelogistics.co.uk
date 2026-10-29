'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';

const menuGroups=[
 {label:'My Profile',href:'/driver/profile'},
 {label:'Vehicles & Documents',href:'/driver/vehicles'},
 {label:'Return Journeys',href:'/driver/returns'},
 {label:'Availability & Nearby',href:'/driver/availability'},
 {label:'Directory & Messages',href:'/driver/directory'},
 {label:'Invoices & Earnings',href:'/driver/finance'},
 {label:'Event Log',href:'/driver/event-log'},
 {label:'Settings & Support',href:'/driver/settings'},
];
export function FreshHeader({onSearch}:{onSearch?:()=>void}){
 const [open,setOpen]=useState(false);
 const router=useRouter();
 useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open]);
 const search=()=>{if(onSearch){onSearch();return;}router.push('/driver-pwa-fresh/jobs?view=filter')};
 return <><header className="fresh-header"><div className="fresh-brand"><span className="fresh-brand-mark">XDRIVE</span><span className="fresh-brand-sub">LOGISTICS</span></div>
 <button type="button" className="fresh-header-icon" aria-label="Open driver menu" aria-expanded={open} aria-controls="fresh-driver-menu" onClick={()=>setOpen(value=>!value)}><svg width="29" height="29" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></button>
 <button type="button" className="fresh-header-icon" aria-label="Search and filter jobs" onClick={search}><svg width="29" height="29" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.6" fill="none"/><path d="m15.5 15.5 6 6" stroke="currentColor" strokeWidth="2.6"/></svg></button></header>
 {open?<div className="fresh-menu-backdrop" onClick={()=>setOpen(false)}><nav id="fresh-driver-menu" className="fresh-menu" aria-label="Driver menu" onClick={event=>event.stopPropagation()}><div className="fresh-menu-heading">Driver menu <button type="button" onClick={()=>setOpen(false)} aria-label="Close menu">×</button></div>{menuGroups.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)}>{item.label}</Link>)}</nav></div>:null}</>;
}
export function FreshBottom({active,demo=false}:{active:'jobs'|'quotes'|'bookings';demo?:boolean}){
 const router=useRouter();
 const pathname=usePathname();
 // Show the active route, not the tab pressed before navigation finishes.
 const selected=demo?active:pathname.startsWith('/driver-pwa-fresh/quotes')?'quotes':pathname.startsWith('/driver-pwa-fresh/bookings')||pathname.startsWith('/driver-pwa-fresh/booking-offers')?'bookings':'jobs';
 const base=demo?'/driver-pwa-fresh/visual-preview/workflow?tab=':'/driver-pwa-fresh/';
 useEffect(()=>{
  if(demo)return;
  for(const target of ['jobs','quotes','bookings'] as const)router.prefetch('/driver-pwa-fresh/'+target);
 },[demo,router]);
 const tabs=(['jobs','quotes','bookings'] as const);
 return <nav className="fresh-bottom" aria-label="Driver tabs">{tabs.map(tab=><Link key={tab} prefetch href={base+tab} aria-current={selected===tab?'page':undefined} className={selected===tab?'selected':''}>{tab==='jobs'?'Loads':tab==='quotes'?'My Quotes':'Bookings'}</Link>)}</nav>;
}