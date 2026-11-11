'use client';

import {PrimaryAction, WorkflowCard, WorkflowFrame} from './WorkflowFrame';
import styles from './InvoiceDraftStep.module.css';

type Props={
 bookingReference?:string|null;routeLabel:string;invoiceNumber?:string|null;
 clientName?:string|null;totalAmount?:string|null;dueDate?:string|null;
 invoiceStatus:string;paymentStatus?:string|null;paymentTerms?:string|null;
 working?:boolean;error?:string;message?:string;
 onBack:()=>void;onViewInvoice:()=>void;onPreview:()=>void;
};

export default function InvoicePaymentTrackingStep(p:Props){
 const rows=[
  ['Invoice number',p.invoiceNumber],['Invoice to',p.clientName],
  ['Total',p.totalAmount],['Due date',p.dueDate],
  ['Payment terms',p.paymentTerms],['Invoice status',p.invoiceStatus],
  ['Payment status',p.paymentStatus],
 ].filter((row):row is [string,string]=>Boolean(row[1]));
 return <WorkflowFrame title="Invoice Sent / Payment Tracking"
  bookingReference={p.bookingReference} routeLabel={p.routeLabel}
  badge={p.paymentStatus||p.invoiceStatus} error={p.error}
  message={p.message} onBack={p.onBack} compact>
  <WorkflowCard title="Payment Tracking">
   <dl className={styles.details}>{rows.map(([label,value])=>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <p className={styles.notes}>Payment status is shown from the saved invoice record. No payment is simulated.</p>
  </WorkflowCard>
  <WorkflowCard>
   <div className={styles.secondary}><button type="button" disabled={p.working} onClick={p.onPreview}>View Invoice PDF</button></div>
   <PrimaryAction disabled={p.working} onClick={p.onViewInvoice}>View Payment Status</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
