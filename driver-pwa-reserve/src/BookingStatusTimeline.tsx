import type { LiveJob, LiveStop } from './liveApi';
import { reserveTimelineStages as stages, reserveTimelineIndex as indexByStatus } from './reserveLifecycle';

const labels:Record<string,string>={
  assigned:'Allocated',allocated:'Allocated',accepted:'Accepted',
  on_my_way:'On My Way to Pickup',on_way_to_pickup:'On My Way to Pickup',
  on_site_pickup:'On Site (Pickup)',loaded:'Loaded',
  in_transit:'On My Way to Final Delivery',on_way_to_delivery:'On My Way to Final Delivery',
  on_site_delivery:'On Site (Final Delivery)',delivered:'Delivered / POD',pod_submitted:'POD Submitted',
  completed:'Completed',invoice:'Invoice',
};
const label=(s:string)=>labels[s.toLowerCase()]||s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const time=(value:string)=>{if(!value)return 'Time not recorded';const d=new Date(value);return Number.isNaN(d.getTime())?'Time not recorded':new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(d);};
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const str=(value:unknown)=>typeof value==='string'?value:'';

type AuditEvent={status:string;at:string;notes?:string};
const needsAttention=(status:string)=>/cancel|exception|refused|incorrect|damaged|skipped|awaiting|no unloading|return required/i.test(status);

function stopLabel(stop:LiveStop,index:number){
  if(stop.handover?.stopKind==='return')return 'Return Stop';
  if(stop.handover?.stopKind==='redirect')return 'Redirected Stop';
  return `${stop.type==='collection'?'Collection':'Delivery'} Stop ${index+1}`;
}

function stopAuditEvents(job:LiveJob):AuditEvent[]{
  const route=job.routeStops||[];
  const final=route.at(-1);
  const dynamicEnd=final?.handover?.stopKind==='return'||final?.handover?.stopKind==='redirect';
  const stops=route.length>2?route.slice(1,dynamicEnd?undefined:-1):dynamicEnd?route.slice(1):[];
  const result:AuditEvent[]=[];
  stops.forEach((stop,index)=>{
    const name=stopLabel(stop,index);
    if(stop.enRouteAt)result.push({status:`On My Way to ${name}`,at:stop.enRouteAt});
    if(stop.arrivedAt)result.push({status:`On Site – ${name}`,at:stop.arrivedAt});
    const exception=obj(stop.handover?.exception);
    if(str(exception.reportedAt))result.push({
      status:`${name} – ${str(exception.outcome)||'Delivery Exception'}`,
      at:str(exception.reportedAt),
      notes:str(exception.notes)||undefined,
    });
    const instruction=obj(stop.handover?.returnInstruction);
    if(str(instruction.reportedAt))result.push({
      status:'Return Required / Awaiting Instructions',
      at:str(instruction.reportedAt),
      notes:[str(instruction.reason),str(instruction.goodsDisposition)?'Goods disposition: '+str(instruction.goodsDisposition).replaceAll('_',' '):''].filter(Boolean).join(' · ')||undefined,
    });
    if(stop.cancelledAt){
      const cancellation=obj(stop.handover?.cancellation);
      result.push({
        status:`${name} Cancelled on Instruction`,at:stop.cancelledAt,
        notes:[
          str(cancellation.cancelledByRole)?'By: '+str(cancellation.cancelledByRole).replaceAll('_',' '):'',
          str(cancellation.cancelledByName)?'Contact: '+str(cancellation.cancelledByName):'',
          str(cancellation.reason)?'Reason: '+str(cancellation.reason):'',
          str(cancellation.goodsDisposition)&&str(cancellation.goodsDisposition)!=='none'?'Goods: '+str(cancellation.goodsDisposition).replaceAll('_',' '):'',
        ].filter(Boolean).join(' · ')||undefined,
      });
    }
    if(stop.completedAt){
      result.push({
        status:stop.handover?.stopKind==='return'?'Proof of Return / Return Completed':`${name} Completed`,
        at:stop.completedAt,
        notes:[
          stop.handover?.recipientName?'Received By: '+stop.handover.recipientName:'',
          stop.handover?.leftAt?'Left At: '+stop.handover.leftAt:'',
          stop.handover?.deliveryStatus?'Delivery Status: '+stop.handover.deliveryStatus:'',
          stop.handover?.itemCount!=null?'Items: '+stop.handover.itemCount:'',
          stop.handover?.weightKg!=null?'Weight: '+stop.handover.weightKg+' kg':'',
          stop.handover?.notes?"Driver Notes: "+stop.handover.notes:'',
        ].filter(Boolean).join(' · ')||undefined,
      });
    }
    if(stop.status==='skipped')result.push({status:`${name} – Legacy Skipped / Review Required`,at:'',notes:'This legacy state is not treated as completed or cancelled.'});
  });
  return result;
}

