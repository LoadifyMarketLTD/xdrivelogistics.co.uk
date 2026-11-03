"use client";
import OperationsDemo from "./OperationsDemo";
import type {MasterWorkspaceRole} from "./MasterWorkspacePolicy";
import type {ReactNode} from "react";
import {MasterPreviewIsolation} from "./MasterPreviewIsolation";
export default function MasterWorkspace({role,authenticated=false,dashboard,initialTab=0}:{role:MasterWorkspaceRole;authenticated?:boolean;dashboard?:ReactNode;initialTab?:number}) {const view=<OperationsDemo role={role} authenticated={authenticated} dashboard={dashboard} initialTab={initialTab}/>;const isolated=!authenticated||role==="Customer"||role==="Driver"||role==="Company Driver"||role==="Employee Driver";return isolated?<MasterPreviewIsolation>{view}</MasterPreviewIsolation>:view;}
