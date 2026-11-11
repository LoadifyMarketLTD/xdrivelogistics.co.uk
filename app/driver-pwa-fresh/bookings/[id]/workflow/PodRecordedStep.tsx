'use client';

import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './PodRecordedStep.module.css';

type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 generatedAt?:string|null;receiverName?:string|null;leftAt?:string|null;itemCount?:number|null;weight?:string|null;
 photoCount:number;signatureRecorded:boolean;notes?:string|null;
 canCreateInvoice:boolean;working?:boolean;error?:string;message?:string;
 onBack:()=>void;onViewPdf:()=>void;onCreateInvoice:()=>void;
};

export default function PodRecordedStep({
 bookingReference,routeLabel,agreedRate,paymentTerms,generatedAt,receiverName,leftAt,itemCount,weight,photoCount,signatureRecorded,notes,canCreateInvoice,working=false,error,message,onBack,onViewPdf,onCreateInvoice,
}:Props){
 const summary=[
  receiverName?['Received by',receiverName]:null,
  leftAt?['Left at',leftAt]:null,
  itemCount!=null?['Items',String(itemCount)]:null,
  weight?['Weight',weight]:null,
  photoCount>0?['Photos',String(photoCount)]:null,
  signatureRecorded?['Signature','Recorded']:null,
 ].filter((row):row is [string,string]=>Boolean(row));
 return <WorkflowFrame title="POD Recorded" bookingReference={bookingReference} routeLabel={routeLabel} badge="POD completed" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <section className={styles.success} aria-label="POD saved successfully">
   <span className={styles.check} aria-hidden="true">✓</span>
   <div><strong>POD saved successfully</strong>{generatedAt&&<span>{generatedAt}</span>}</div>
  </section>

  <WorkflowCard title="POD Document">
   <div className={styles.document}><div><span className={styles.pdf} aria-hidden="true">PDF</span><strong>Proof of Delivery PDF</strong></div><button type="button" disabled={working} onClick={onViewPdf}>View PDF</button></div>
  </WorkflowCard>

  {summary.length>0&&<WorkflowCard title="Delivery Summary">
   <dl className={styles.summary}>{summary.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </WorkflowCard>}

  {notes&&<WorkflowCard title="Driver's Notes"><p className={styles.notes}>{notes}</p></WorkflowCard>}

  <WorkflowCard>
   {canCreateInvoice?<PrimaryAction disabled={working} onClick={onCreateInvoice}>{working?'Creating…':'Create Invoice'}</PrimaryAction>:<p className={styles.permission}>POD is complete. Invoice creation is managed by the carrier company owner or administrator.</p>}
  </WorkflowCard>
 </WorkflowFrame>;
}
