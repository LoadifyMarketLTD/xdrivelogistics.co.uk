'use client';
import {useContext,useMemo,useState} from 'react';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {PathnameContext,SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import TopWorkspaceShell from './TopWorkspaceShell';
import DriverWorkspaceShell from '../../driver/_components/DriverWorkspaceShell';
import {PageFrame,PageHeader} from './WorkspaceUI';
import LoadPostingForm from './LoadPostingForm';
import VehicleReadinessRecovery from './VehicleReadinessRecovery';
import CompanyMarketplaceExchange from './CompanyMarketplaceExchange';
import {useAuth} from '../AuthContext';
const roots={carrier:'/admin',customer:'/customer',broker:'/broker',owner:'/driver',driver:'/driver',dispatcher:'/admin'} as const;
const roles={carrier:'company_owner',customer:'customer',broker:'broker',owner:'owner_driver',driver:'driver',dispatcher:'dispatcher'} as const;
export default function WorkspaceActionRecoveryFixture({role,screen,documentType}:{role:keyof typeof roots;screen:string;documentType?:string}){
 const actual=useContext(AppRouterContext);const {user}=useAuth();
 const [path,setPath]=useState(roots[role]+'/'+screen);const [target,setTarget]=useState('');
 const router=useMemo(()=>actual?{...actual,push:(href:string)=>{setTarget(href);setPath(href);},replace:(href:string)=>{setTarget(href);setPath(href);}}:null,[actual]);
 const params=useMemo(()=>new URLSearchParams(documentType?'document='+documentType:''),[documentType]);
 if(!router)return null;
 const postLoad = role==='owner'
  ? <DriverWorkspaceShell personaLabel="Owner driver workspace" subtitle="Create transport work"><LoadPostingForm mode="owner" /></DriverWorkspaceShell>
  : <PageFrame><PageHeader eyebrow="Transport work" title="Post Load" description="Create transport work"/><LoadPostingForm mode={role==='carrier'||role==='dispatcher'?'admin':role==='driver'?'owner':role as 'customer'|'broker'} /></PageFrame>;
 return <AppRouterContext.Provider value={router}><PathnameContext.Provider value={path}><SearchParamsContext.Provider value={params}>
  <div className="xdrive-workspace-measured xdrive-operational-top-workspace"><TopWorkspaceShell forcedRole={roles[role]}>
   <p>LOCAL TEST DATA - no production actions</p><output hidden data-testid="fixture-user">{user?.companyId}</output><output hidden data-testid="navigation-target">{target}</output>
   {screen==='post-load'?postLoad:screen==='vehicle-readiness'?<VehicleReadinessRecovery/>:screen==='quotes'?<CompanyMarketplaceExchange/>:<h1>Account recovery</h1>}
  </TopWorkspaceShell></div>
 </SearchParamsContext.Provider></PathnameContext.Provider></AppRouterContext.Provider>;
}
