"use client";
import dynamic from "next/dynamic";
const OperationsDemo=dynamic(()=>import("./OperationsDemo"),{ssr:false});
import type {MasterWorkspaceRole} from "./MasterWorkspacePolicy";
import type {ReactNode} from "react";
import {MasterPreviewIsolation} from "./MasterPreviewIsolation";
import AuthenticatedMasterShell from '../../components/workspace/AuthenticatedMasterShell';

/**
 * Canonical entry point. Authenticated route content must never pass through
 * preview/demo data providers or local demo navigation.
 */
export default function MasterWorkspace({role,authenticated=false,dashboard,initialTab=0}:{
 role:MasterWorkspaceRole;authenticated?:boolean;dashboard?:ReactNode;initialTab?:number;
}){
 if(authenticated){
  return <AuthenticatedMasterShell role={role} activeTab={initialTab}>
   {dashboard}
  </AuthenticatedMasterShell>;
 }
 return <MasterPreviewIsolation><OperationsDemo role={role} authenticated={false} dashboard={dashboard} initialTab={initialTab}/></MasterPreviewIsolation>;
}
