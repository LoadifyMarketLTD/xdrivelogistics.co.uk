'use client';

import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './LoadedCollectedStep.module.css';

type Row={label:string;value:string};
type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 confirmedAt?:string|null;driverName?:string|null;collectedRows:Row[];
 photoCount:number;documentCount:number;notes?:string|null;
 working?:boolean;error?:string;message?:string;onBack:()=>void;onNext:()=>void;
};

export default function LoadedCollectedStep({
 bookingReference,routeLabel,agreedRate,paymentTerms,confirmedAt,driverName,collectedRows,
 photoCount,documentCount,notes,working=false,error,message,onBack,onNext,
}:Props){
 const hasEvidence=photoCount>0||documentCount>0;
 const visibleTiles=Math.min(photoCount,3);
 const evidenceLabel=photoCount+' collection photo'+(photoCount===1?'':'s')+' recorded';
 return <WorkflowFrame title="Loaded" bookingReference={bookingReference} routeLabel={routeLabel} badge="Collected" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <section className={styles.confirmed} aria-label="Collection confirmed">
   <span className={styles.check} aria-hidden="true">✓</span>
   <div><strong>Collection confirmed</strong>{confirmedAt&&<span>{confirmedAt}</span>}{driverName&&<span>By: {driverName}</span>}</div>
  </section>

  {collectedRows.length>0&&<WorkflowCard title="Collected Items">
   <dl className={styles.rows}>{collectedRows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}<span aria-label="Confirmed">✓</span></dd></div>)}</dl>
  </WorkflowCard>}

  {hasEvidence&&<WorkflowCard title="Collection Evidence">
   {photoCount>0&&<div className={styles.gallery} aria-label={evidenceLabel}>
    {Array.from({length:visibleTiles},(_,index)=><div className={styles.photoTile} key={index}><span aria-hidden="true">▧</span><small>{index===2&&photoCount>3?'+'+(photoCount-2):'Photo '+(index+1)}</small></div>)}
   </div>}
   {documentCount>0&&<p className={styles.documents}>{documentCount} collection document{documentCount===1?'':'s'} recorded</p>}
  </WorkflowCard>}

  <WorkflowCard title={notes?'Notes':undefined}>
   {notes&&<p className={styles.notes}>{notes}</p>}
   <PrimaryAction disabled={working} onClick={onNext}>{working?'Saving…':'On My Way to Delivery'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
