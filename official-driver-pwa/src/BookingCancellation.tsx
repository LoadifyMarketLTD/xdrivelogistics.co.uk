import { useState } from 'react';
import { driverPost, renewSession, type LiveSession, type LiveStop } from './liveApi';

type Props={
  jobId:string;
  stop:LiveStop;
  session:LiveSession;
  onSession:(session:LiveSession)=>void;
  goodsInCustodyDefault:boolean;
  forceJobScope?:boolean;
  onSaved:(token:string)=>Promise<void>;
  onClose:()=>void;
};

export default function BookingCancellation({
  jobId,stop,session,onSession,goodsInCustodyDefault,forceJobScope=false,onSaved,onClose,
}:Props){
  const [scope,setScope]=useState<'stop'|'job'>(forceJobScope?'job':'stop');
  const [cancelledByRole,setCancelledByRole]=useState('customer');
  const [cancelledByName,setCancelledByName]=useState('');
  const [reason,setReason]=useState('');
  const [channel,setChannel]=useState('phone');
  const [goodsInCustody,setGoodsInCustody]=useState(goodsInCustodyDefault);
  const [disposition,setDisposition]=useState(goodsInCustodyDefault?'return_to_collection':'none');
  const [resolutionAddress,setResolutionAddress]=useState('');
  const [notes,setNotes]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const save=async()=>{
    if(busy)return;
    if(reason.trim().length<5){setError('Enter the cancellation reason.');return;}
    setBusy(true);setError('');
    try{
      const current=await renewSession(session);onSession(current);
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`,current.token,{
        stop_id:stop.id,status:'cancelled',
        cancellation:{
          scope:forceJobScope?'job':scope,cancelledByRole,cancelledByName:cancelledByName.trim()||null,
          reason:reason.trim(),instructionChannel:channel,goodsInCustody,
          goodsDisposition:goodsInCustody?disposition:'none',
          resolutionAddress:resolutionAddress.trim()||null,notes:notes.trim()||null,
        },
      });
      await onSaved(current.token);
      onClose();
    }catch(reasonValue){setError(reasonValue instanceof Error?reasonValue.message:'Cancellation could not be recorded.');}
    finally{setBusy(false);}
  };

  return <section className="stop-execution" aria-label="Record cancellation">
    <header className="stop-execution__header"><div><strong>{forceJobScope?'Job Cancellation':'Stop / Job Cancellation'}</strong><span>{stop.address}</span></div><button type="button" onClick={onClose}>Back</button></header>
    {error&&<p role="alert" className="notification-reason">{error}</p>}
    <div className="stop-cancellation">
      {!forceJobScope&&<label>Cancellation scope<select value={scope} onChange={e=>setScope(e.target.value as 'stop'|'job')}><option value="stop">This stop only</option><option value="job">Entire job</option></select></label>}
      <label>{forceJobScope?'Job Cancelled By':'Stop Cancelled By'}<select value={cancelledByRole} onChange={e=>setCancelledByRole(e.target.value)}>
        <option value="posting_company">Posting Company</option><option value="customer">Customer</option><option value="broker_dispatcher">Broker / Dispatcher</option>
        <option value="collection_contact">Collection Site Contact</option><option value="delivery_contact">Delivery Site Contact</option><option value="other_authorised_party">Other authorised party</option>
      </select></label>
      <label>Person / Contact Name<input value={cancelledByName} onChange={e=>setCancelledByName(e.target.value)}/></label>
      <label>Cancellation Reason *<textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <label>Instruction received by<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="phone">Phone</option><option value="message">Message</option><option value="email">Email</option><option value="in_person">In person</option><option value="other">Other</option></select></label>
      <label className="stop-cancellation__check"><input type="checkbox" checked={goodsInCustody} onChange={e=>{setGoodsInCustody(e.target.checked);if(!e.target.checked)setDisposition('none');}}/> Goods are already in my custody / vehicle</label>
      {goodsInCustody&&<label>Goods disposition<select value={disposition} onChange={e=>setDisposition(e.target.value)}>
        <option value="return_to_collection">Return to collection point</option><option value="return_to_sender_depot">Return to sender / depot</option>
        <option value="await_instructions">Hold goods and await instructions</option><option value="redirect_authorised">Redirect to authorised address</option><option value="replacement_stop">Replacement delivery stop</option>
      </select></label>}
      {goodsInCustody&&['return_to_sender_depot','redirect_authorised','replacement_stop'].includes(disposition)&&<label>Return / replacement address *<input value={resolutionAddress} onChange={e=>setResolutionAddress(e.target.value)}/></label>}
      <label>Driver's Notes<textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    </div>
    <button type="button" className="accept-action booking-next" disabled={busy} onClick={()=>void save()}>{busy?'Saving...':'Record Cancellation Instruction'}</button>
  </section>;
}
