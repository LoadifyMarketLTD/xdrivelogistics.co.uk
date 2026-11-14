import type { LiveJob } from './liveApi';

const labels:Record<string,string>={
  assigned:'Allocated',allocated:'Allocated',accepted:'Accepted',
  on_my_way:'On My Way to Collection',on_way_to_pickup:'On My Way to Collection',
  on_site_pickup:'On Site Collection',loaded:'Loaded',
  in_transit:'On My Way to Delivery',on_way_to_delivery:'On My Way to Delivery',
  on_site_delivery:'On Site Delivery',delivered:'Delivered / POD',
  pod_submitted:'POD Submitted',completed:'Completed',invoice:'Invoice',
};
const label=(s:string)=>labels[s.toLowerCase()]||s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const time=(value:string)=>{ if(!value)return 'Time not recorded';const d=new Date(value);return Number.isNaN(d.getTime())?'Time not recorded':new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(d);};
export default function BookingStatusTimeline({job}:{job:LiveJob}){
  const events=job.statusHistory||[];
  return <section className="rv-booking-timeline" aria-label="Booking Status History">
    <h3>Booking Status</h3>
    {events.length? <ol>{[...events].reverse().map((e,i)=><li key={e.at+'-'+e.status+'-'+i}><span className="rv-history-check" aria-hidden="true">✓</span><div><strong>{label(e.status)}</strong><small>{time(e.at)}</small>{e.notes&&<p>{e.notes}</p>}</div></li>)}</ol>
     : <div className="rv-history-unavailable"><strong>Current status: {label(job.backendStatus||job.status)}</strong><p>Earlier event timestamps have not been returned by the server. No history is invented.</p></div>}
  </section>;
}
