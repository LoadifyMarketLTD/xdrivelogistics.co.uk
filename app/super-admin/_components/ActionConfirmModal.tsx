'use client';

import { useState, useEffect } from 'react';

const X = { blue:'#1A73E8', yellow:'#FBBC05', white:'#FFFFFF', charcoal:'#4A4A4A', light:'#F5F7FA', border:'#E0E3E7', red:'#EA4335' } as const;

export type ActionConfirmModalProps = { open:boolean; title:string; description:React.ReactNode; confirmLabel:string; cancelLabel?:string; danger?:boolean; reasonLabel?:string; reasonRequired?:boolean; reasonPlaceholder?:string; submitting?:boolean; onConfirm:(reason:string)=>void; onCancel:()=>void; };

export function ActionConfirmModal({open,title,description,confirmLabel,cancelLabel='Cancel',danger=true,reasonLabel='Reason (required)',reasonRequired=true,reasonPlaceholder='Describe the reason for this action…',submitting=false,onConfirm,onCancel}:ActionConfirmModalProps){
 const [reason,setReason]=useState(''); useEffect(()=>{if(open)setReason('');},[open]); if(!open)return null;
 const reasonTooShort=reasonRequired&&reason.trim().length<5; const isDisabled=submitting||reasonTooShort; const confirmColor=danger?X.red:X.blue;
 return <div role='dialog' aria-modal='true' aria-labelledby='acm-title' style={{position:'fixed',inset:0,zIndex:1000,backgroundColor:'rgba(74,74,74,.24)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}} onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
  <div style={{backgroundColor:X.white,border:`1px solid ${X.border}`,borderTop:`4px solid ${confirmColor}`,borderRadius:'8px',padding:'24px',width:'100%',maxWidth:'520px',boxShadow:'0px 2px 6px rgba(0,0,0,0.08)',fontFamily:'Roboto, Inter, Arial, sans-serif',color:X.charcoal}}>
   <h2 id='acm-title' style={{margin:'0 0 8px',fontFamily:'Inter, Roboto, Arial, sans-serif',fontSize:'20px',lineHeight:1.25,fontWeight:700,color:X.blue}}>{title}</h2>
   <div style={{margin:'0 0 16px',fontSize:'14px',color:X.charcoal,lineHeight:1.5}}>{description}</div>
   <label htmlFor='acm-reason' style={{display:'block',marginBottom:'6px',fontFamily:'Inter, Roboto, Arial, sans-serif',fontSize:'14px',fontWeight:700,color:X.charcoal}}>{reasonLabel}{reasonRequired&&<span style={{color:X.red,marginLeft:'3px'}}>*</span>}</label>
   <textarea id='acm-reason' value={reason} onChange={e=>setReason(e.target.value)} rows={4} placeholder={reasonPlaceholder} disabled={submitting} style={{width:'100%',boxSizing:'border-box',backgroundColor:X.white,border:`1px solid ${reasonRequired&&reason.trim().length>0&&reasonTooShort?X.red:X.border}`,borderRadius:'8px',padding:'24px',color:X.charcoal,fontSize:'14px',lineHeight:1.5,resize:'vertical',outlineColor:X.blue,fontFamily:'Roboto, Inter, Arial, sans-serif'}}/>
   {reasonRequired&&reason.trim().length>0&&reasonTooShort&&<p style={{margin:'5px 0 0',fontSize:'14px',color:X.red}}>Reason must be at least 5 characters.</p>}
   <p style={{margin:'10px 0 0',fontSize:'14px',color:X.charcoal,lineHeight:1.45,opacity:.78}}>This action is recorded in the platform audit log with operator, reason and timestamp.</p>
   <div style={{display:'flex',gap:'10px',marginTop:'18px',justifyContent:'flex-end'}}><button type='button' onClick={onCancel} disabled={submitting} style={{minHeight:'40px',padding:'0 14px',borderRadius:'8px',border:`1px solid ${X.border}`,backgroundColor:X.white,color:X.blue,fontFamily:'Inter, Roboto, Arial, sans-serif',fontSize:'14px',fontWeight:700,cursor:submitting?'not-allowed':'pointer'}}>{cancelLabel}</button><button type='button' onClick={()=>{if(!isDisabled)onConfirm(reason.trim());}} disabled={isDisabled} style={{minHeight:'40px',padding:'0 14px',borderRadius:'8px',border:`1px solid ${confirmColor}`,backgroundColor:confirmColor,color:X.white,fontFamily:'Inter, Roboto, Arial, sans-serif',fontWeight:700,fontSize:'14px',cursor:isDisabled?'not-allowed':'pointer',opacity:isDisabled?.55:1}}>{submitting?'…':confirmLabel}</button></div>
  </div>
 </div>;
}
