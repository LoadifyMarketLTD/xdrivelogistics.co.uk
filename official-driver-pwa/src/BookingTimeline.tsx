import type { LiveStop } from './liveApi';

type ParentEvent={status:string;timestamp?:string;note?:string;source?:string};
type LocalEvent={status:string;at:string};

type Props={
  live:boolean;
  statusHistory?:ParentEvent[];
  localHistory?:LocalEvent[];
  routeStops?:LiveStop[];
  yourRef:string;
  customerRef?:string;
  items?:number;
  weight?:number;
  onUndo?:()=>void;
};

type TimelineEvent={
  key:string;
  at?:string;
  title:string;
  details?:Array<string>;
  parentStatus?:string;
  undoable?:boolean;
};

const parentLabels:Record<string,string>={
  awarded:'Awarded',
  allocated:'Allocated',
  accepted:'Accepted',
  on_my_way:'On My Way to Pickup',
  en_route:'On My Way to Pickup',
  on_site_pickup:'On Site (Pickup)',
  arrived_pickup:'On Site (Pickup)',
  loaded:'Loaded',
  in_transit:'On My Way to Final Delivery',
  on_my_way_to_delivery:'On My Way to Final Delivery',
  on_site_delivery:'On Site (Final Delivery)',
  arrived_delivery:'On Site (Final Delivery)',
  delivered:'Delivered / POD',
  completed:'Completed',
  cancelled:'Cancelled',
};
const localMap:Record<string,string>={
  ALLOCATED:'Accepted',
  ON_WAY_TO_PICKUP:'On My Way to Pickup',
  ON_SITE_PICKUP:'On Site (Pickup)',
  LOADED:'Loaded',
  ON_WAY_TO_DELIVERY:'On My Way to Final Delivery',
  ON_SITE_DELIVERY:'On Site (Final Delivery)',
  POD_SUBMITTED:'POD Submitted',
  DELIVERED:'Delivered / POD',
};
const dateMs=(value?:string)=>{const ms=value?new Date(value).getTime():0;return Number.isFinite(ms)?ms:0};
const fmt=(value?:string)=>{
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
};
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const str=(value:unknown)=>typeof value==='string'?value:'';

