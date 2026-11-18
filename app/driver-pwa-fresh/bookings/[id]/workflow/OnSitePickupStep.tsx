'use client';

import type { ChangeEvent } from 'react';
import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './OnSitePickupStep.module.css';

type CargoRow={label:string;value:string};
type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 cargoRows:CargoRow[];collectionPhotoCount:number;collectionDocumentCount:number;
 actualItems:string;condition:string;discrepancy:string;notes:string;
 working?:boolean;error?:string;message?:string;onBack:()=>void;
 onActualItems:(value:string)=>void;onCondition:(value:string)=>void;onDiscrepancy:(value:string)=>void;onNotes:(value:string)=>void;
 onPhotos:(event:ChangeEvent<HTMLInputElement>)=>void;onDocuments:(event:ChangeEvent<HTMLInputElement>)=>void;onConfirmLoaded:()=>void;
};

export default function OnSitePickupStep(props:Props){
 const {bookingReference,routeLabel,agreedRate,paymentTerms,cargoRows,collectionPhotoCount,collectionDocumentCount,actualItems,condition,discrepancy,notes,working=false,error,message,onBack,onActualItems,onCondition,onDiscrepancy,onNotes,onPhotos,onDocuments,onConfirmLoaded}=props;
 const declaredItems=cargoRows.find(row=>row.label==='Items')?.value ?? '';
 const hasDifference=condition!=='Good'||Boolean(discrepancy.trim())||(Boolean(actualItems.trim())&&Boolean(declaredItems)&&actualItems.trim()!==declaredItems.trim());
 return <WorkflowFrame title="On Site at Pickup" bookingReference={bookingReference} routeLabel={routeLabel} badge="At pickup" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  {cargoRows.length>0&&<WorkflowCard title="Cargo Details">
   <dl className={styles.cargo}>{cargoRows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
   <div className={styles.differenceFields}>
    <label>Items actually collected (required)<input required type="number" min="0" step="1" inputMode="numeric" value={actualItems} onChange={e=>onActualItems(e.target.value)} placeholder={declaredItems||'Enter actual count'}/></label>
   </div>
   <details className={styles.difference} open={hasDifference}>
    <summary>Report a collection difference</summary>
    <div className={styles.differenceFields}>
     <label>Cargo condition<select value={condition} onChange={e=>onCondition(e.target.value)}><option>Good</option><option>Damaged</option><option>Incomplete</option><option>Not ready</option></select></label>
     <label className={styles.full}>Difference / issue<textarea value={discrepancy} onChange={e=>onDiscrepancy(e.target.value)} placeholder="Record shortages, damage or loading issues"/></label>
    </div>
   </details>
  </WorkflowCard>}
  <WorkflowCard title="Collection Evidence (optional)">
   <p className={styles.helper}>Add evidence only when useful or requested by the posting company.</p>
   <div className={styles.evidenceActions}>
    <label className={styles.upload}><span>Camera / Photos</span><small>{collectionPhotoCount}/10</small><input type="file" accept="image/jpeg,image/png" capture="environment" multiple disabled={working||collectionPhotoCount>=10} onChange={onPhotos}/></label>
    <label className={styles.upload}><span>Add Document</span><small>{collectionDocumentCount}/10</small><input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={working||collectionDocumentCount>=10} onChange={onDocuments}/></label>
   </div>
   <label className={styles.notes}>Notes<textarea value={notes} onChange={e=>onNotes(e.target.value)} placeholder="Collection notes"/></label>
   <PrimaryAction disabled={working} onClick={onConfirmLoaded}>{working?'Saving…':'Confirm Loaded'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
