"use client";
import OperationsDemo from "./OperationsDemo";
import type {MasterWorkspaceRole} from "./MasterWorkspacePolicy";
export default function MasterWorkspace({role}:{role:MasterWorkspaceRole}) {return <OperationsDemo role={role}/>;}
