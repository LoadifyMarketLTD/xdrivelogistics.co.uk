"use client";
import OperationsDemo from "./OperationsDemo";
import type {MasterWorkspaceRole} from "./MasterWorkspacePolicy";
import type {ReactNode} from "react";
import {MasterPreviewIsolation} from "./MasterPreviewIsolation";
export default function MasterWorkspace({role,authenticated=false,dashboard}:{role:MasterWorkspaceRole;authenticated?:boolean;dashboard?:ReactNode}) {const view=<OperationsDemo role={role} authenticated={authenticated} dashboard={dashboard}/>;const isolated=!authenticated||role==="Customer"||role==="Driver"||role==="Company Driver"||role==="Employee Driver";return isolated?<MasterPreviewIsolation>{view}</MasterPreviewIsolation>:view;}
