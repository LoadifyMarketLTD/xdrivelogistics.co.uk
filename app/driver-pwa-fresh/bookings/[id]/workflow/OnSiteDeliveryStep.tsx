'use client';

import type { ChangeEvent } from 'react';
import { PrimaryAction, WorkflowCard, WorkflowFrame } from './WorkflowFrame';
import styles from './OnSiteDeliveryStep.module.css';

type Props={
 bookingReference?:string|null;routeLabel:string;agreedRate?:string|null;paymentTerms?:string|null;
 address:string;schedule:string;contactName?:string|null;phone?:string|null;
 itemCount:string;weight:string;photoPaths:string[];photoUrls:string[];notes:string;
 draftLoaded:boolean;draftSaving:boolean;draftError?:string;
 working?:boolean;error?:string;message?:string;onBack:()=>void;
 onItemCount:(value:string)=>void;onWeight:(value:string)=>void;onNotes:(value:string)=>void;
 onPhotos:(event:ChangeEvent<HTMLInputElement>)=>void;onConfirm:()=>void;
};

const step=(raw:string,delta:number,min:number,decimals=0)=>{
 const n=Number(raw);
 const base=Number.isFinite(n)?n:min;
 const next=Math.max(min,base+delta);
 return decimals?next.toFixed(decimals).replace(/\.0$/,''):String(Math.round(next));
};

export default function OnSiteDeliveryStep(props:Props){
 const {bookingReference,routeLabel,agreedRate,paymentTerms,address,schedule,contactName,phone,itemCount,weight,photoPaths,photoUrls,notes,draftLoaded,draftSaving,draftError,working=false,error,message,onBack,onItemCount,onWeight,onNotes,onPhotos,onConfirm}=props;
 const canConfirm=photoPaths.length>0&&Number.isInteger(Number(itemCount))&&Number(itemCount)>=1&&(!weight.trim()||(Number.isFinite(Number(weight))&&Number(weight)>=0))&&draftLoaded&&!draftSaving;
 return <WorkflowFrame title="On Site at Delivery" bookingReference={bookingReference} routeLabel={routeLabel} badge="At delivery" agreedRate={agreedRate} paymentTerms={paymentTerms} error={error} message={message} onBack={onBack} compact>
  <WorkflowCard title="Delivery Details">
   <div className={styles.delivery}>
    <span className={styles.pin} aria-hidden="true"/>
    <div><strong>{address}</strong>{contactName&&<span>{contactName}</span>}{phone&&<a href={'tel:'+phone.replace(/\s+/g,'')}>{phone}</a>}<span>{schedule}</span></div>
   </div>
  </WorkflowCard>

  <WorkflowCard title="Items to Deliver">
   <div className={styles.steppers}>
    <label><span>Items</span><div><button type="button" onClick={()=>onItemCount(step(itemCount,-1,1))} aria-label="Decrease items">−</button><input type="number" min="1" step="1" inputMode="numeric" value={itemCount} onChange={e=>onItemCount(e.target.value)}/><button type="button" onClick={()=>onItemCount(step(itemCount,1,1))} aria-label="Increase items">+</button></div></label>
    <label><span>Weight (kg)</span><div><button type="button" onClick={()=>onWeight(step(weight,-1,0,1))} aria-label="Decrease weight">−</button><input type="number" min="0" step="0.1" inputMode="decimal" value={weight} onChange={e=>onWeight(e.target.value)}/><button type="button" onClick={()=>onWeight(step(weight,1,0,1))} aria-label="Increase weight">+</button></div></label>
   </div>
  </WorkflowCard>

  <WorkflowCard title="Delivery Photos">
   <div className={styles.gallery}>
    {photoPaths.slice(0,3).map((path,index)=><div className={styles.photo} key={path}>{photoUrls[index]?<img src={photoUrls[index]} alt={'Delivery evidence '+(index+1)}/>:<span>Photo {index+1}</span>}{index===2&&photoPaths.length>3&&<b>+{photoPaths.length-2}</b>}</div>)}
    {photoPaths.length<10&&<label className={styles.addPhoto}><span>＋</span><small>Add photo</small><input type="file" accept="image/jpeg,image/png" capture="environment" multiple disabled={working} onChange={onPhotos}/></label>}
   </div>
   <p className={styles.photoHint}>{photoPaths.length}/10 saved delivery photo{photoPaths.length===1?'':'s'}. At least one is required before confirming delivery.</p>
  </WorkflowCard>

  <WorkflowCard title="Notes">
   <label className={styles.notes}><textarea maxLength={500} value={notes} onChange={e=>onNotes(e.target.value)} placeholder="Delivery notes"/><small>{notes.length}/500</small></label>
   <div className={styles.draftState} role="status">{draftError?'Draft not saved: '+draftError:draftSaving?'Saving delivery draft…':draftLoaded?'Delivery draft connected to XDrive':'Loading delivery draft…'}</div>
   <PrimaryAction disabled={working||!canConfirm} onClick={onConfirm}>{working?'Saving…':'Confirm Delivered'}</PrimaryAction>
  </WorkflowCard>
 </WorkflowFrame>;
}
