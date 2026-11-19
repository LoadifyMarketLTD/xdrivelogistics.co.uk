import type { WorkspaceDataState, WorkspaceDriver, WorkspaceVehicle } from './useCompanyWorkspaceData';
import { classifyWorkspaceJobStage, isCompanyExecutionJob } from '../../../lib/jobs/workspaceJobStage';

export type FleetDriverFilter = 'all' | 'available' | 'on-job' | 'off-duty';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function companyFleetDrivers(data: Pick<WorkspaceDataState,'companyId'|'drivers'|'jobs'|'vehicles'>, filter: FleetDriverFilter, search = '') {
  if (!data.companyId) return [];
  const needle = norm(search);
  const activeDriverIds = new Set(data.jobs.filter(j => isCompanyExecutionJob(j,data.companyId) && classifyWorkspaceJobStage(j)==='in_progress').map(j=>j.assigned_driver_id));
  return data.drivers.filter(d=>{
    const active = norm(d.status)==='active';
    const onJob = activeDriverIds.has(d.id);
    const availability = norm(d.availability_status);
    const matches = filter==='all' || (filter==='available'&&active&&!onJob&&availability==='available') || (filter==='on-job'&&onJob) || (filter==='off-duty'&&active&&!onJob&&['offline','off_duty','off-duty'].includes(availability));
    const assigned = data.vehicles.filter(v=>v.assigned_driver_id===d.id);
    return matches && (!needle || norm([d.display_name,d.email,d.phone,...assigned.map(v=>v.reg_plate)].join(' ')).includes(needle));
  }).sort((a,b)=>(a.display_name||a.email||a.id).localeCompare(b.display_name||b.email||b.id));
}

export function companyFleetVehicles(data: Pick<WorkspaceDataState,'companyId'|'vehicles'|'drivers'>, search = '') {
  if (!data.companyId) return [];
  const needle=norm(search);
  return data.vehicles.filter(v=>{
    const d=data.drivers.find(d=>d.id===v.assigned_driver_id);
    return !needle||norm([v.reg_plate,v.make,v.model,v.type,d?.display_name,d?.email].join(' ')).includes(needle);
  }).sort((a,b)=>(a.reg_plate||a.id).localeCompare(b.reg_plate||b.id));
}
export const driverLabel=(d:WorkspaceDriver)=>d.display_name||d.email||d.id;
export const vehicleLabel=(v:WorkspaceVehicle)=>v.reg_plate||[v.make,v.model].filter(Boolean).join(' ')||v.id;