export default function BookingStatusTimeline({job}:{job:LiveJob}){
  const parentEvents=job.statusHistory||[];
  const events:AuditEvent[]=[
    ...parentEvents.map(event=>({status:event.status,at:event.at,notes:event.notes})),
    ...stopAuditEvents(job),
  ].sort((a,b)=>{
    const ams=Date.parse(a.at||'');const bms=Date.parse(b.at||'');
    return (Number.isFinite(ams)?ams:-1)-(Number.isFinite(bms)?bms:-1);
  });
  const collectionTime=Date.parse(job.pickup||'');
  const deliveryTime=Date.parse(job.delivery||'');
  const eventDates=events.map(event=>({event,at:Date.parse(event.at)})).filter(item=>Number.isFinite(item.at));
  const earlyEvents=eventDates.filter(item=>{const status=item.event.status.toLowerCase();return (status==='delivered'||status==='completed'||status==='pod_submitted')&&((Number.isFinite(collectionTime)&&item.at<collectionTime)||(Number.isFinite(deliveryTime)&&item.at<deliveryTime));});
  const completed=Boolean(job.podRecorded)||String(job.backendStatus||'').toLowerCase()==='completed';

  const history=<>{events.length?<ol className="rv-event-history">{[...events].reverse().map((event,index)=><li key={(event.at||'no-time')+'-'+event.status+'-'+index}><span className={"rv-history-check"+(needsAttention(event.status)?" rv-history-attention":"")} aria-hidden="true">{needsAttention(event.status)?"!":"\u2713"}</span><div><strong>{label(event.status)}</strong><small>{time(event.at)}</small>{event.notes&&<div className="rv-event-facts">{event.notes.split(" · ").map((note,i)=>{const colon=note.indexOf(":");return <div className="rv-event-fact" key={i}>{colon>0?<><span>{note.slice(0,colon)}</span><b>{note.slice(colon+1).trim()}</b></>:<span>{note}</span>}</div>})}</div>}</div></li>)}</ol>
    :<div className="rv-history-unavailable">No event history was returned by the server. No timestamps have been invented.</div>}</>;

  if(completed)return <section className="rv-booking-timeline" aria-label="Completed job event history">
    <h3>Job History — Completed</h3>
    {earlyEvents.length>0&&<div className="rv-warning" role="alert"><strong>Timeline discrepancy.</strong> A delivery event predates a scheduled booking time. Original timestamps are preserved; the schedule and audit log need review.</div>}
    {history}
  </section>;

  const current=job.podRecorded?7:(indexByStatus[job.status]??indexByStatus[String(job.backendStatus||'').toUpperCase()]??0);
  const currentTitle=job.podRecorded?'Signed POD archived':stages[current]?.title||label(job.backendStatus||job.status);
  return <section className="rv-booking-timeline" aria-label="Complete Booking Workflow">
    <h3>Complete Booking Workflow</h3>
    <p className="rv-workflow-current"><span>Current stage</span><strong>{currentTitle}</strong></p>
    {job.routeStops?.some(stop=>stop.status==='skipped')&&<div className="rv-warning" role="alert"><strong>Legacy skipped stop requires review.</strong> It is not treated as a valid completed/cancelled stop.</div>}
    {earlyEvents.length>0&&<div className="rv-warning" role="alert"><strong>Timeline discrepancy detected.</strong> A recorded delivery/completion event predates the scheduled collection or delivery time. These are the original server timestamps; no event was changed.</div>}
    <details className="rv-workflow-details"><summary>View primary workflow — 8 stages</summary><ol className="rv-workflow-steps">
      {stages.map((stage,index)=>{
        const done=index<current||(index===7&&job.podRecorded);
        const active=index===current&&!done;
        return <li key={stage.key} className={done?'is-done':active?'is-current':'is-pending'}><span className="rv-workflow-marker" aria-hidden="true">{done?'✓':index+1}</span><div><strong>{stage.title}</strong><small>{done?'Earlier stage':active?'Current stage':'Next stage'}</small></div></li>;
      })}
    </ol></details>
    <details className="rv-workflow-details" open><summary>View event history — {events.length} records</summary>{history}</details>
  </section>;
}
