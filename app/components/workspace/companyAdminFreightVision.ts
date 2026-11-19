import type {WorkspaceJob,WorkspaceLocation} from './useCompanyWorkspaceData';

export function hasFreshFreightPosition(location:Pick<WorkspaceLocation,'lat'|'lng'|'recorded_at'|'updated_at'>|null|undefined,now=Date.now()){
  if(!location||!Number.isFinite(location.lat)||!Number.isFinite(location.lng)||Math.abs(location.lat)>90||Math.abs(location.lng)>180)return false;
  const t=Date.parse(location.recorded_at??location.updated_at??'');
  return Number.isFinite(t)&&t<=now&&now-t<=20*60_000;
}
export function freightReferenceMatches(job:WorkspaceJob,query:string){
  const needle=query.trim().toLowerCase();
  return !needle||[job.id,job.booking_reference,job.customer_reference,job.load_reference,job.load_ref,job.customer_ref].some(v=>String(v??'').toLowerCase().includes(needle));
}
export function freightDeliveryTargetPassed(job:WorkspaceJob,now=Date.now()){
  const t=Date.parse(job.delivery_datetime??'');
  return Number.isFinite(t)&&t<now&&String(job.current_status??job.status).toLowerCase()!=='on_site_delivery';
}
