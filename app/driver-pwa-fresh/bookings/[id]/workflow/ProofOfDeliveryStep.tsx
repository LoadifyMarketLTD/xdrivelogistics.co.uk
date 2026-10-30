'use client';

import type { ChangeEvent, MouseEventHandler, RefObject, TouchEventHandler } from 'react';
import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './ProofOfDeliveryStep.module.css';

type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 deliveryConfirmed:boolean;deliveryStatus:string;itemCount:string;weight:string;
 photoPaths:string[];photoUrls:string[];documentPaths:string[];
 recipientName:string;leftAt:string;deliveredOn:string;notes:string;
 signatureRef:RefObject<HTMLCanvasElement|null>;signatureReady:boolean;
 hardCopyRequired:boolean;hardCopyAcknowledged:boolean;
 draftLoaded:boolean;draftSaving:boolean;draftError?:string;working?:boolean;error?:string;message?:string;
 onBack:()=>void;onDeliveryStatus:(value:string)=>void;onItemCount:(value:string)=>void;onWeight:(value:string)=>void;
 onRecipientName:(value:string)=>void;onLeftAt:(value:string)=>void;onDeliveredOn:(value:string)=>void;onNotes:(value:string)=>void;
 onPhotos:(event:ChangeEvent<HTMLInputElement>)=>void;onDocuments:(event:ChangeEvent<HTMLInputElement>)=>void;
 onSignatureStart:MouseEventHandler<HTMLCanvasElement>|TouchEventHandler<HTMLCanvasElement>;
 onSignatureMove:MouseEventHandler<HTMLCanvasElement>|TouchEventHandler<HTMLCanvasElement>;
 onSignatureEnd:()=>void;onSaveSignature:()=>void;onClearSignature:()=>void;
 onHardCopyAcknowledged:(value:boolean)=>void;onSaveDraft:()=>void;onSubmit:()=>void;
};

const leftAtOptions=['Goods Inwards','Reception','Recipient','Warehouse','Loading Bay','Delivery Office','Authorised Safe Place'];