export default function BookingTimeline({live,statusHistory=[],localHistory=[],routeStops=[],yourRef,customerRef,items,weight,onUndo}:Props){
  const events:TimelineEvent[]=[];
  const parent=live
    ? statusHistory.map((entry,index)=>({
        key:'parent-'+index+'-'+entry.status,
        at:entry.timestamp,
        title:parentLabels[entry.status.toLowerCase()]||entry.status.replaceAll('_',' '),
        parentStatus:entry.status.toLowerCase(),
        undoable:true,
      }))
    : localHistory.map((entry,index)=>({
        key:'local-'+index+'-'+entry.status,
        at:entry.at,
        title:localMap[entry.status]||entry.status.replaceAll('_',' '),
        parentStatus:entry.status,
        undoable:true,
      }));

  for(const event of parent){
    if(event.parentStatus==='loaded'||event.parentStatus==='LOADED'){
      event.details=[
        'Your Ref: '+yourRef,
        'Customer Ref: '+(customerRef||'Not provided'),
        'Items: '+(items??'Not provided'),
        ...(weight?['Weight: '+weight+' kg']:[]),
      ];
    }
    events.push(event);
  }

  const final=routeStops.at(-1);
  const dynamicEnd=final?.handover?.stopKind==='return'||final?.handover?.stopKind==='redirect';
  const executionStops=routeStops.length>2
    ? routeStops.slice(1,dynamicEnd?undefined:-1)
    : dynamicEnd?routeStops.slice(1):[];

  executionStops.forEach((stop,index)=>{
    const handover=stop.handover;
    const kind=handover?.stopKind==='return'?'Return':handover?.stopKind==='redirect'?'Redirect':stop.type==='delivery'?'Delivery':'Collection';
    const label=handover?.stopKind?kind:`${kind} Stop ${index+1}`;
    if(stop.enRouteAt)events.push({key:stop.id+'-enroute',at:stop.enRouteAt,title:`On My Way to ${label}`});
    if(stop.arrivedAt)events.push({key:stop.id+'-arrived',at:stop.arrivedAt,title:`On Site – ${label}`});

    const exception=obj(handover?.exception);
    const exceptionAt=str(exception.reportedAt);
    if(exceptionAt)events.push({
      key:stop.id+'-exception',at:exceptionAt,
      title:`${label} – ${str(exception.outcome)||'Delivery Exception'}`,
      details:[str(exception.notes)].filter(Boolean),
    });

    const returnInstruction=obj(handover?.returnInstruction);
    const returnAt=str(returnInstruction.reportedAt);
    if(returnAt)events.push({
      key:stop.id+'-return-required',at:returnAt,title:'Return Required / Awaiting Instructions',
      details:[
        str(returnInstruction.reason),
        str(returnInstruction.goodsDisposition)?'Goods disposition: '+str(returnInstruction.goodsDisposition).replaceAll('_',' '):'',
      ].filter(Boolean),
    });

    if(stop.cancelledAt){
      const cancellation=obj(handover?.cancellation);
      events.push({
        key:stop.id+'-cancelled',at:stop.cancelledAt,title:`${label} Cancelled on Instruction`,
        details:[
          str(cancellation.cancelledByRole)?'Cancelled by: '+str(cancellation.cancelledByRole).replaceAll('_',' '):'',
          str(cancellation.cancelledByName)?'Contact: '+str(cancellation.cancelledByName):'',
          str(cancellation.reason)?'Reason: '+str(cancellation.reason):'',
          str(cancellation.goodsDisposition)&&str(cancellation.goodsDisposition)!=='none'?'Goods disposition: '+str(cancellation.goodsDisposition).replaceAll('_',' '):'',
        ].filter(Boolean),
      });
    }
    if(stop.completedAt){
      events.push({
        key:stop.id+'-completed',at:stop.completedAt,title:handover?.stopKind==='return'?'Proof of Return / Return Completed':`${label} Completed`,
        details:[
          handover?.recipientName?'Received By: '+handover.recipientName:'',
          handover?.leftAt?'Left At: '+handover.leftAt:'',
          handover?.deliveredOn?'Delivered On: '+fmt(handover.deliveredOn):'',
          handover?.deliveryStatus?'Delivery Status: '+handover.deliveryStatus:'',
          handover?.itemCount!=null?'Items: '+handover.itemCount:'',
          handover?.weightKg!=null?'Weight: '+handover.weightKg+' kg':'',
          handover?.notes?"Driver's Notes: "+handover.notes:'',
          ...(handover?.photoPaths?.map(path=>'Photo: '+path.split('/').pop())||[]),
          ...(handover?.documentPaths?.map(path=>'Document: '+path.split('/').pop())||[]),
          handover?.signaturePath?'Recipient signature recorded':'',
          handover?.canonicalFinalPod?'Canonical final POD linked':'',
        ].filter(Boolean) as string[],
      });
    }
  });

  const unique=new Map<string,TimelineEvent>();
  events.forEach(event=>{
    const identity=`${event.title}|${event.at||''}`;
    if(!unique.has(identity))unique.set(identity,event);
  });
  const sorted=[...unique.values()].sort((a,b)=>dateMs(b.at)-dateMs(a.at));
  const newestUndoable=sorted.find(event=>event.undoable&&event.parentStatus&&!['accepted','allocated','delivered','completed','cancelled','ALLOCATED','DELIVERED'].includes(event.parentStatus));

  return <section className="booking-timeline" aria-label="Booking Status History">
    <h2>Booking Status History</h2>
    {sorted.length===0&&<p className="notification-reason">No server timeline events have been recorded yet.</p>}
    {sorted.map(event=><div key={event.key} className="timeline-step done">
      <span className="timeline-dot">&#10003;</span>
      <div className="timeline-copy">
        <strong>{event.title}</strong>
        {event.at&&<small>at {fmt(event.at)}</small>}
        {event.details?.length?<div className="timeline-loaded-details">{event.details.map((detail,index)=><div key={index}>{detail}</div>)}</div>:null}
      </div>
      {onUndo&&newestUndoable?.key===event.key&&<button className="timeline-undo" type="button" onClick={onUndo}>Undo</button>}
    </div>)}
  </section>;
}
