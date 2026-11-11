'use client';

import {PrimaryAction, WorkflowCard, WorkflowFrame} from './WorkflowFrame';
import styles from './InvoiceDraftStep.module.css';

type Props={
 bookingReference?:string|null;routeLabel:string;invoiceNumber?:string|null;
 clientName?:string|null;issuerName?:string|null;totalAmount?:string|null;
 invoiceDate?:string|null;dueDate?:string|null;paymentTerms?:string|null;
 invoiceStatus:string;paymentStatus?:string|null;
 working?:boolean;error?:string;message?:string;
 onBack:()=>void;onPreview:()=>void;onReviewAndSend:()=>void;
};

export default function InvoiceIssuedStep(p:Props){
 const rows=[
  ['Invoice number',p.invoiceNumber],['Invoice to',p.clientName],
  ['Invoice from',p.issuerName],['Total',p.totalAmount],
  ['Invoice date',p.invoiceDate],['Due date',p.dueDate],
  ['Payment terms',p.paymentTerms],['Invoice status',p.invoiceStatus],
  ['Payment status',p.paymentStatus],
 ].filter((row):row is [string,string]=>Boolean(row[1]));
 return <WorkflowFrame title="Invoice Issued" bookingReference={p.bookingReference}
  routeLabel={p.routeLabel} badge={p.invoiceStatus} error={p.error}
  message={p.message} onBack={p.onBack} compact>
  <WorkflowCard title="Issued Invoice">
   <dl className={styles.details}>{rows.map(([label,value])=>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </WorkflowCard>
  <WorkflowCard>
   <div className={styles.secondary}><button type="button" disabled={p.working} onClick={p.onPreview}>Preview PDF</button></div>
   <PrimaryAction disabled={p.working} onClick={p.onReviewAndSend}>Review &amp; Send Invoice</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
