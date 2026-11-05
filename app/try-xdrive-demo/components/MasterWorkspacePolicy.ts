"use client";
export const MASTER_WORKSPACE_TABS = ["Dashboard","Post Load","Loads","Quotes","Bookings","My Fleet","Drivers","Diary","Invoices","Network & Tools","Directory","Live Availability","Return Journeys","Freight Vision","Messages","Notifications","Reports"] as const;
export type MasterWorkspaceRole="Company / Carrier"|"Customer"|"Broker"|"Fleet"|"Owner Driver"|"Dispatcher"|"Driver"|"Company Driver"|"Employee Driver";
export type MasterWorkspaceCapability="postLoad"|"quote"|"award"|"manageFleet"|"manageDrivers"|"invoice"|"dispatch"|"manageCompany";
const roleCaps:Record<MasterWorkspaceRole,readonly MasterWorkspaceCapability[]>={
"Company / Carrier":["postLoad","quote","award","manageFleet","manageDrivers","invoice","dispatch","manageCompany"],"Customer":["postLoad","award"],"Broker":["postLoad","quote","award","dispatch"],"Fleet":["postLoad","quote","manageFleet","manageDrivers","dispatch"],"Owner Driver":["postLoad","quote","award","manageFleet","manageDrivers","invoice","dispatch","manageCompany"],"Dispatcher":["postLoad","quote","award","manageFleet","manageDrivers","dispatch"],"Driver":["quote"],"Company Driver":["quote"],"Employee Driver":[]};
export function masterWorkspaceCan(role:MasterWorkspaceRole,action:MasterWorkspaceCapability):boolean{return roleCaps[role].includes(action)}
