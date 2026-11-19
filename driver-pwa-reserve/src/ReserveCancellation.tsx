import { useState } from 'react';

export type ReserveCancellationValue={
  scope:'stop'|'job';
  cancelledByRole:string;
  cancelledByName:string;
  reason:string;
  instructionChannel:string;
  goodsInCustody:boolean;
  goodsDisposition:string;
  resolutionAddress:string;
  notes:string;
};

type Props={
  title?:string;
  address:string;
  goodsInCustodyDefault:boolean;
  forceJobScope?:boolean;
  busy:boolean;
  error?:string;
  onBack:()=>void;
  onSubmit:(value:ReserveCancellationValue)=>void;
};

export default function ReserveCancellation({title='Request Booking Cancellation',address,goodsInCustodyDefault,forceJobScope=false,busy,error,onBack,onSubmit}:Props){
  const [scope,setScope]=useState<'stop'|'job'>(forceJobScope?'job':'stop');
  const [cancelledByRole,setCancelledByRole]=useState('customer');
  const [cancelledByName,setCancelledByName]=useState('');
  const [reason,setReason]=useState('');
  const [instructionChannel,setInstructionChannel]=useState('phone');
  const [goodsInCustody,setGoodsInCustody]=useState(goodsInCustodyDefault);
  const [goodsDisposition,setGoodsDisposition]=useState(goodsInCustodyDefault?'await_instructions':'none');
  const [resolutionAddress,setResolutionAddress]=useState('');
  const [notes,setNotes]=useState('');
  const needsAddress=goodsInCustody&&['return_to_sender_depot','redirect_authorised','replacement_stop'].includes(goodsDisposition);
  const custodyBlocked=goodsInCustodyDefault||goodsInCustody;
  const valid=reason.trim().length>=5&&!custodyBlocked;

  return <section className="rv-operation-screen rv-request-screen">
    <button className="rv-back" type="button" onClick={onBack}>← Back</button>
    <span className="rv-over">BOOKING OPERATIONS</span>
    <h1>{title}</h1>
    <section className="rv-card">
      <p><strong>Current location / stop:</strong> {address}</p>
      {!forceJobScope&&<label className="rv-field"><span>Cancellation scope</span><select value={scope} onChange={e=>setScope(e.target.value as 'stop'|'job')}><option value="stop">This stop only</option><option value="job">Entire job</option></select></label>}
      <label className="rv-field"><span>{(forceJobScope||scope==='job')?'Cancellation requested by':'Cancellation requested by'}</span><select value={cancelledByRole} onChange={e=>setCancelledByRole(e.target.value)}>
        <option value="posting_company">Posting Company</option>
        <option value="customer">Customer</option>
        <option value="broker_dispatcher">Broker / Dispatcher</option>
        <option value="collection_contact">Collection Site Contact</option>
        <option value="delivery_contact">Delivery Site Contact</option>
        <option value="other_authorised_party">Other authorised party</option>
      </select></label>
      <label className="rv-field"><span>Person / Contact Name</span><input value={cancelledByName} onChange={e=>setCancelledByName(e.target.value)} maxLength={160}/></label>
      <label className="rv-field"><span>Cancellation Reason *</span><textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>
      <label className="rv-field"><span>Instruction received by</span><select value={instructionChannel} onChange={e=>setInstructionChannel(e.target.value)}>
        <option value="phone">Phone</option><option value="message">Message</option><option value="email">Email</option><option value="in_person">In person</option><option value="other">Other</option>
      </select></label>
      <label className="rv-hard-copy-ack"><input type="checkbox" checked={goodsInCustody} disabled={goodsInCustodyDefault||busy} onChange={e=>{setGoodsInCustody(e.target.checked);if(!e.target.checked)setGoodsDisposition('none');else if(goodsDisposition==='none')setGoodsDisposition('await_instructions')}}/> Goods are already in my custody / vehicle</label>
      {goodsInCustody&&<label className="rv-field"><span>Requested goods disposition (not authorised)</span><select value={goodsDisposition} onChange={e=>setGoodsDisposition(e.target.value)}>
        <option value="return_to_collection">Return to collection point</option>
        <option value="return_to_sender_depot">Return to sender / depot</option>
        <option value="await_instructions">Hold goods and await instructions</option>
        <option value="redirect_authorised">Request redirection</option>
        <option value="replacement_stop">Request replacement delivery stop</option>
      </select></label>}
      {needsAddress&&<label className="rv-field"><span>Return / replacement address *</span><input value={resolutionAddress} onChange={e=>setResolutionAddress(e.target.value)} maxLength={500}/></label>}
      <label className="rv-field"><span>Driver Notes</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
      <p className="rv-sub">This submits a cancellation request for review. It does not cancel the booking, authorise a return or redirect, release goods from custody, or change the agreed price.</p>
      {custodyBlocked&&<p className="rv-warning" role="status">Goods remain in custody. Online cancellation is unavailable. Contact the posting company for authorised instructions. Do not return or redirect goods without approval.</p>}
      {error&&<p className="rv-error" role="alert">{error}</p>}
      <button className="rv-primary rv-wide" type="button" disabled={busy||!valid} onClick={()=>onSubmit({
        scope:forceJobScope?'job':scope,cancelledByRole,cancelledByName:cancelledByName.trim(),
        reason:reason.trim(),instructionChannel,goodsInCustody,
        goodsDisposition:goodsInCustody?goodsDisposition:'none',resolutionAddress:resolutionAddress.trim(),notes:notes.trim(),
      })}>{busy?'Recording cancellation…':'Submit Cancellation Request'}</button>
    </section>
  </section>;
}
