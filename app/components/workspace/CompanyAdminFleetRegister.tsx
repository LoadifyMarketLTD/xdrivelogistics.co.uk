'use client';
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ActionButton, DataTable, EmptyState, Panel, StatusBadge } from './WorkspaceUI';
import { unavailable } from './AdminDashboardShared';
import { companyFleetDrivers, companyFleetVehicles, driverLabel, vehicleLabel, type FleetDriverFilter } from './companyFleetRegister';
import { classifyWorkspaceJobStage, isCompanyExecutionJob, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { canonicalPodEvidence } from '../../../lib/pod/canonicalPodEvidence';
import { companyJobReference } from './companyOperationalOverview';
import type { WorkspaceDataState, WorkspaceDatasetKey, WorkspaceDocument } from './useCompanyWorkspaceData';

const tabs = [['all','All Drivers'],['available','Available'],['on-job','On Job'],['off-duty','Off Duty'],['vehicles','Vehicles']] as const;
type FleetTab = typeof tabs[number][0];
const driverTabs = ['Overview','Identity & Contacts','Employment & RTW','Licences & Qualifications','Documents','Vehicles','Availability & Shifts','Bookings & POD','Performance & Incidents','Compliance & Expiry','Audit History'];
const vehicleTabs = ['Overview','Vehicle Details','Assigned Driver','Documents','Maintenance','Compliance & Expiry','Bookings & POD','Audit History'];
const dash='Not recorded';
const fmt=(v:unknown)=>v==null||v===''?dash:String(v);
const link=(href:string,label:string)=><Link className="company-admin-ops-detail" href={href} prefetch={false}>{label}</Link>;
const facts=(items:[string,ReactNode][]) => <dl className="company-admin-fleet-facts">{items.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
const isExpired=(d:WorkspaceDocument)=>Boolean(d.expiry_date&&Date.parse(d.expiry_date)<Date.now());

export default function CompanyAdminFleetRegister({data}:{data:WorkspaceDataState}) {
  const [tab,setTab]=useState<FleetTab>('all');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<{kind:'driver'|'vehicle';id:string}|null>(null);
  const [profileTab,setProfileTab]=useState('Overview');
  const [page,setPage]=useState(0);
  const drivers=useMemo(()=>companyFleetDrivers(data,tab==='vehicles'?'all':tab as FleetDriverFilter,search),[data,tab,search]);
  const vehicles=useMemo(()=>companyFleetVehicles(data,search),[data,search]);
  const driver=selected?.kind==='driver'?data.drivers.find(d=>d.id===selected.id):undefined;
  const vehicle=selected?.kind==='vehicle'?data.vehicles.find(v=>v.id===selected.id):undefined;
  const open=(kind:'driver'|'vehicle',id:string)=>{setSelected({kind,id});setProfileTab('Overview')};
  const truth=(keys:WorkspaceDatasetKey[])=>Boolean(data.companyId)&&!data.loading&&!unavailable(data,keys);
  const count=tab==='vehicles'?vehicles.length:drivers.length;
  const safePage=Math.min(page,Math.max(0,Math.ceil(count/12)-1));
  const slice=(rows:typeof drivers|typeof vehicles)=>rows.slice(safePage*12,safePage*12+12);
  const ownJobs=(driverId?:string,vehicleId?:string)=>data.jobs.filter(j=>Boolean(data.companyId)&&isCompanyExecutionJob(j,data.companyId!)&&(driverId?j.assigned_driver_id===driverId:j.vehicle_id===vehicleId));
  const showDocs=(docs:WorkspaceDocument[],key:WorkspaceDatasetKey,expiryOnly=false)=>{
    if(!truth([key]))return <p role="status">Document records unavailable or incomplete.</p>;
    const rows=expiryOnly?docs.filter(d=>d.expiry_date):docs;
    return <><DataTable columns={['Document','Status','Expiry']} rows={rows.map(d=>[fmt(d.doc_type),<StatusBadge key={d.id} value={isExpired(d)?'Expired':fmt(d.status)}/>,fmt(d.expiry_date)])} empty={<EmptyState title="No matching document records"/>}/>{link('/admin/documents?type='+ (key==='driverDocuments'?'driver':'vehicle'),'Manage documents')}</>;
  };
  const showJobs=(jobs:ReturnType<typeof ownJobs>)=>!truth(['jobs'])?<p role="status">Booking records unavailable or incomplete.</p>:<DataTable columns={['Reference','Route','Status','POD','Actions']} rows={jobs.map(j=>[companyJobReference(j),[j.pickup_location||j.pickup_postcode,j.delivery_location||j.delivery_postcode].filter(Boolean).join(' → ')||dash,<StatusBadge key={'s'+j.id} value={workspaceJobOperationalLabel(j)}/>,canonicalPodEvidence(j).state,link('/admin/diary?job='+encodeURIComponent(j.id),'View booking')])} empty={<EmptyState title="No assigned bookings"/>}/>;
  function profile():ReactNode {
    if(driver){
      const docs=data.driverDocuments.filter(d=>d.driver_id===driver.id);
      const assigned=data.vehicles.filter(v=>v.assigned_driver_id===driver.id);
      const jobs=ownJobs(driver.id);
      switch(profileTab){
        case 'Overview':return facts([['Driver',driverLabel(driver)],['Account status',<StatusBadge value={fmt(driver.status)}/>],['Availability',fmt(driver.availability_status)],['Assigned vehicles',truth(['vehicles'])?assigned.length:'Unavailable'],['Bookings',truth(['jobs'])?jobs.length:'Unavailable']]);
        case 'Identity & Contacts':return <>{facts([['Name',driverLabel(driver)],['Email',fmt(driver.email)],['Phone',fmt(driver.phone)]])}{link('/admin/drivers','Manage driver record')}</>;
        case 'Employment & RTW':return <>{showDocs(docs.filter(d=>/right.to.work|rtw|employment/i.test(d.doc_type||'')),'driverDocuments')}<p>Employment terms are not supplied by this register.</p></>;
        case 'Licences & Qualifications':return showDocs(docs.filter(d=>/licen[cs]e|qualification|cpc|training|dqc|tachograph/i.test(d.doc_type||'')),'driverDocuments');
        case 'Documents':return showDocs(docs,'driverDocuments');
        case 'Vehicles':return !truth(['vehicles'])?<p>Vehicle records unavailable.</p>:<DataTable columns={['Vehicle','Type','Actions']} rows={assigned.map(v=>[vehicleLabel(v),fmt(v.type),<ActionButton key={v.id} onClick={()=>open('vehicle',v.id)}>View vehicle</ActionButton>])} empty={<EmptyState title="No assigned vehicles"/>}/>;
        case 'Availability & Shifts':return <>{facts([['Availability',fmt(driver.availability_status)],['Future position',fmt(driver.future_position)],['From',fmt(driver.future_position_date)],['Until',fmt(driver.future_position_until)],['Notes',fmt(driver.future_availability_notes)]])}{link('/admin/fleet/future-availability','Manage future availability')}<p>Shift history is not provided by this register.</p></>;
        case 'Bookings & POD':return showJobs(jobs);
        case 'Performance & Incidents':return <>{facts([['Completed bookings',truth(['jobs'])?jobs.filter(j=>classifyWorkspaceJobStage(j)==='completed').length:'Unavailable'],['In progress',truth(['jobs'])?jobs.filter(j=>classifyWorkspaceJobStage(j)==='in_progress').length:'Unavailable']])}{link('/admin/incidents','Open incident register')}<p>No on-time performance score is inferred without actual completion timestamps.</p></>;
        case 'Compliance & Expiry':return <>{showDocs(docs,'driverDocuments',true)}{link('/admin/fleet/compliance','Open compliance register')}</>;
        case 'Audit History':return <><p>Individual audit events are not supplied by this register. Open the authoritative event log.</p>{link('/admin/event-log','Event log')}</>;
      }
    }
    if(vehicle){
      const docs=data.vehicleDocuments.filter(d=>d.vehicle_id===vehicle.id);
      const assigned=data.drivers.find(d=>d.id===vehicle.assigned_driver_id);
      switch(profileTab){
        case 'Overview':case 'Vehicle Details':return <>{facts([['Registration',vehicleLabel(vehicle)],['Type',fmt(vehicle.type)],['Make',fmt(vehicle.make)],['Model',fmt(vehicle.model)],['Year',fmt(vehicle.manufacture_year)],['Payload (kg)',fmt(vehicle.payload_kg)],['Pallet capacity',fmt(vehicle.pallets_capacity)],['Body type',fmt(vehicle.body_type)],['Tail lift',vehicle.has_tail_lift==null?dash:vehicle.has_tail_lift?'Yes':'No']])}{link('/admin/vehicles','Manage vehicle record')}</>;
        case 'Assigned Driver':return assigned?<>{facts([['Driver',driverLabel(assigned)],['Availability',fmt(assigned.availability_status)]])}<ActionButton onClick={()=>open('driver',assigned.id)}>View driver profile</ActionButton></>:<p>{truth(['drivers'])?'No matching assigned driver.':'Driver records unavailable.'}</p>;
        case 'Documents':return showDocs(docs,'vehicleDocuments');
        case 'Maintenance':return <>{showDocs(docs.filter(d=>/mot|service|maintenance|inspection/i.test(d.doc_type||'')),'vehicleDocuments')}{link('/admin/fleet/maintenance','Maintenance register')}</>;
        case 'Compliance & Expiry':return <>{showDocs(docs,'vehicleDocuments',true)}{link('/admin/fleet/compliance','Compliance register')}</>;
        case 'Bookings & POD':return showJobs(ownJobs(undefined,vehicle.id));
        case 'Audit History':return link('/admin/event-log','Open authoritative event log');
      }
    }
    return <EmptyState title="Selected record unavailable"/>;
  }
  return <div className="company-admin-fleet">
    <Panel title={selected?(driver?driverLabel(driver):vehicle?vehicleLabel(vehicle):'Record unavailable'):'Fleet register'} description={selected?'Company-scoped records':'Drivers and vehicles registered to the active company.'} actions={selected?<ActionButton tone="secondary" onClick={()=>setSelected(null)}>Back to fleet</ActionButton>:<>{link('/admin/drivers','Manage drivers')}{link('/admin/vehicles','Manage vehicles')}</>}>
      {selected?<><div className="workspace-tab-strip company-admin-fleet-tabs" role="group" aria-label="Profile sections">{(selected.kind==='driver'?driverTabs:vehicleTabs).map(t=><button type="button" key={t} aria-pressed={profileTab===t} data-active={String(profileTab===t)} onClick={()=>setProfileTab(t)}>{t}</button>)}</div>{profile()}</>:<>
        <div className="workspace-tab-strip company-admin-fleet-tabs" role="group" aria-label="Fleet filters">{tabs.map(([id,label])=><button type="button" key={id} data-active={String(tab===id)} aria-pressed={tab===id} onClick={()=>{setTab(id);setPage(0)}}>{label}</button>)}</div>
        <label className="company-admin-fleet-search">Search <input value={search} placeholder="Name, email, phone or registration" onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label>
        {!truth(tab==='vehicles'?['vehicles']:tab==='all'?['drivers']:['drivers','jobs'])?<p role="status">{data.loading?'Loading fleet…':'Fleet records unavailable or incomplete.'}</p>:tab==='vehicles'?<DataTable columns={['Registration','Type','Assigned driver','Payload','Actions']} rows={(slice(vehicles) as typeof vehicles).map(v=>[vehicleLabel(v),fmt(v.type),data.drivers.find(d=>d.id===v.assigned_driver_id)?.display_name||dash,v.payload_kg!=null?v.payload_kg+' kg':dash,<ActionButton key={v.id} onClick={()=>open('vehicle',v.id)}>View details</ActionButton>])} empty={<EmptyState title="No matching vehicles"/>}/>:<DataTable columns={['Driver','Account','Availability','Vehicle','Actions']} rows={(slice(drivers) as typeof drivers).map(d=>[driverLabel(d),<StatusBadge key={'s'+d.id} value={fmt(d.status)}/>,<StatusBadge key={'a'+d.id} value={fmt(d.availability_status)}/>,data.vehicles.filter(v=>v.assigned_driver_id===d.id).map(vehicleLabel).join(', ')||dash,<ActionButton key={d.id} onClick={()=>open('driver',d.id)}>View profile</ActionButton>])} empty={<EmptyState title="No matching drivers"/>}/>}
        {count>12&&<div className="company-admin-ops-pagination"><button type="button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>Previous</button><span>{safePage*12+1}–{Math.min(count,safePage*12+12)} of {count}</span><button type="button" disabled={(safePage+1)*12>=count} onClick={()=>setPage(safePage+1)}>Next</button></div>}
      </>}
    </Panel>
  </div>;
}
