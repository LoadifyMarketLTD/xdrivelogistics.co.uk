import type { LiveJob } from './liveApi';

const labels:Record<string,string>={
  assigned:'Allocated',allocated:'Allocated',accepted:'Accepted',
  on_my_way:'On My Way to Collection',on_way_to_pickup:'On My Way to Collection',
  on_site_pickup:'On Site Collection',loaded:'Loaded',
  in_transit:'On My Way to Delivery',on_way_to_delivery:'On My Way to Delivery',
  on_site_delivery:'On Site Delivery',delivered:'Delivered',pod_submitted:'POD Submitted',
  completed:'Completed',invoice:'Invoice',
};
const label=(s:string)=>labels[s.toLowerCase()]||s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const time=(value:string)=>{ if(!value)return 'Time not recorded';const d=new Date(value);return Number.isNaN(d.getTime())?'Time not recorded':new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(d);};
const stages=[
  {key:'ALLOCATED',title:'Allocated'},
  {key:'ON_WAY_TO_PICKUP',title:'On My Way to Collection'},
  {key:'ON_SITE_PICKUP',title:'On Site Collection'},
  {key:'LOADED',title:'Loaded'},
  {key:'ON_WAY_TO_DELIVERY',title:'On My Way to Delivery'},
  {key:'ON_SITE_DELIVERY',title:'On Site Delivery'},
  {key:'DELIVERED',title:'Delivered'},
  {key:'POD_ARCHIVED',title:'Signed POD archived'},
];
const indexByStatus:Record<string,number>={ALLOCATED:0,ON_WAY_TO_PICKUP:1,ON_SITE_PICKUP:2,LOADED:3,ON_WAY_TO_DELIVERY:4,ON_SITE_DELIVERY:5,DELIVERED:6,POD_SUBMITTED:6};
export default function BookingStatusTimeline({job}:{job:LiveJob}){
  const events=job.statusHistory||[];
  const collectionTime=Date.parse(job.pickup||'');
  const deliveryTime=Date.parse(job.delivery||'');
  const eventDates=events.map(e=>({event:e,at:Date.parse(e.at)})).filter(e=>Number.isFinite(e.at));
  const earlyEvents=eventDates.filter(e=>{const status=e.event.status.toLowerCase();return (status==='delivered'||status==='completed'||status==='pod_submitted')&&((Number.isFinite(collectionTime)&&e.at<collectionTime)||(Number.isFinite(deliveryTime)&&e.at<deliveryTime));});
  const completed=job.podRecorded||['DELIVERED','POD_SUBMITTED','COMPLETED'].includes(job.status);
  if(completed) return <section className="rv-booking-timeline" aria-label="Completed job event history">
    <h3>Job History — Completed</h3>
    {earlyEvents.length>0&&<div className="rv-warning" role="alert"><strong>Timeline discrepancy.</strong> A delivery event predates a scheduled booking time. Original timestamps are preserved; the schedule and audit log need review.</div>}
    {events.length?<ol className="rv-event-history">{[...events].reverse().map((e,i)=><li key={e.at+'-'+e.status+'-'+i}><span className="rv-history-check" aria-hidden="true">✓</span><div><strong>{label(e.status)}</strong><small>{time(e.at)}</small>{e.notes&&<p>{e.notes}</p>}</div></li>)}</ol>
      :<div className="rv-history-unavailable">No event history was returned by the server. No timestamps have been invented.</div>}
  </section>;  const current=job.podRecorded?7:(indexByStatus[job.status]??indexByStatus[String(job.backendStatus||'').toUpperCase()]??0);
  const currentTitle=job.podRecorded?'Signed POD archived':stages[current]?.title||label(job.backendStatus||job.status);
  return <section className="rv-booking-timeline" aria-label="Complete Booking Workflow">
    <h3>Complete Booking Workflow</h3>
    <p className="rv-workflow-current">Current stage: <strong>{currentTitle}</strong></p>
    {earlyEvents.length>0&&<div className="rv-warning" role="alert"><strong>Timeline discrepancy detected.</strong> A recorded delivery/completion event predates the scheduled collection or delivery time. These are the original server timestamps; no event was changed. Verify the booking schedule and audit log.</div>}`n    <details className="rv-workflow-details"><summary>View complete workflow — 8 stages</summary><ol className="rv-workflow-steps">
      {stages.map((stage,index)=>{
        const done=index<current || (index===7 && job.podRecorded);
        const active=index===current && !done;
        return <li key={stage.key} className={done?'is-done':active?'is-current':'is-pending'}>
          <span className="rv-workflow-marker" aria-hidden="true">{done?'✓':index+1}</span>
          <div><strong>{stage.title}</strong><small>{done?'Completed':active?'Current stage':'Next stage'}</small></div>
        </li>;
      })}
    </ol></details>
    <details className="rv-workflow-details"><summary>View event history — {events.length} records</summary>
    {events.length?<ol className="rv-event-history">{[...events].reverse().map((e,i)=><li key={e.at+'-'+e.status+'-'+i}><span className="rv-history-check" aria-hidden="true">✓</span><div><strong>{label(e.status)}</strong><small>{time(e.at)}</small>{e.notes&&<p>{e.notes}</p>}</div></li>)}</ol>
      :<div className="rv-history-unavailable"><strong>Current status: {label(job.backendStatus||job.status)}</strong><p>Earlier event timestamps have not been returned by the server. No history is invented.</p></div>}
    </details>
  </section>;
}
