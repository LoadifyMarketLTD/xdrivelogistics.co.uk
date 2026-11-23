import {useState} from 'react';

type DriverFields = {future_position?:unknown;future_position_date?:unknown};
const clean=(value:unknown)=>typeof value==='string'?value.trim():'';
const initialDate=(value:unknown)=>{
  const date=clean(value);
  if(!date)return '';
  const parsed=new Date(date);
  if(!Number.isFinite(parsed.getTime()))return '';
  const local=new Date(parsed.getTime()-parsed.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,16);
};
const apiPath=(import.meta.env.PROD?'/api':'/xdrive-api')+'/driver/future-position';
export default function FuturePositionPwa({token,driver}:{token:string;driver:DriverFields}){
  const [position,setPosition]=useState(()=>clean(driver.future_position));
  const [date,setDate]=useState(()=>initialDate(driver.future_position_date));
  const [review,setReview]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const submit=async()=>{
    if(saving)return;
    setSaving(true);setError('');setSuccess('');
    try{
      const payload={futurePosition:position.trim(),futureDate:new Date(date).toISOString()};
      const response=await fetch(apiPath,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({})) as {error?:string;driver?:DriverFields};
      if(!response.ok||!result.driver)throw Error(result.error||'The update could not be confirmed by XDrive.');
      setPosition(clean(result.driver.future_position));
      setDate(initialDate(result.driver.future_position_date));
      setReview(false);
      setSuccess('Future position saved and confirmed by XDrive.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Future position could not be saved.');}
    finally{setSaving(false);}
  };
  return <div className="xd-native-more-panel">
    <p className="xd-native-more-muted">Declare your next available area. This updates only your authorised driver record, not your GPS location or an active booking.</p>
    <form onSubmit={event=>{
      event.preventDefault();setError('');setSuccess('');
      if(!position.trim()||!date||new Date(date).getTime()<=Date.now()){setError('Enter an area and a future date/time.');return;}
      setReview(true);
    }}>
      <label className="xd-native-more-field">Future available area
        <input type="text" maxLength={160} autoComplete="off" value={position} onChange={e=>{setPosition(e.target.value);setReview(false);}} placeholder="Town or postcode area" required/>
      </label>
      <label className="xd-native-more-field">Available from
        <input type="datetime-local" value={date} onChange={e=>{setDate(e.target.value);setReview(false);}} required/>
      </label>
      <button type="submit" disabled={saving}>Review future position</button>
    </form>
    {review&&<section aria-label="Confirm future position" className="xd-native-more-record">
      <strong>Confirm publication to XDrive</strong>
      <span>{position.trim()} · {date.replace('T',' ')}</span>
      <div><button type="button" disabled={saving} onClick={()=>void submit()}>{saving?'Saving…':'Confirm and save'}</button>
      <button type="button" disabled={saving} onClick={()=>setReview(false)}>Cancel</button></div>
    </section>}
    {error&&<p role="alert">{error}</p>}
    {success&&<p role="status">{success}</p>}
  </div>;
}
