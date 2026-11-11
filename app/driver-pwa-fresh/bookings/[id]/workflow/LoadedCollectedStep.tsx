'use client';

import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './LoadedCollectedStep.module.css';

type Row={label:string;value:string};
type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 confirmedAt?:string|null;driverName?:string|null;collectedRows:Row[];
 photoCount:number;documentCount:number;notes?:string|null;
 nextStopAddress?:string;nextStopSchedule?:string;nextStopContact?:string;nextStopPhone?:string;
 working?:boolean;error?:string;message?:string;onBack:()=>void;onNext:()=>void;
};

export default function LoadedCollectedStep({
 bookingReference,routeLabel,agreedRate,paymentTerms,confirmedAt,driverName,collectedRows,
 photoCount,documentCount,notes,nextStopAddress,nextStopSchedule,nextStopContact,nextStopPhone,working=false,error,message,onBack,onNext,
}:Props){
 void photoCount;void documentCount;
 return <WorkflowFrame title="Loaded" bookingReference={bookingReference} routeLabel={routeLabel} badge="Collected" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <section className={styles.confirmed} aria-label="Collection confirmed">
   <span className={styles.check} aria-hidden="true">✓</span>
   <div><strong>Collection confirmed</strong>{confirmedAt&&<span>{confirmedAt}</span>}{driverName&&<span>By: {driverName}</span>}</div>
  </section>

  {collectedRows.length>0&&<WorkflowCard title="Collected Items">
   <dl className={styles.rows}>{collectedRows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}<span aria-label="Confirmed">✓</span></dd></div>)}</dl>
  </WorkflowCard>}

  <WorkflowCard title="Next Stop — Delivery">
   <div style={{display:'grid',gap:7,fontSize:14}}>
    <strong>{nextStopAddress || 'Delivery address available in Booking Details'}</strong>
    {nextStopSchedule&&<span>{nextStopSchedule}</span>}
    {nextStopContact&&<span>Contact: {nextStopContact}</span>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     {nextStopPhone&&<a href={'tel:'+nextStopPhone.replace(/\\s+/g,'')} style={{padding:'9px 12px',background:'#eef6ff',borderRadius:7,color:'#0b2f6b'}}>Call</a>}
    </div>
   </div>
  </WorkflowCard>

  <WorkflowCard title={notes?'Notes':undefined}>
   {notes&&<p className={styles.notes}>{notes}</p>}
   <PrimaryAction disabled={working} onClick={onNext}>{working?'Saving…':'On My Way to Delivery'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
