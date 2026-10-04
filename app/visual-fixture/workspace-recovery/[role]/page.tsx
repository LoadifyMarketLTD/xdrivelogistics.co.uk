import {notFound} from 'next/navigation';
import {Suspense} from 'react';
import Fixture from '../../../components/workspace/WorkspaceActionRecoveryFixture';
import '../../../components/workspace/top-workspace-shell.css';
export default async function Page({params,searchParams}:{params:Promise<{role:string}>;searchParams:Promise<{screen?:string;document?:string}>}){
 if(process.env.NODE_ENV==='production'||process.env.E2E_VISUAL_FIXTURE!=='true')notFound();
 const {role}=await params;const query=await searchParams;
 if(!['carrier','customer','broker','owner','driver','dispatcher'].includes(role))notFound();
 return <Suspense fallback={<p>Loading test fixture...</p>}><Fixture role={role as 'carrier'|'customer'|'broker'|'owner'|'driver'|'dispatcher'} screen={query.screen??'readiness'} documentType={query.document}/></Suspense>;
}
