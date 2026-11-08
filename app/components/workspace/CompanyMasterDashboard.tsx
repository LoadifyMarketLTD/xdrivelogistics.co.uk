'use client';

import {useMemo} from 'react';
import {useRouter} from 'next/navigation';
import {useCompany3150Live} from '../../try-xdrive-demo/components/Company3150LiveData';
import DemoCompanyDashboard from '../../try-xdrive-demo/components/DemoCompanyDashboard';
import {masterNavigationHref} from '../../../lib/masterWorkspaceNavigation';
import {classifyWorkspaceJobStage} from '../../../lib/jobs/workspaceJobStage';

/** The approved Master 3150 dashboard is the shared visual source for every
 * production company workspace. This adapter supplies only authenticated data. */
export default function CompanyMasterDashboard({role}:{role:'Company / Carrier'|'Broker'|'Customer'}){
 const router=useRouter();
 const real=useCompany3150Live();
 const data=real?.data;
 const jobs=useMemo(()=>(data?.jobs??[]).map(job=>{
   const stage=classifyWorkspaceJobStage(job);
   const pod=Boolean(job.pod_generated||job.pod_generated_at||job.has_delivery_evidence||job.delivery_signature_data||job.pod_photos?.length||job.delivery_photos?.length);
   return {
     id:job.id,
     from:job.pickup_location||job.pickup_postcode||'Collection not recorded',
     to:job.delivery_location||job.delivery_postcode||'Delivery not recorded',
     vehicle:(job.requested_vehicle_label||job.vehicle_type||'Vehicle not recorded').replaceAll('_',' '),
     cargo:[job.pallets==null?null:`${job.pallets} pallets`,job.weight_kg==null?null:`${job.weight_kg} kg`].filter(Boolean).join(' | ')||'Cargo not recorded',
     company:job.client_name||'Customer not recorded',
     status:stage==='completed'?'Completed':stage==='in_progress'?'In Progress':stage==='awarded'||stage==='allocated'?'Allocated':stage==='cancelled'||stage==='expired'?'Cancelled':'Open',
     price:Number(job.budget_amount??0),
     driver:job.assigned_driver_id?(data?.drivers.find(driver=>driver.id===job.assigned_driver_id)?.display_name||'Assigned driver'):'',
     vehicleId:data?.vehicles.find(vehicle=>vehicle.id===job.vehicle_id)?.reg_plate||'',
     stage:stage==='completed'?7:stage==='in_progress'?3:0,
     pod,
   };
 }),[data]);
 const fleet=useMemo(()=>(data?.vehicles??[]).map(vehicle=>({
   id:vehicle.id,reg:vehicle.reg_plate||'Registration unavailable',
   type:vehicle.type||'Not recorded',
   driver:data?.drivers.find(driver=>driver.id===vehicle.assigned_driver_id)?.display_name||'Unassigned',
   area:'Not recorded',status:'Not verified',
 })),[data]);
 const drivers=useMemo(()=>(data?.drivers??[]).map(driver=>driver.display_name||'Unnamed driver'),[data]);
 if(!real||data?.loading)return <p role="status">Loading live XDrive operations...</p>;
 if(data.error)return <p role="alert">Production records unavailable: {data.error}</p>;
 const navigate=(tab:number)=>{
   const href=masterNavigationHref(role,tab);
   if(href)router.push(href);
 };
 const onOpenJob=(id:string)=>router.push((role==='Broker'?'/broker/jobs/':role==='Customer'?'/customer/jobs/':'/admin/jobs/')+encodeURIComponent(id));
 const verifiedOutstanding=data.datasets.invoices.availability==='available'&&!data.datasets.invoices.partialData&&!data.datasets.invoices.limitedData
  ?data.invoices.filter(i=>!['paid','cancelled','void'].includes((i.payment_status||i.status||'').toLowerCase())&&(i.currency||'GBP')==='GBP').reduce((n,i)=>n+Number(i.amount??0),0)
  :null;
 return <DemoCompanyDashboard workspaceLabel={role} suppressPreview jobs={jobs} fleet={fleet}
  drivers={drivers} go={navigate} onOpenJob={onOpenJob} verifiedOutstanding={verifiedOutstanding}/>;
}