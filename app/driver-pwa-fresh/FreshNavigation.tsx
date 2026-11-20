'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '../components/AuthContext';
import {usePathname,useRouter} from 'next/navigation';

export function FreshHeader({onSearch,title,onBack}:{onSearch?:()=>void;title?:string;onBack?:()=>void;inlineTitle?:boolean}){
 const {logout}=useAuth();
 const showSearch=Boolean(onSearch);
 const search=()=>onSearch?.();
 return <><header className="fresh-header" style={title?{background:'#F5A300',color:'#0B2F6B'}:undefined}><div className="fresh-brand"><span className="fresh-brand-mark">XDRIVE</span><span className="fresh-brand-sub">LOGISTICS</span></div>{onBack&&<button type="button" className="fresh-header-back" aria-label="Back to Bookings" onClick={onBack}>‹</button>}{title?<strong className="fresh-inline-title" title={title}>{title}</strong>:null}
 <button type="button" onClick={()=>void logout().then(()=>location.assign("/login"))}>Logout</button>
 {showSearch&&<button type="button" className="fresh-header-icon" aria-label="Search and filter jobs" onClick={search}><svg width="29" height="29" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.6" fill="none"/><path d="m15.5 15.5 6 6" stroke="currentColor" strokeWidth="2.6"/></svg></button>}</header>
 </>;
}
export function FreshBottom({active,demo=false}:{active:'jobs'|'quotes'|'bookings';demo?:boolean}){
 const router=useRouter();
 const pathname=usePathname();
 const [selected,setSelected]=useState(active);
 const base=demo?'/driver-pwa-fresh/visual-preview/workflow?tab=':'/driver-pwa-fresh/';
 useEffect(()=>setSelected(active),[active,pathname]);
 useEffect(()=>{
  if(demo)return;
  for(const target of ['jobs','quotes','bookings'] as const)router.prefetch('/driver-pwa-fresh/'+target);
 },[demo,router]);
 const tabs=(['jobs','quotes','bookings'] as const);
 return <nav className="fresh-bottom" aria-label="Driver tabs">{tabs.map(tab=><Link key={tab} prefetch href={base+tab} aria-current={selected===tab?'page':undefined} className={selected===tab?'selected':''} onPointerDown={()=>setSelected(tab)} onClick={()=>setSelected(tab)}>{tab==='jobs'?'Loads':tab==='quotes'?'My Quotes':'Bookings'}</Link>)}</nav>;
}