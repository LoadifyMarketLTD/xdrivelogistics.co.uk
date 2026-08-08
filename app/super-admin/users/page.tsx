'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X = { navy:'#0B2F6B', blue:'#1D57D8', orange:'#F5A300', white:'#FFFFFF', charcoal:'#1A1F2B', light:'#F4F6F8', border:'#D9E1EA', muted:'#64748B' } as const;
type Stats = { driversTotal?: number; companiesTotal?: number };
const USER_SECTIONS = [
  { icon:'🚗', label:'Drivers', description:'Platform driver accounts, availability and location.', href:'/super-admin/users/drivers' },
  { icon:'🛡️', label:'Platform Admins', description:'Platform-level administrator registry and governance controls.', href:'/super-admin/users/platform-admins' },
  { icon:'🧑‍💼', label:'Company Owners', description:'Company owner account registry and authority controls.', href:'/super-admin/users/company-owners' },
  { icon:'🧭', label:'Dispatchers', description:'Dispatcher accounts across all companies.', href:'/super-admin/users/dispatchers' },
  { icon:'🛒', label:'Customers', description:'Customer accounts and usage footprint across the marketplace.', href:'/super-admin/users/customers' },
];

function AllUsersContent(){
 const router=useRouter(); const [stats,setStats]=useState<Stats|null>(null); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{const auth=await getAuthHeader();if(!auth)return;const res=await fetch('/api/super-admin/stats',{headers:{Authorization:auth}});if(res.ok)setStats(await res.json() as Stats);}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <div style={{minHeight:'100vh',background:X.light,color:X.charcoal,padding:'12px'}}>
  <header style={{minHeight:'52px',display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
   <span aria-hidden='true' style={{width:'28px',height:'28px',display:'grid',placeItems:'center',borderRadius:'4px',background:X.navy,color:X.white,fontSize:'12px'}}>👥</span>
   <div><div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}><h1 style={{margin:0,color:X.navy,fontSize:'20px',lineHeight:1.2,fontWeight:800}}>All Users</h1><span style={{padding:'3px 6px',borderRadius:'4px',background:'#EEF4FF',color:X.blue,fontSize:'10px',fontWeight:800,letterSpacing:'.05em',textTransform:'uppercase'}}>Platform</span></div><p style={{margin:'4px 0 0',color:X.muted,fontSize:'12px'}}>User administration across platform roles — {loading?'…':`${stats?.driversTotal??0} drivers registered`}.</p></div>
  </header>
  <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'12px'}}>{USER_SECTIONS.map(section=><button key={section.href} onClick={()=>router.push(section.href)} style={{minHeight:'104px',textAlign:'left',cursor:'pointer',background:X.white,border:`1px solid ${X.border}`,borderRadius:'4px',padding:'12px',color:X.charcoal}}><div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}><span style={{width:'28px',height:'28px',display:'grid',placeItems:'center',borderRadius:'4px',background:X.light}}>{section.icon}</span><strong style={{fontSize:'12px',color:X.navy}}>{section.label}</strong></div><div style={{color:X.muted,fontSize:'11px',lineHeight:1.45,minHeight:'32px'}}>{section.description}</div><div style={{marginTop:'8px',fontSize:'11px',fontWeight:800,color:X.blue}}>Open {section.label} →</div></button>)}</section>
 </div>;
}
export default function Page(){return <ProtectedRoute allowedRoles={['owner']}><AllUsersContent/></ProtectedRoute>;}
