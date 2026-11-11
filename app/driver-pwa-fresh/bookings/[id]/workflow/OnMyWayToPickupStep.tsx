'use client';

import type { ReactNode } from 'react';
import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './OnMyWayToPickupStep.module.css';

type Props={
  bookingReference?:string|null; routeLabel:string; agreedRate?:string|null; paymentTerms?:string|null;
  map:ReactNode; address:string; schedule:string; contactName?:string|null; phone?:string|null; instructions?:string|null; navigateHref?:string|null;
  working?:boolean; error?:string; message?:string; gpsSuggestion?:boolean; onBack:()=>void; onNext:()=>void;
};

export default function OnMyWayToPickupStep(props:Props){
  const {bookingReference,routeLabel,agreedRate,paymentTerms,map,address,schedule,contactName,phone,instructions,working=false,error,message,gpsSuggestion=false,onBack,onNext}=props;
  return <WorkflowFrame title="On My Way to Pickup" bookingReference={bookingReference} routeLabel={routeLabel} badge="On the way" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack}>
    <WorkflowCard className={styles.mapCard}>
      <div className={styles.map}>{map}</div>

    </WorkflowCard>
    <WorkflowCard title="Collection Details" className={styles.details}>
      <div className={styles.locationRow}><span className={styles.pin} aria-hidden="true"/><div><strong>{address}</strong><span>{schedule}</span></div></div>
      <div style={{display:'grid',gap:8,margin:'12px 0'}}>
       <strong style={{fontSize:13,color:'#0b2f6b'}}>Choose navigation app</strong>
       <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
        <a href={'https://waze.com/ul?q='+encodeURIComponent(address)+'&navigate=yes'} target="_blank" rel="noopener noreferrer" style={{textAlign:'center',padding:'12px 3px',border:'1px solid #bed3ea',borderRadius:8,background:'#eef6ff',fontSize:13,fontWeight:700}}>Waze</a>
        <a href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(address)+'&travelmode=driving'} target="_blank" rel="noopener noreferrer" style={{textAlign:'center',padding:'12px 3px',border:'1px solid #bed3ea',borderRadius:8,background:'#eef6ff',fontSize:13,fontWeight:700}}>Google Maps</a>
        <a href={'https://maps.apple.com/?daddr='+encodeURIComponent(address)+'&dirflg=d'} target="_blank" rel="noopener noreferrer" style={{textAlign:'center',padding:'12px 3px',border:'1px solid #bed3ea',borderRadius:8,background:'#eef6ff',fontSize:13,fontWeight:700}}>Apple Maps</a>
       </div>
      </div>
      {contactName&&<div className={styles.contactRow}><div><span>Contact</span><strong>{contactName}</strong></div>{phone&&<a href={'tel:'+phone.replace(/\s+/g,'')}>Call</a>}</div>}
      {instructions&&<div className={styles.instructions}><span>Instructions</span><p>{instructions}</p></div>}
      {gpsSuggestion&&<div role="status" style={{padding:'10px 12px',margin:'12px 0 8px',background:'#eff7ff',border:'1px solid #bed8f5',borderRadius:8,color:'#0b2f6b',fontSize:13}}><strong>GPS arrival suggestion</strong><div>Near collection? Confirm arrival below. You can confirm manually even without GPS.</div></div>}
      <PrimaryAction disabled={working} onClick={onNext}>{working?'Saving…':'On Site at Pickup'}</PrimaryAction>
    </WorkflowCard>
  </WorkflowFrame>;
}
