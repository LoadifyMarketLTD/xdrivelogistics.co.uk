/** Canonical DEMO operational state rules; server must verify identity, tenant and persistence independently. */
export type BookingStage="pending_acceptance"|"accepted"|"rejected"|"allocated"|"to_collection"|"at_collection"|"loaded"|"to_delivery"|"at_delivery"|"delivered"|"pod_received"|"completed";
export type BookingActor="buyer"|"carrier_operator"|"driver";
const transitions:Readonly<Record<BookingStage,Readonly<Partial<Record<BookingActor,readonly BookingStage[]>>>>>={
 pending_acceptance:{carrier_operator:["accepted","rejected"]},
 accepted:{carrier_operator:["allocated"]},
 rejected:{},
 allocated:{driver:["to_collection"]},
 to_collection:{driver:["at_collection"]},
 at_collection:{driver:["loaded"]},
 loaded:{driver:["to_delivery"]},
 to_delivery:{driver:["at_delivery"]},
 at_delivery:{driver:["delivered"]},
 delivered:{driver:["pod_received"]},
 pod_received:{carrier_operator:["completed"]},
 completed:{}
};
export function allowedBookingTransitions(stage:BookingStage,actor:BookingActor):readonly BookingStage[]{return transitions[stage]?.[actor]??[]}
export function canTransitionBooking(input:{from:BookingStage;to:BookingStage;actor:BookingActor;driverAssigned:boolean;vehicleAssigned:boolean;hasValidPodEvidence:boolean}):boolean {
 if(!allowedBookingTransitions(input.from,input.actor).includes(input.to))return false;
 if(input.to==="allocated"&&(!input.driverAssigned||!input.vehicleAssigned))return false;
 if(input.actor==="driver"&&(!input.driverAssigned||!input.vehicleAssigned))return false;
 if(input.to==="pod_received"&&!input.hasValidPodEvidence)return false;
 return true;
}
