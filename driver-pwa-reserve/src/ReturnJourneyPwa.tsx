import {useState} from 'react';

type Journey={from_postcode?:unknown;to_postcode?:unknown;available_from?:unknown;available_to?:unknown;vehicle_type?:unknown;notes?:unknown;status?:unknown};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const localDate=(value:unknown)=>{
  const raw=text(value);if(!raw)return '';
  const date=new Date(raw);if(!Number.isFinite(date.getTime()))return '';
  return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16);
};
const endpoint=(import.meta.env.PROD?'/api':'/xdrive-api')+'/driver/web/resources';
type Mode='publish'|'clear';
export default function ReturnJourneyPwa({token,journey}:{token:string;journey:Journey|null}){
  const [from,setFrom]=useState(()=>text(journey?.from_postcode));
  const [to,setTo]=useState(()=>text(journey?.to_postcode));
  const [start,setStart]=useState(()=>localDate(journey?.available_from));
  const [end,setEnd]=useState(()=>localDate(journey?.available_to));
  const [vehicle,setVehicle]=useState(()=>text(journey?.vehicle_type));
  const [notes,setNotes]=useState(()=>text(journey?.notes));
  const [published,setPublished]=useState(Boolean(text(journey?.from_postcode)));
  const [review,setReview]=useState<Mode|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const change=()=>{setReview(null);setSuccess('');};
  const publish=async(mode:Mode)=>{
    if(saving)return;
    setSaving(true);setError('');setSuccess('');
    try{
      const payload=mode==='clear'
        ?{action:'save_return_journey',fromLocation:'',toLocation:'',availableDate:'',availableTo:'',vehicleType:'',notes:''}
        :{action:'save_return_journey',fromLocation:from.trim().toUpperCase(),toLocation:to.trim().toUpperCase(),availableDate:new Date(start).toISOString(),availableTo:end?new Date(end).toISOString():'',vehicleType:vehicle.trim(),notes:notes.trim()};
      const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const saved=await response.json().catch(()=>({})) as {ok?:boolean;error?:string};
      if(!response.ok||saved.ok!==true)throw Error(saved.error||'XDrive did not confirm the return journey change.');
      const verifiedResponse=await fetch(endpoint,{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'});
      const verified=await verifiedResponse.json().catch(()=>({})) as {error?:string;resources?:{return_journey?:Journey|null}};
      if(!verifiedResponse.ok||!verified.resources)throw Error('The change was accepted, but the saved record could not be verified. Refresh before trying again.');
      const current=verified.resources.return_journey||null;
      if(mode==='clear'&&current?.from_postcode)throw Error('Return journey cancellation was not confirmed. Refresh before retrying.');
      if(mode==='publish'&&text(current?.from_postcode).toUpperCase()!==from.trim().toUpperCase())throw Error('Return journey record differs from your declaration. Refresh before retrying.');
      setPublished(mode==='publish');
      setReview(null);
      setSuccess(mode==='clear'?'Return journey withdrawn and verified.':'Return journey published and verified by XDrive.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Return journey could not be updated.');}
    finally{setSaving(false);}
  };
  return <div className="xd-native-more-panel" aria-label="Return journey management">
    <p className="xd-native-more-muted">Publish your genuine return availability to the XDrive network. This is not a booking or an accepted transport.</p>
    <form onSubmit={event=>{
      event.preventDefault();setError('');setSuccess('');
      const validArea=/^[A-Za-z0-9 ]{2,12}$/;
      if(!validArea.test(from.trim())||!validArea.test(to.trim())){setError('Enter valid UK postcode areas for collection and destination.');return;}
      if(!start||new Date(start).getTime()<=Date.now()){setError('Choose a future start date and time.');return;}
      if(end&&new Date(end).getTime()<=new Date(start).getTime()){setError('End time must be after the start time.');return;}
      setReview('publish');
    }}>
      <label className="xd-native-more-field">From postcode area<input value={from} maxLength={12} required onChange={e=>{setFrom(e.target.value);change();}} placeholder="e.g. BB1"/></label>
      <label className="xd-native-more-field">To postcode area<input value={to} maxLength={12} required onChange={e=>{setTo(e.target.value);change();}} placeholder="e.g. M1"/></label>
      <label className="xd-native-more-field">Available from<input type="datetime-local" value={start} required onChange={e=>{setStart(e.target.value);change();}}/></label>
      <label className="xd-native-more-field">Available until (optional)<input type="datetime-local" value={end} onChange={e=>{setEnd(e.target.value);change();}}/></label>
      <label className="xd-native-more-field">Vehicle type (optional)<input value={vehicle} maxLength={100} onChange={e=>{setVehicle(e.target.value);change();}}/></label>
      <label className="xd-native-more-field">Notes (optional)<textarea rows={3} maxLength={1000} value={notes} onChange={e=>{setNotes(e.target.value);change();}}/></label>
      <button type="submit" disabled={saving}>Review return journey</button>
    </form>
    {published&&!review&&<button type="button" disabled={saving} onClick={()=>{setError('');setSuccess('');setReview('clear');}}>Withdraw return journey</button>}
    {review&&<section className="xd-native-more-record" aria-label="Confirm return journey change">
      <strong>{review==='clear'?'Withdraw return journey?':'Confirm return journey publication'}</strong>
      <span>{review==='clear'?'Your published return availability will be withdrawn.':from.trim()+' → '+to.trim()+' · '+start.replace('T',' ')}</span>
      <div><button type="button" disabled={saving} onClick={()=>void publish(review)}>{saving?'Saving…':review==='clear'?'Confirm withdrawal':'Confirm publication'}</button>
        <button type="button" disabled={saving} onClick={()=>setReview(null)}>Cancel</button></div>
    </section>}
    {error&&<p role="alert">{error}</p>}
    {success&&<p role="status">{success}</p>}
  </div>;
}
