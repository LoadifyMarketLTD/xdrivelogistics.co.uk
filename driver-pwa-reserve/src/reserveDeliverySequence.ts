import type {LiveJob} from './liveApi';
type Evidence = {photos:string[];documents:string[]};
type CanonicalJob = {job:LiveJob;partial:boolean};
type DeliveryOperations = {
 read:()=>Promise<CanonicalJob>;
 upload:()=>Promise<Evidence>;
 delivered:()=>Promise<void>;
 onDelivered:()=>void;
 archive:(e:Evidence)=>Promise<unknown>;
 verify:()=>Promise<boolean>;
};
export async function finishReserveDelivery(id:string,ops:DeliveryOperations){
 const detail=await ops.read();
 if(detail.partial)throw new Error('Route stops could not be verified. Refresh booking.');
 if(detail.job.id!==id||detail.job.backendStatus!=='on_site_delivery')throw new Error('Server must confirm On Site (Final Delivery) before delivery. Refresh booking.');
 const pending=(detail.job.routeStops||[]).some(stop=>stop.id!==id+':'+stop.type&&(detail.job.isTest===true?stop.status!=='completed':!['completed','cancelled'].includes(stop.status)));
 if(pending)throw new Error('Complete all persisted route stops before finalising POD.');
 const evidence=await ops.upload();
 if(!evidence.photos.length)throw new Error('XDrive requires at least one verified delivery photo before Delivered.');
 await ops.delivered();
 ops.onDelivered();
 const result=await ops.archive(evidence);
 if(!result||typeof result!=='object'||!('ok' in result)||result.ok!==true)throw new Error('XDrive did not confirm the canonical POD.');
 if(!await ops.verify())throw new Error('POD has not yet been confirmed by the server. Refresh booking.');
}