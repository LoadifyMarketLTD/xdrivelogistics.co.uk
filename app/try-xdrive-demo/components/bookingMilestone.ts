/** A single role-independent projection of booking status.
 * UI state must reflect the canonical autonomous transport ledger. */
export type BookingStateInput={
 status?:string;operationalStatus?:string;podReceived?:boolean;
 deliveryStage?:number;assignedDriver?:string;assignedVehicleId?:string;
};
export type BookingMilestone="Pending Acceptance"|"Pending Allocation"|"Allocated"|"In Progress"|"Awaiting POD"|"Completed"|"Cancelled";

export function bookingMilestone(l:BookingStateInput):BookingMilestone {
 if(l.status==="Cancelled"||l.operationalStatus==="cancelled")return "Cancelled";
 if(l.podReceived||l.operationalStatus==="completed")return "Completed";
 const status=l.operationalStatus;
 if(status==="pending_acceptance")return "Pending Acceptance";
 if(status==="accepted")return "Pending Allocation";
 if(status==="allocated")return "Allocated";
 if(status==="delivered")return "Awaiting POD";
 if(["on_way_pickup","on_site_pickup","loaded","on_way_delivery","on_site_delivery"].includes(status||""))return "In Progress";
 if((l.deliveryStage||0)>=6)return "Awaiting POD";
 if((l.deliveryStage||0)>0)return "In Progress";
 if(l.assignedDriver||l.assignedVehicleId)return "Allocated";
 return "Pending Allocation";
}
export function bookingEvidenceStatus(l:BookingStateInput):string {
 if(l.podReceived)return "POD received";
 return bookingMilestone(l)==="Awaiting POD"?"Awaiting POD":"Not yet delivered";
}
