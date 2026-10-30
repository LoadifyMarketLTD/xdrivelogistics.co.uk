'use client';

import type { ReactNode } from 'react';
import { PrimaryAction, SecondaryLink, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './OnMyWayToPickupStep.module.css';

type Props={
  bookingReference?:string|null; routeLabel:string; agreedRate?:string|null; paymentTerms?:string|null;
  map:ReactNode; address:string; schedule:string; contactName?:string|null; phone?:string|null; instructions?:string|null; navigateHref?:string|null;
  working?:boolean; error?:string; message?:string; onBack:()=>void; onNext:()=>void;
};

export default function OnMyWayToPickupStep(props:Props){
  const {bookingReference,routeLabel,agreedRate,paymentTerms,map,address,schedule,contactName,phone,instructions,navigateHref,working=false,error,message,onBack,onNext}=props;
  return <WorkflowFrame title="On My Way to Pickup" bookingReference={bookingReference} routeLabel={routeLabel} badge="On the way" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack}>
    <WorkflowCard className={styles.mapCard}>
      <div className={styles.map}>{map}</div>
      <div className={styles.mapActions}>{navigateHref&&<SecondaryLink href={navigateHref}>Navigate</SecondaryLink>}</div>
    </WorkflowCard>
    <WorkflowCard title="Collection Details" className={styles.details}>
      <div className={styles.locationRow}><span className={styles.pin} aria-hidden="true"/><div><strong>{address}</strong><span>{schedule}</span></div></div>
      {contactName&&<div className={styles.contactRow}><div><span>Contact</span><strong>{contactName}</strong></div>{phone&&<a href={'tel:'+phone.replace(/\s+/g,'')}>Call</a>}</div>}
      {instructions&&<div className={styles.instructions}><span>Instructions</span><p>{instructions}</p></div>}
      <PrimaryAction disabled={working} onClick={onNext}>{working?'Saving…':'On Site at Pickup'}</PrimaryAction>
    </WorkflowCard>
  </WorkflowFrame>;
}
