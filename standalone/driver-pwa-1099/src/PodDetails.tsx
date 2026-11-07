import { useEffect, useRef, useState } from 'react'
export type PodForm = { leftAt: string; condition: string; items: number; notes: string }
const places = ['Goods Inwards','Reception','Warehouse','Loading Bay','Security / Gatehouse',"Recipient's Address",'Other']
export default function PodDetails({jobId,reference,initialItems,recipient,onRecipient,onSignature,onChange}:{jobId:string;reference:string;initialItems:number;recipient:string;onRecipient:(s:string)=>void;onSignature:(f:File)=>void;onChange:(v:PodForm)=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null), drawing=useRef(false)
 const [leftAt,setLeftAt]=useState('Goods Inwards'),[other,setOther]=useState(''),[condition,setCondition]=useState('Good condition'),[items,setItems]=useState(String(initialItems)),[notes,setNotes]=useState(''),[open,setOpen]=useState(false),[signed,setSigned]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('xdrive-pod-form-'+jobId)||'{}');if(v.leftAt)setLeftAt(v.leftAt);if(v.other)setOther(v.other);if(v.condition)setCondition(v.condition);if(v.items!==undefined)setItems(String(v.items));if(v.notes)setNotes(v.notes)}catch{/* draft unavailable */}},[jobId])
 useEffect(()=>{localStorage.setItem('xdrive-pod-form-'+jobId,JSON.stringify({leftAt,other,condition,items,notes}));onChange({leftAt:leftAt==='Other'?other:leftAt,condition,items:Number(items),notes})},[jobId,leftAt,other,condition,items,notes,onChange])
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*e.currentTarget.width/r.width,y:(e.clientY-r.top)*e.currentTarget.height/r.height}}
 const start=(e:React.PointerEvent<HTMLCanvasElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);const p=point(e),c=e.currentTarget.getContext('2d');if(!c)return;c.strokeStyle='#152238';c.lineWidth=3;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(p.x,p.y);drawing.current=true;setSigned(true)}
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const p=point(e),c=e.currentTarget.getContext('2d');c?.lineTo(p.x,p.y);c?.stroke()}
 const save=()=>{if(!signed||!canvas.current){setMessage('Please sign first.');return}canvas.current.toBlob(blob=>{if(!blob)return;onSignature(new File([blob],jobId+'-POD-signature.png',{type:'image/png'}));setOpen(false);setMessage('Signature added. Save the POD evidence below.')},'image/png')}
 return <section className="pod-details" aria-label="Create POD"><h2>Create POD</h2>
 <label>POD Reference<input readOnly value={reference||jobId}/></label>
 <label>Left At *<select value={leftAt} onChange={e=>setLeftAt(e.target.value)}>{places.map(x=><option key={x}>{x}</option>)}</select></label>
 {leftAt==='Other'&&<label>Specify location<input value={other} onChange={e=>setOther(e.target.value)} placeholder="Delivery location"/></label>}
 <label>Received By (Full Name) *<input value={recipient} onChange={e=>onRecipient(e.target.value)} placeholder="Recipient full name"/></label>
 <button type="button" className="booking-yellow" onClick={()=>setOpen(v=>!v)}>{signed?'Edit Recipient Signature':'Recipient Signature *'}</button>
 {open&&<div className="pod-signature"><p>Ask the recipient to sign below. Rotate the phone for more space.</p><canvas ref={canvas} width={700} height={260} aria-label="Signature area" style={{width:'100%',height:200,touchAction:'none',background:'#fff',border:'1px solid #aeb4c0',borderRadius:8}} onPointerDown={start} onPointerMove={move} onPointerUp={()=>drawing.current=false} onPointerCancel={()=>drawing.current=false}/><div className="document-source-picker"><button type="button" onClick={save}>Save</button><button type="button" onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,700,260);setSigned(false)}}>Clear</button><button type="button" onClick={()=>setOpen(false)}>Cancel</button></div></div>}
 <div className="collection-pair"><label>Items Received *<input type="number" min="0" value={items} onChange={e=>setItems(e.target.value)}/></label><label>Condition *<select value={condition} onChange={e=>setCondition(e.target.value)}><option>Good condition</option><option>Damaged</option><option>Shortage</option><option>Refused</option></select></label></div>
 {(Number(items)!==initialItems||condition!=='Good condition')&&<p role="status">Please describe the discrepancy and attach supporting evidence.</p>}
 <label>Driver's Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Delivery remarks (optional for normal delivery)"/></label>
 {message&&<p role="status">{message}</p>}</section>
}
