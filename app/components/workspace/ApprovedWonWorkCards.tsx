'use client';
import {useRouter} from 'next/navigation';
import './approved-won-work-cards.css';
export type ApprovedWonJob={id:string;pickup_postcode?:string|null;delivery_postcode?:string|null;vehicle_type?:string|null;requested_vehicle_label?:string|null;status?:string|null;current_status?:string|null;posterName?:string;booking_reference?:string|null;pickup_datetime?:string|null;};
export default function ApprovedWonWorkCards({jobs,loading}:{jobs:ApprovedWonJob[];loading:boolean}){
 const router=useRouter();
 if(loading)return <p role="status">Loading bookings…</p>;
 if(!jobs.length)return <div className="xd-approved-won-work-empty">No marketplace work has been awarded to your company yet.</div>;
 return <div className="xd-approved-won-work-grid">{jobs.map(job=><article key={job.id} className="xd-approved-won-work-card">
 <div className="xd-approved-won-work-heading"><strong>{job.posterName||'Marketplace member'}</strong><span>{job.current_status||job.status||'Awarded'}</span></div>
 <div className="xd-approved-won-work-route"><div><small>COLLECTION</small><strong>{job.pickup_postcode||'Location pending'}</strong></div><b>→</b><div><small>DELIVERY</small><strong>{job.delivery_postcode||'Location pending'}</strong></div></div>
 <div className="xd-approved-won-work-meta"><span>{job.requested_vehicle_label||job.vehicle_type||'Vehicle TBC'}</span><span>{job.pickup_datetime?new Date(job.pickup_datetime).toLocaleDateString('en-GB'):'Date TBC'}</span><span>Ref: {job.booking_reference||job.id.slice(0,8).toUpperCase()}</span></div>
 <button type="button" onClick={()=>router.push('/admin/jobs/'+encodeURIComponent(job.id))}>Open Booking Details</button>
 </article>)}</div>;
}