export default function ProofOfDeliveryStep(props:Props){
 const {bookingReference,routeLabel,agreedRate,paymentTerms,deliveryConfirmed,deliveryStatus,itemCount,weight,photoPaths,photoUrls,documentPaths,recipientName,leftAt,deliveredOn,notes,signatureRef,signatureReady,hardCopyRequired,hardCopyAcknowledged,draftLoaded,draftSaving,draftError,working=false,error,message,onBack,onDeliveryStatus,onItemCount,onWeight,onRecipientName,onLeftAt,onDeliveredOn,onNotes,onPhotos,onDocuments,onSignatureStart,onSignatureMove,onSignatureEnd,onSaveSignature,onClearSignature,onHardCopyAcknowledged,onSaveDraft,onSubmit}=props;
 const validItems=Number.isInteger(Number(itemCount))&&Number(itemCount)>=1;
 const canSubmit=deliveryConfirmed&&deliveryStatus==='Completed Delivery'&&validItems&&photoPaths.length>0&&recipientName.trim().length>0&&leftAt.trim().length>0&&Boolean(deliveredOn)&&signatureReady&&(!hardCopyRequired||hardCopyAcknowledged)&&draftLoaded&&!draftSaving&&!working;
 return <WorkflowFrame title="Proof of Delivery" bookingReference={bookingReference} routeLabel={routeLabel} badge="Delivered" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <WorkflowCard title="1. Delivery Information">
   <div className={styles.deliveryInfo}>
    <label><span>Delivery status</span><select value={deliveryStatus} onChange={e=>onDeliveryStatus(e.target.value)}><option>Completed Delivery</option><option>Partial Delivery</option><option>Failed Delivery</option><option>Refused</option><option>Left Safe</option></select></label>
    <label><span>Number of items</span><input type="number" min="1" step="1" inputMode="numeric" value={itemCount} onChange={e=>onItemCount(e.target.value)}/></label>
    <label><span>Weight (kg)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={weight} onChange={e=>onWeight(e.target.value)}/></label>
   </div>
  </WorkflowCard>

  <WorkflowCard title="2. Delivery Evidence">
   <div className={styles.gallery}>
    {photoPaths.slice(0,3).map((path,index)=><div className={styles.photo} key={path}>{photoUrls[index]?<img src={photoUrls[index]} alt={'Delivery evidence '+(index+1)}/>:<span>Photo {index+1}</span>}{index===2&&photoPaths.length>3&&<b>+{photoPaths.length-2}</b>}</div>)}
    {photoPaths.length<10&&<label className={styles.add}><span>＋</span><small>Add photo</small><input type="file" accept="image/jpeg,image/png" capture="environment" multiple disabled={working} onChange={onPhotos}/></label>}
   </div>
   <p className={styles.evidenceMeta}>{photoPaths.length} of 10 delivery photographs saved.</p>
   <div className={styles.documentRow}><span>{documentPaths.length} POD document{documentPaths.length===1?'':'s'} attached</span>{documentPaths.length<10&&<label>Add document<input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={working} onChange={onDocuments}/></label>}</div>
  </WorkflowCard>

  <WorkflowCard title="3. Recipient & Signature">
   <div className={styles.recipient}>
    <label><span>Received By (Full Name)</span><input value={recipientName} maxLength={200} onChange={e=>onRecipientName(e.target.value)} placeholder="Recipient full name"/></label>
    <div className={styles.leftAt}><span>Left At</span><div>{leftAtOptions.map(option=><button key={option} type="button" aria-pressed={leftAt===option} onClick={()=>onLeftAt(option)}>{option}</button>)}</div></div>
    <label><span>Signature</span><canvas ref={signatureRef} width={600} height={200} onMouseDown={onSignatureStart as MouseEventHandler<HTMLCanvasElement>} onMouseMove={onSignatureMove as MouseEventHandler<HTMLCanvasElement>} onMouseUp={onSignatureEnd} onMouseLeave={onSignatureEnd} onTouchStart={onSignatureStart as TouchEventHandler<HTMLCanvasElement>} onTouchMove={onSignatureMove as TouchEventHandler<HTMLCanvasElement>} onTouchEnd={onSignatureEnd}/></label>
    <div className={styles.signatureActions}><button type="button" onClick={onSaveSignature}>Save Signature</button><button type="button" onClick={onClearSignature}>Clear</button><span>{signatureReady?'Signature captured':'Signature required'}</span></div>
   </div>
  </WorkflowCard>

  <WorkflowCard title="4. Final Confirmation">
   <div className={styles.final}>
    <label><span>Delivery date</span><input type="date" value={deliveredOn} onChange={e=>onDeliveredOn(e.target.value)}/></label>
    <label><span>Driver's Notes</span><textarea maxLength={500} value={notes} onChange={e=>onNotes(e.target.value)} placeholder="Final delivery notes"/><small>{notes.length}/500</small></label>
    {hardCopyRequired&&<label className={styles.hardCopy}><input type="checkbox" checked={hardCopyAcknowledged} onChange={e=>onHardCopyAcknowledged(e.target.checked)}/><span>Hard-copy POD requirement acknowledged</span></label>}
    {!deliveryConfirmed&&<p className={styles.warning}>Confirm delivery in the booking workflow before sending POD.</p>}
    {deliveryStatus!=='Completed Delivery'&&<p className={styles.warning}>This delivery has an unresolved exception. Save the draft and resolve it before final submission.</p>}
    <p className={styles.draftState} role="status">{draftError?'Draft not saved: '+draftError:draftSaving?'Saving POD draft…':draftLoaded?'POD draft connected to XDrive':'Loading saved POD draft…'}</p>
    <div className={styles.actions}><button type="button" disabled={working||draftSaving||!draftLoaded} onClick={onSaveDraft}>Save POD Draft</button><PrimaryAction disabled={!canSubmit} onClick={onSubmit}>{working?'Sending…':'Send & Complete POD'}</PrimaryAction></div>
   </div>
  </WorkflowCard>
 </WorkflowFrame>;
}
