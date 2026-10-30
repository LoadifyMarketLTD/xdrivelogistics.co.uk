'use client';

import type { ReactNode } from 'react';
import { PrimaryAction, SecondaryLink, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
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
 bookingReference,routeLabel,agreedRate,paymentTerms,map,routeMetrics,routeLoading=false,address,schedule,contactName,phone,instructions,navigateHref,
 working=false,error,message,onBack,onNext,
}:Props){
 return <WorkflowFrame title="On My Way to Delivery" bookingReference={bookingReference} routeLabel={routeLabel} badge="In transit" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <WorkflowCard>
   <div className={styles.map}>{routeMetrics?<InTransitRouteMap origin={routeMetrics.origin} destination={routeMetrics.destination} geometry={routeMetrics.geometry??null}/>:map}</div>
   <div className={styles.routeStatus}>
    {routeMetrics?<strong>{routeMetrics.durationMinutes} min <span>({routeMetrics.distanceMiles.toFixed(1)} mi)</span> to delivery</strong>:routeLoading?<span>Updating live route…</span>:<span>Live road estimate unavailable. Use Navigate for directions.</span>}
    {navigateHref&&<SecondaryLink href={navigateHref}>Navigate</SecondaryLink>}
   </div>
   <p className={styles.mapNote}>{routeMetrics?.geometry?.length?'Map shows the latest driver GPS position and the calculated driving route to delivery.':routeMetrics?'Map shows the latest driver GPS position and delivery point. Route geometry is unavailable from the active routing provider.':'Delivery area map only. Live distance and time appear when a recent driver GPS point is available.'}</p>
  </WorkflowCard>

  <WorkflowCard title="Delivery Details">
   <div className={styles.delivery}>
    <strong>{address}</strong>
    {contactName&&<span>{contactName}</span>}
    {phone&&<a href={'tel:'+phone.replace(/\s+/g,'')}>{phone}</a>}
    <span>{schedule}</span>
   </div>
  </WorkflowCard>

  {instructions&&<WorkflowCard title="Instructions"><p className={styles.instructions}>{instructions}</p></WorkflowCard>}

  <WorkflowCard>
   <PrimaryAction disabled={working} onClick={onNext}>{working?'Saving…':'On Site at Delivery'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
