'use client';

import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './InvoiceDraftStep.module.css';

type Props={
 bookingReference?:string|null;routeLabel:string;invoiceNumber?:string|null;
 clientName?:string|null;customerXdId?:string|null;issuerName?:string|null;issuerXdId?:string|null;jobRef?:string|null;
 netAmount?:string|null;vatRate?:number|null;vatAmount?:string|null;totalAmount?:string|null;paymentTerms?:string|null;
 invoiceDate?:string|null;dueDate?:string|null;serviceDescription?:string|null;
 working?:boolean;error?:string;message?:string;onBack:()=>void;onPreview:()=>void;onEdit:()=>void;onReview:()=>void;
};

export default function InvoiceDraftStep(props:Props){
 const {bookingReference,routeLabel,invoiceNumber,clientName,customerXdId,issuerName,issuerXdId,jobRef,netAmount,vatRate,vatAmount,totalAmount,paymentTerms,invoiceDate,dueDate,serviceDescription,working=false,error,message,onBack,onPreview,onEdit,onReview}=props;
 const rows=[
  clientName?['Invoice to',[clientName,customerXdId].filter(Boolean).join(' · ')]:null,
  issuerName?['Invoice from',[issuerName,issuerXdId].filter(Boolean).join(' · ')]:null,
  invoiceNumber?['Invoice No.',invoiceNumber]:null,
  jobRef?['Job reference',jobRef]:null,
  netAmount?['Net amount',netAmount]:null,
  vatAmount?['VAT',vatRate!=null?`${vatRate}% (${vatAmount})`:vatAmount]:null,
  totalAmount?['Total',totalAmount]:null,
  paymentTerms?['Payment terms',paymentTerms]:null,
  invoiceDate?['Invoice date',invoiceDate]:null,
  dueDate?['Due date',dueDate]:null,
 ].filter((row):row is [string,string]=>Boolean(row));
 return <WorkflowFrame title="Invoice Draft" bookingReference={bookingReference} routeLabel={routeLabel} badge="Draft" error={error} message={message} onBack={onBack} compact>
  <WorkflowCard title="Invoice Details">
   <dl className={styles.details}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </WorkflowCard>
  {serviceDescription&&<WorkflowCard title="Service / Notes"><p className={styles.notes}>{serviceDescription}</p></WorkflowCard>}
  <WorkflowCard>
   <div className={styles.secondary}><button type="button" disabled={working} onClick={onPreview}>Preview PDF</button><button type="button" disabled={working} onClick={onEdit}>Edit Draft</button></div>
   <PrimaryAction disabled={working} onClick={onReview}>{working?'Loading…':'Review Invoice'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
