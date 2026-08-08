'use client';

import { useState, useEffect } from 'react';

const X = { navy:'#0B2F6B', blue:'#1D57D8', orange:'#F5A300', white:'#FFFFFF', charcoal:'#1A1F2B', light:'#F4F6F8', border:'#D9E1EA', muted:'#64748B', red:'#DC2626' } as const;

export type ActionConfirmModalProps = { open:boolean; title:string; description:React.ReactNode; confirmLabel:string; cancelLabel?:string; danger?:boolean; reasonLabel?:string; reasonRequired?:boolean; reasonPlaceholder?:string; submitting?:boolean; onConfirm:(reason:string)=>void; onCancel:()=>void; };

export function ActionConfirmModal({open,title,description,confirmLabel,cancelLabel='Cancel',danger=true,reasonLabel='Reason (required)',reasonRequired=true,reasonPlaceholder='Describe the reason for this action…',submitting=false,onConfirm,onCancel}:ActionConfirmModalProps){
 const [reason,setReason]=useState(''); useEffect(()=>{if(open)setReason('');},[open]); if(!open)return null;
 const reasonTooShort=reasonRequired&&reason.trim().length<5; const isDisabled=submitting||reasonTooShort; const confirmColor=danger?X.red:X.blue;
 return <div role='dialog' aria-modal='true' aria-labelledby='acm-title' style={{position:'fixed',inset:0,zIndex:1000,backgroundColor:'rgba(11,47,107,.28)',display:'flex',alignItems:'center',justifyContent:'center',padding:'12px'}} onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
  <div style={{backgroundColor:X.white,border:`1px solid ${X.border}`,borderTop:`3px solid ${confirmColor}`,borderRadius:'4px',padding:'12px',width:'100%',maxWidth:'460px',boxShadow:'0 18px 44px rgba(11,47,107,.18)'}}>
   <h2 id='acm-title' style={{margin:'0 0 6px',fontSize:'16px',fontWeight:800,color:X.navy}}>{title}</h2>
   <div style={{margin:'0 0 12px',fontSize:'12px',color:X.charcoal,lineHeight:1.5}}>{description}</div>
   <label htmlFor='acm-reason' style={{display:'block',marginBottom:'4px',fontSize:'11px',fontWeight:700,color:X.navy}}>{reasonLabel}{reasonRequired&&<span style={{color:X.red,marginLeft:'2px'}}>*</span>}</label>
   <textarea id='acm-reason' value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder={reasonPlaceholder} disabled={submitting} style={{width:'100%',boxSizing:'border-box',backgroundColor:X.white,border:`1px solid ${reasonRequired&&reason.trim().length>0&&reasonTooShort?X.red:X.border}`,borderRadius:'4px',padding:'8px',color:X.charcoal,fontSize:'12px',resize:'vertical',outlineColor:X.blue,fontFamily:'inherit'}}/>
   {reasonRequired&&reason.trim().length>0&&reasonTooShort&&<p style={{margin:'3px 0 0',fontSize:'10px',color:X.red}}>Reason must be at least 5 characters.</p>}
   <p style={{margin:'8px 0 0',fontSize:'10px',color:X.muted,lineHeight:1.4}}>This action is recorded in the platform audit log with operator, reason and timestamp.</p>
   <div style={{display:'flex',gap:'6px',marginTop:'12px',justifyContent:'flex-end'}}><button type='button' onClick={onCancel} disabled={submitting} style={{height:'32px',padding:'0 10px',borderRadius:'4px',border:`1px solid ${X.border}`,backgroundColor:X.white,color:X.navy,fontSize:'11px',fontWeight:700,cursor:submitting?'not-allowed':'pointer'}}>{cancelLabel}</button><button type='button' onClick={()=>{if(!isDisabled)onConfirm(reason.trim());}} disabled={isDisabled} style={{height:'32px',padding:'0 10px',borderRadius:'4px',border:`1px solid ${confirmColor}`,backgroundColor:confirmColor,color:X.white,fontWeight:800,fontSize:'11px',cursor:isDisabled?'not-allowed':'pointer',opacity:isDisabled?.55:1}}>{submitting?'…':confirmLabel}</button></div>
  </div>
 </div>;
}
