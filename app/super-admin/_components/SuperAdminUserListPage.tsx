'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X={navy:'#0B2F6B',blue:'#1D57D8',orange:'#F5A300',white:'#FFFFFF',charcoal:'#1A1F2B',light:'#F4F6F8',border:'#D9E1EA',muted:'#64748B',green:'#16A34A',red:'#DC2626'} as const;
const PAGE_SIZE=50;
const REQUEST_TIMEOUT_MS=15_000;

type UserRow={id:string;user_id:string;name:string;email:string;status?:string;role:string;company?:string;company_id?:string|null;availability_status?:string;app_access?:boolean;phone?:string;created_at:string;};
type Pagination={page:number;limit:number;total:number;totalPages:number;hasNextPage:boolean;hasPrevPage:boolean;};
type ApiResponse={rows:UserRow[];total:number;pagination?:Pagination;};
type SuperAdminUserListPageProps={icon:string;title:string;description:string;section:string;roleFilter:string;columns:Array<{label:string;render:(row:UserRow)=>ReactNode;}>;};

const fmt=(iso:string|null|undefined)=>iso?new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const statusDot=(status:string|undefined)=>{const s=(status??'').toLowerCase();const color=s==='active'||s==='available'?X.green:s==='suspended'||s==='inactive'||s==='busy'?X.red:X.muted;return <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color,fontWeight:700}}><span style={{width:7,height:7,borderRadius:'50%',backgroundColor:color,display:'inline-block'}}/>{s||'—'}</span>;};

