'use client';

import { isDiaryBookingJob } from '../../../lib/jobs/workspaceJobStage';

type OperationalJob = {
 status?:string|null;
 current_status?:string|null;
 pickup_datetime?:string|null;
 delivery_datetime?:string|null;
 assigned_driver_id?:string|null;
 awarded_carrier_company_id?:string|null;
 assigned_company_id?:string|null;
 vehicle_id?:string|null;
 pod_generated?:boolean|null;
 pod_generated_at?:string|null;
 delivery_photos?:string[]|null;
};
type View='bookings'|'diary';
const sameDay=(value:string|null|undefined,day:string)=>Boolean(value&&value.slice(0,10)===day);
const isCompleted=(j:OperationalJob)=>['delivered','completed'].includes((j.current_status||j.status||'').toLowerCase());
const isCancelled=(j:OperationalJob)=>['cancelled','canceled','expired'].includes((j.current_status||j.status||'').toLowerCase());
const isBooked=(j:OperationalJob)=>isDiaryBookingJob(j);
// Delivery photos are staged evidence; only a generated POD counts as received.
const hasPod=(j:OperationalJob)=>j.pod_generated===true||Boolean(j.pod_generated_at);
export default function Master3150OperationsKpis({jobs,view}:{jobs:readonly OperationalJob[];view:View}){
 const today=new Date().toISOString().slice(0,10);
 const week=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const bookings=jobs.filter(isBooked);
 const activeBookings=bookings.filter(j=>!isCancelled(j));
 const total=bookings.length;
 const inProgress=activeBookings.filter(j=>!isCompleted(j)&&Boolean(j.assigned_driver_id)).length;
 const completed=activeBookings.filter(isCompleted).length;
 const awaiting=activeBookings.filter(j=>isCompleted(j)&&!hasPod(j)).length;
 const pending=activeBookings.filter(j=>!isCompleted(j)&&!j.assigned_driver_id).length;
 const cards=view==='diary'?[
  {name:'Total Bookings',value:total,sub:'All statuses',tone:'orange'},
  {name:"Today’s Bookings",value:activeBookings.filter(j=>sameDay(j.pickup_datetime,today)).length,sub:'Collections today',tone:'blue'},
  {name:'Completed Today',value:activeBookings.filter(j=>isCompleted(j)&&sameDay(j.delivery_datetime,today)).length,sub:'Delivered today',tone:'green'},
  {name:'Awaiting POD',value:awaiting,sub:'Delivery evidence needed',tone:'amber'},
  {name:'Next 7 Days',value:activeBookings.filter(j=>Boolean(j.pickup_datetime&&j.pickup_datetime.slice(0,10)>=today&&j.pickup_datetime.slice(0,10)<=week)).length,sub:'Scheduled bookings',tone:'sky'},
 ]:[
  {name:'Total Bookings',value:total,sub:'All awarded work',tone:'orange'},
  {name:'In Progress',value:inProgress,sub:'Assigned work',tone:'blue'},
  {name:'Completed',value:completed,sub:'Completed transport',tone:'green'},
  {name:'Pending Allocation',value:pending,sub:'Assign driver / vehicle',tone:'amber'},
  {name:'Awaiting POD',value:awaiting,sub:'Action required',tone:'sky'},
 ];
 return <section className="xd-diary-kpis" aria-label={view==='diary'?'Diary overview':'Booking overview'} data-master-reference="3150">
  {cards.map((card)=><div key={card.name} className={'xd-diary-kpi '+card.tone}>
   <div><strong>{card.name}</strong><b>{card.value}</b><small>{card.sub}</small></div>
  </div>)}
 </section>;
}
