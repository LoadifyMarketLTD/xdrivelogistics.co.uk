import { useEffect, useRef, useState } from 'react'

export type PodForm = {
  leftAt: string
  condition: string
  items: number
  weightKg: number | null
  deliveredOn: string
  deliveredTime: string
  notes: string
}

const places = ['Goods Inwards','Reception','Warehouse','Loading Bay','Security / Gatehouse',"Recipient's Address",'Other']
const pad=(value:number)=>String(value).padStart(2,'0')
const nowParts=()=>{const now=new Date();return {date:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,time:`${pad(now.getHours())}:${pad(now.getMinutes())}`}}

export default function PodDetails({
  jobId,reference,initialItems,initialDelivery,recipient,onRecipient,onSignature,onChange,initialSignatureSaved=false,
}:{
  jobId:string
  reference:string
  initialItems:number
  initialDelivery?:PodForm
  recipient:string
  onRecipient:(s:string)=>void
  onSignature:(f:File)=>void
  onChange:(v:PodForm)=>void
  initialSignatureSaved?:boolean
}) {
 const current=nowParts()
 const canvas=useRef<HTMLCanvasElement>(null), drawing=useRef(false)
 const [leftAt,setLeftAt]=useState(initialDelivery?.leftAt || 'Goods Inwards')
 const [other,setOther]=useState('')
 const [condition,setCondition]=useState(initialDelivery?.condition || 'Good condition')
 const [items,setItems]=useState(String(initialDelivery?.items ?? initialItems))
 const [weightKg,setWeightKg]=useState(initialDelivery?.weightKg == null ? '' : String(initialDelivery.weightKg))
 const [deliveredOn,setDeliveredOn]=useState(initialDelivery?.deliveredOn || current.date)
 const [deliveredTime,setDeliveredTime]=useState(initialDelivery?.deliveredTime || current.time)
 const [notes,setNotes]=useState(initialDelivery?.notes || '')
 const [open,setOpen]=useState(false),[signed,setSigned]=useState(false),[message,setMessage]=useState('')

 useEffect(()=>{
   try{
     const v=JSON.parse(localStorage.getItem('xdrive-pod-form-'+jobId)||'{}')
     if(!initialDelivery){
       if(v.leftAt)setLeftAt(v.leftAt)
       if(v.other)setOther(v.other)
       if(v.condition)setCondition(v.condition)
       if(v.items!==undefined)setItems(String(v.items))
       if(v.weightKg!==undefined&&v.weightKg!==null)setWeightKg(String(v.weightKg))
       if(v.deliveredOn)setDeliveredOn(v.deliveredOn)
       if(v.deliveredTime)setDeliveredTime(v.deliveredTime)
       if(v.notes)setNotes(v.notes)
     }
   }catch{/* draft unavailable */}
 },[jobId,initialDelivery])

 useEffect(()=>{
   const weight=weightKg.trim()===''?null:Number(weightKg)
   localStorage.setItem('xdrive-pod-form-'+jobId,JSON.stringify({leftAt,other,condition,items,weightKg:weight,deliveredOn,deliveredTime,notes}))
   onChange({
     leftAt:leftAt==='Other'?other:leftAt,
     condition,
     items:Number(items),
     weightKg:weight,
     deliveredOn,
     deliveredTime,
     notes,
   })
 },[jobId,leftAt,other,condition,items,weightKg,deliveredOn,deliveredTime,notes,onChange])

 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*e.currentTarget.width/r.width,y:(e.clientY-r.top)*e.currentTarget.height/r.height}}
 const start=(e:React.PointerEvent<HTMLCanvasElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);const p=point(e),c=e.currentTarget.getContext('2d');if(!c)return;c.strokeStyle='#152238';c.lineWidth=3;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(p.x,p.y);drawing.current=true;setSigned(true)}
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const p=point(e),c=e.currentTarget.getContext('2d');c?.lineTo(p.x,p.y);c?.stroke()}
 const save=()=>{if(!signed||!canvas.current){setMessage('Please sign first.');return}canvas.current.toBlob(blob=>{if(!blob)return;onSignature(new File([blob],jobId+'-POD-signature.png',{type:'image/png'}));setOpen(false);setMessage('Signature added. Save the POD evidence below.')},'image/png')}

 return <section className="pod-details" aria-label="Create POD"><h2>Create POD</h2>
 <label>POD Reference<input readOnly value={reference||jobId}/></label>
 <label>Left At *<select value={leftAt} onChange={e=>setLeftAt(e.target.value)}>{places.map(x=><option key={x}>{x}</option>)}</select></label>
 {leftAt==='Other'&&<label>Specify location<input value={other} onChange={e=>setOther(e.target.value)} placeholder="Delivery location"/></label>}
 <label>Received By (Full Name) *<input value={recipient} onChange={e=>onRecipient(e.target.value)} placeholder="Recipient full name"/></label>
 {initialSignatureSaved && !open && <p role="status">Recipient signature was saved during delivery.</p>}
 <button type="button" className="booking-yellow" onClick={()=>setOpen(v=>!v)}>{signed||initialSignatureSaved?'Replace Recipient Signature':'Recipient Signature *'}</button>
 {open&&<div className="pod-signature"><p>Ask {recipient.trim() || 'the recipient'} to sign below. Rotate the phone for more space.</p><canvas ref={canvas} width={700} height={260} aria-label="Signature area" style={{width:'100%',height:200,touchAction:'none',background:'#fff',border:'1px solid #aeb4c0',borderRadius:8}} onPointerDown={start} onPointerMove={move} onPointerUp={()=>drawing.current=false} onPointerCancel={()=>drawing.current=false}/><div className="document-source-picker"><button type="button" onClick={save}>Save</button><button type="button" onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,700,260);setSigned(false)}}>Clear</button><button type="button" onClick={()=>setOpen(false)}>Cancel</button></div></div>}
 <div className="collection-pair"><label>Delivered On *<input type="date" value={deliveredOn} onChange={e=>setDeliveredOn(e.target.value)}/></label><label>Delivery Time *<input type="time" value={deliveredTime} onChange={e=>setDeliveredTime(e.target.value)}/></label></div>
 <div className="collection-pair"><label>Number Of Items *<input type="number" min="1" value={items} onChange={e=>setItems(e.target.value)}/></label><label>Weight (kg)<input type="number" min="0" step="0.01" value={weightKg} onChange={e=>setWeightKg(e.target.value)}/></label></div>
 <label>Delivery Status *<select value={condition} onChange={e=>setCondition(e.target.value)}><option>Good condition</option><option>Damaged</option><option>Shortage</option><option>Refused</option></select></label>
 {(Number(items)!==initialItems||condition!=='Good condition')&&<p role="status">Please describe the discrepancy and attach supporting evidence.</p>}
 <label>Driver's Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Delivery remarks (optional for normal delivery)"/></label>
 {message&&<p role="status">{message}</p>}</section>
}
