'use client';

import type { ReactNode } from 'react';
import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import InTransitRouteMap from './InTransitRouteMap';
import styles from './InTransitDeliveryStep.module.css';

type RouteMetrics={distanceMiles:number;durationMinutes:number;recordedAt:string|null;origin:{lat:number;lng:number};destination:{lat:number;lng:number};geometry?:Array<{lat:number;lng:number}>|null};
type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 map:ReactNode;routeMetrics?:RouteMetrics|null;routeLoading?:boolean;
 address:string;schedule:string;contactName?:string|null;phone?:string|null;instructions?:string|null;navigateHref?:string|null;
 working?:boolean;error?:string;message?:string;onBack:()=>void;onNext:()=>void;
};

export default function InTransitDeliveryStep({
 bookingReference,routeLabel,agreedRate,paymentTerms,map,routeMetrics,routeLoading=false,address,schedule,contactName,phone,instructions,
 working=false,error,message,onBack,onNext,
}:Props){
 return <WorkflowFrame title="On My Way to Delivery" bookingReference={bookingReference} routeLabel={routeLabel} badge="In transit" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <WorkflowCard>
   <div className={styles.map}>{routeMetrics?<InTransitRouteMap origin={routeMetrics.origin} destination={routeMetrics.destination} geometry={routeMetrics.geometry??null}/>:map}</div>
   <div className={styles.routeStatus}>
    {routeMetrics?<strong>{routeMetrics.durationMinutes} min <span>({routeMetrics.distanceMiles.toFixed(1)} mi)</span> to delivery</strong>:routeLoading?<span>Updating live route…</span>:<span>Live road estimate unavailable. Use Navigate for directions.</span>}

   </div>
   <p className={styles.mapNote}>{routeMetrics?.geometry?.length?'Map shows the latest driver GPS position and the calculated driving route to delivery.':routeMetrics?'Map shows the latest driver GPS position and delivery point. Route geometry is unavailable from the active routing provider.':'Delivery area map only. Live distance and time appear when a recent driver GPS point is available.'}</p>
  </WorkflowCard>

  <WorkflowCard title="Next Stop — Delivery">
   <div className={styles.delivery}>
    <strong>{address}</strong>
    {contactName&&<span>{contactName}</span>}
    {phone&&<a href={'tel:'+phone.replace(/\s+/g,'')}>{phone}</a>}
    <span>{schedule}</span>
    <div className="xdrive-navigation-choices" style={{display:'grid',gap:9,marginTop:12}}>
     <strong>Choose navigation app</strong>
     <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
      <a href={'https://waze.com/ul?q='+encodeURIComponent(address)+'&navigate=yes'} target="_blank" rel="noopener noreferrer" style={{textAlign:'center',padding:'12px 3px',border:'1px solid #bed3ea',borderRadius:8,background:'#eef6ff',fontSize:13,fontWeight:700}}>Waze</a>
      <a href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(address)+'&travelmode=driving'} target="_blank" rel="noopener noreferrer" style={{textAlign:'center',padding:'12px 3px',border:'1px solid #bed3ea',borderRadius:8,background:'#eef6ff',fontSize:13,fontWeight:700}}>Google Maps</a>
      <a href={'https://maps.apple.com/?daddr='+encodeURIComponent(address)+'&dirflg=d'} target="_blank" rel="noopener noreferrer" style={{textAlign:'center',padding:'12px 3px',border:'1px solid #bed3ea',borderRadius:8,background:'#eef6ff',fontSize:13,fontWeight:700}}>Apple Maps</a>
     </div>
    </div>
   </div>
  </WorkflowCard>

  {instructions&&<WorkflowCard title="Instructions"><p className={styles.instructions}>{instructions}</p></WorkflowCard>}

  <WorkflowCard>
   <PrimaryAction disabled={working} onClick={onNext}>{working?'Saving…':'On Site at Delivery'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