export default function SuperAdminUserListPage({icon,title,description,section,roleFilter,columns}:SuperAdminUserListPageProps){
 const[rows,setRows]=useState<UserRow[]>([]);const[total,setTotal]=useState(0);const[page,setPage]=useState(1);const[hasNextPage,setHasNextPage]=useState(false);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);const[filter,setFilter]=useState('');

 const fetchUsers=useCallback(async()=>{
  setLoading(true);setError(null);setRows([]);setTotal(0);setHasNextPage(false);
  const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
   const auth=await getAuthHeader();if(!auth){setError('No active Platform Owner session.');return;}
   const params=new URLSearchParams({page:String(page),limit:String(PAGE_SIZE)});if(roleFilter)params.set('role',roleFilter);
   const res=await fetch(`/api/super-admin/users?${params.toString()}`,{headers:{Authorization:auth},signal:controller.signal,cache:'no-store'});
   const body=await res.json().catch(()=>({}));if(!res.ok){setError((body as {error?:string}).error??'User service is currently unavailable.');return;}
   const data=body as Partial<ApiResponse>;if(!Array.isArray(data.rows)||typeof data.total!=='number'){setError('User service returned an invalid response contract.');return;}
   const pagination=data.pagination;
   if(pagination!==undefined&&(!pagination||typeof pagination!=='object'||typeof pagination.hasNextPage!=='boolean')){setError('User service returned invalid pagination metadata.');return;}
   setRows(data.rows);setTotal(data.total);setHasNextPage(pagination?.hasNextPage??page*PAGE_SIZE<data.total);
  }catch(cause){setError(cause instanceof DOMException&&cause.name==='AbortError'?'User service timed out.':'User service is currently unavailable.');}
  finally{window.clearTimeout(timeout);setLoading(false);}
 },[page,roleFilter]);

 useEffect(()=>{void fetchUsers();},[fetchUsers]);
 useEffect(()=>{setPage(1);setFilter('');},[roleFilter]);
 const filtered=useMemo(()=>{const term=filter.trim().toLowerCase();if(!term)return rows;return rows.filter(row=>[row.name,row.email,row.company??'',row.role].some(value=>value.toLowerCase().includes(term)));},[filter,rows]);

 return <ProtectedRoute allowedRoles={['owner']}><div style={{minHeight:'100vh',background:X.light,color:X.charcoal,padding:12}}>
  <header style={{minHeight:52,display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}><span aria-hidden='true' style={{width:28,height:28,display:'grid',placeItems:'center',borderRadius:4,background:X.navy,color:X.white,fontSize:12}}>{icon}</span><div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><h1 style={{margin:0,color:X.navy,fontSize:20,fontWeight:800}}>{title}</h1><span style={{padding:'3px 6px',borderRadius:4,background:'#EEF4FF',color:X.blue,fontSize:10,fontWeight:800,textTransform:'uppercase'}}>{section}</span><span style={{fontSize:10,color:X.muted}}>{loading?'…':error?'Unavailable':`${total.toLocaleString()} total`}</span></div><p style={{margin:'4px 0 0',color:X.muted,fontSize:12}}>{description}</p></div><button onClick={()=>void fetchUsers()} disabled={loading} style={{height:32,padding:'0 10px',background:X.blue,color:X.white,border:`1px solid ${X.blue}`,borderRadius:4,fontWeight:800,fontSize:11,cursor:loading?'not-allowed':'pointer',opacity:loading?.65:1}}>{loading?'Loading…':'Refresh'}</button></header>
  {error&&<div role='alert' style={{marginBottom:12,border:`1px solid ${X.red}`,borderLeft:`4px solid ${X.red}`,borderRadius:4,background:X.white,padding:'9px 12px',color:X.red,fontSize:11,fontWeight:700}}>{error}</div>}
  {!error&&<>
   <div style={{minHeight:40,display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}><input type='text' value={filter} onChange={event=>setFilter(event.target.value)} placeholder='Filter current page by name, email or company…' aria-label='Filter current page' style={{width:'100%',maxWidth:380,height:32,border:`1px solid ${X.border}`,borderRadius:4,padding:'0 8px',background:X.white,color:X.charcoal,fontSize:12,boxSizing:'border-box',outlineColor:X.blue}}/><span style={{color:X.muted,fontSize:10}}>Page {page} · server-side pagination</span></div>
   <section style={{background:X.white,border:`1px solid ${X.border}`,borderRadius:4,overflow:'hidden'}}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{height:38,background:X.light,borderBottom:`1px solid ${X.border}`}}>{columns.map(col=><th key={col.label} style={{padding:'0 12px',textAlign:'left',color:X.navy,fontWeight:800,textTransform:'uppercase',letterSpacing:'.04em',fontSize:10,whiteSpace:'nowrap'}}>{col.label}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan={columns.length} style={{padding:18,textAlign:'center',color:X.muted}}>Loading {title.toLowerCase()}…</td></tr>:filtered.length===0?<tr><td colSpan={columns.length} style={{padding:18,textAlign:'center',color:X.muted}}>{filter?'No records on this page match the filter.':`No ${title.toLowerCase()} found.`}</td></tr>:filtered.map(row=><tr key={row.id} style={{minHeight:44,borderBottom:`1px solid ${X.border}`}}>{columns.map(col=><td key={col.label} style={{padding:'9px 12px',color:X.charcoal,verticalAlign:'middle'}}>{col.render(row)}</td>)}</tr>)}</tbody></table></div>
    {!loading&&(page>1||hasNextPage)&&<div style={{minHeight:40,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'4px 12px',borderTop:`1px solid ${X.border}`,background:X.light}}><span style={{color:X.muted,fontSize:10}}>Showing {filtered.length} on page {page} · {total.toLocaleString()} total</span><div style={{display:'flex',gap:6}}><button type='button' onClick={()=>setPage(current=>Math.max(1,current-1))} disabled={page<=1||loading} style={pagerButton(page<=1||loading)}>← Prev</button><button type='button' onClick={()=>setPage(current=>current+1)} disabled={!hasNextPage||loading} style={pagerButton(!hasNextPage||loading)}>Next →</button></div></div>}
   </section>
  </>}
 </div></ProtectedRoute>;
}

const pagerButton=(disabled:boolean)=>({height:32,padding:'0 10px',borderRadius:4,border:`1px solid ${X.border}`,background:disabled?X.light:X.white,color:disabled?'#9CA3AF':X.navy,fontSize:11,fontWeight:700,cursor:disabled?'not-allowed':'pointer'} as const);
export{statusDot,fmt};
