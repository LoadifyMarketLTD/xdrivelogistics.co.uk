'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X={navy:'#0B2F6B',blue:'#1D57D8',orange:'#F5A300',white:'#FFFFFF',charcoal:'#1A1F2B',light:'#F4F6F8',border:'#D9E1EA',muted:'#64748B',green:'#16A34A',red:'#DC2626'} as const;
type HealthStatus='healthy'|'degraded'|'error'|'checking';
type ServiceCheck={service:string;status:HealthStatus;latencyMs?:number;detail?:string};
type Integration={service:string;configured:boolean;detail:string};
type InfraPayload={checkedAt?:string;checks?:ServiceCheck[];integrations?:Integration[];error?:string};
type EmailReadinessPayload={readinessStatus?:'healthy'|'degraded'|'error';readinessMessage?:string;errors?:string[]};
const colorFor=(status:HealthStatus)=>status==='healthy'?X.green:status==='degraded'?X.orange:status==='error'?X.red:X.muted;
const labelFor=(status:HealthStatus)=>status==='healthy'?'Healthy':status==='degraded'?'Degraded':status==='error'?'Error':'Checking';
function HealthCard({check}:{check:ServiceCheck}){const color=colorFor(check.status);return <div style={{background:X.white,border:`1px solid ${X.border}`,borderTop:`3px solid ${color}`,borderRadius:'4px',padding:'12px'}}><div style={{display:'flex',justifyContent:'space-between',gap:'8px',alignItems:'center'}}><span style={{color:X.navy,fontWeight:800,fontSize:'12px'}}>{check.service}</span><span style={{color,fontWeight:800,fontSize:'10px',textTransform:'uppercase'}}>{labelFor(check.status)}</span></div><div style={{marginTop:'6px',display:'flex',gap:'10px',flexWrap:'wrap'}}>{check.latencyMs!==undefined&&<span style={{color:X.muted,fontSize:'10px'}}>Latency: <strong style={{color:check.latencyMs<500?X.green:check.latencyMs<2000?X.orange:X.red}}>{check.latencyMs}ms</strong></span>}{check.detail&&<span style={{color:X.muted,fontSize:'10px'}}>{check.detail}</span>}</div></div>;}

export default function Page(){
 const[checks,setChecks]=useState<ServiceCheck[]>([]);const[integrations,setIntegrations]=useState<Integration[]>([]);const[checkedAt,setCheckedAt]=useState<string|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);
 const runChecks=useCallback(async()=>{setLoading(true);setError(null);const auth=await getAuthHeader();if(!auth){setError('No active owner session.');setLoading(false);return;}const apiChecks=[{service:'Stats API',url:'/api/super-admin/stats'},{service:'Operations API',url:'/api/super-admin/operations?section=jobs&limit=1'},{service:'Finance API',url:'/api/super-admin/finance?section=invoices&limit=1'},{service:'Compliance API',url:'/api/super-admin/compliance?section=documents&limit=1'},{service:'Marketplace API',url:'/api/super-admin/marketplace?limit=1'},{service:'Notifications API',url:'/api/super-admin/notifications?limit=1'},{service:'Users API',url:'/api/super-admin/users?limit=1'},{service:'Support API',url:'/api/super-admin/support?section=tickets&limit=1'}];const checkApi=async({service,url}:{service:string;url:string}):Promise<ServiceCheck=>never>=>{throw new Error('unreachable')};
 },[]);
 return null;
}
