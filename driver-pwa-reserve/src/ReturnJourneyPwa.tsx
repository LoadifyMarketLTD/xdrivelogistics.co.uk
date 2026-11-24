import {useState} from 'react';
import './ReturnJourneyPwa.css';

type Journey={from_postcode?:unknown;to_postcode?:unknown;available_from?:unknown;available_to?:unknown;vehicle_type?:unknown;notes?:unknown;status?:unknown};
type Mode='publish'|'clear';
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const localDate=(value:unknown)=>{
  const raw=text(value);if(!raw)return '';
  const date=new Date(raw);if(!Number.isFinite(date.getTime()))return '';
  return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16);
};
const endpoint=(import.meta.env.PROD?'/api':'/xdrive-api')+'/driver/web/resources';
const structuredSource='xdrive_return_exchange_v2';

// Legacy marketplace records encode their structured commercial metadata in notes.
// Expose only user-authored notes, and preserve the whole metadata envelope on update.
export function decodeReturnJourneyNotes(value:unknown):{notes:string;meta:Record<string,unknown>|null}{
  const raw=text(value);if(!raw)return {notes:'',meta:null};
  try{
    const parsed:unknown=JSON.parse(raw);
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&'source' in parsed&&
      (parsed as Record<string,unknown>).source===structuredSource){
      const meta=parsed as Record<string,unknown>;
      return {notes:text(meta.notes),meta};
    }
  }catch{/* Plain notes are valid and should remain untouched. */}
  return {notes:raw,meta:null};
}
export function encodeReturnJourneyNotes(notes:string,meta:Record<string,unknown>|null){
  if(!meta)return notes.trim();
  return JSON.stringify({...meta,notes:notes.trim()});
}

export default function ReturnJourneyPwa({token,journey,onSaved}:{token:string;journey:Journey|null;onSaved?:(journey:Journey|null)=>void}){
  const initialNotes=decodeReturnJourneyNotes(journey?.notes);
  const [from,setFrom]=useState(()=>text(journey?.from_postcode));
  const [to,setTo]=useState(()=>text(journey?.to_postcode));
  const [anywhere,setAnywhere]=useState(()=>!!journey?.from_postcode&&!text(journey?.to_postcode));
  const [start,setStart]=useState(()=>localDate(journey?.available_from));
  const [end,setEnd]=useState(()=>localDate(journey?.available_to));
  const [vehicle,setVehicle]=useState(()=>text(journey?.vehicle_type));
  const [notes,setNotes]=useState(()=>initialNotes.notes);
  const [notesMeta,setNotesMeta]=useState<Record<string,unknown>|null>(initialNotes.meta);
  const [published,setPublished]=useState(Boolean(text(journey?.from_postcode)));
  const [review,setReview]=useState<Mode|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const change=()=>{setReview(null);setSuccess('');};
  const oldDate=Boolean(start&&new Date(start).getTime()<=Date.now());
  const publish=async(mode:Mode)=>{
    if(saving)return;
    setSaving(true);setError('');setSuccess('');
    try{
      const payload=mode==='clear'
        ?{action:'save_return_journey',fromLocation:'',toLocation:'',availableDate:'',availableTo:'',vehicleType:'',notes:''}
        :{action:'save_return_journey',fromLocation:from.trim().toUpperCase(),toLocation:anywhere?'':to.trim().toUpperCase(),
          availableDate:new Date(start).toISOString(),availableTo:end?new Date(end).toISOString():'',
          vehicleType:vehicle.trim(),notes:encodeReturnJourneyNotes(notes,notesMeta)};
      const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const saved=await response.json().catch(()=>({})) as {ok?:boolean;error?:string};
      if(!response.ok||saved.ok!==true)throw Error(saved.error||'XDrive did not confirm the return journey change.');
      const verifiedResponse=await fetch(endpoint,{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'});
      const verified=await verifiedResponse.json().catch(()=>({})) as {error?:string;resources?:{return_journey?:Journey|null}};
      if(!verifiedResponse.ok||!verified.resources)throw Error('The saved record could not be verified. Refresh before trying again.');
      const current=verified.resources.return_journey||null;
      if(mode==='clear'&&current?.from_postcode)throw Error('Withdrawal could not be verified. Refresh before retrying.');
      if(mode==='publish'&&text(current?.from_postcode).toUpperCase()!==from.trim().toUpperCase())throw Error('The saved journey differs from your declaration.');
      setPublished(Boolean(text(current?.from_postcode)));
      if(mode==='publish'){
        const parsed=decodeReturnJourneyNotes(current?.notes);
        setNotes(parsed.notes);setNotesMeta(parsed.meta);
      }
      onSaved?.(current);setReview(null);
      setSuccess(mode==='clear'?'Your return journey has been withdrawn.':'Your return journey is published and verified.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Return journey could not be updated.');}
    finally{setSaving(false);}
  };
  return <section className="xd-rj" aria-label="Return journey management">
    <div className="xd-rj-intro">
      <span className="xd-rj-eyebrow">RETURN AVAILABILITY</span>
      <h2>Plan your next journey</h2>
      <p>Let the XDrive network know where your vehicle is available. Publishing availability does not accept a booking.</p>
    </div>
    {published&&<div className="xd-rj-status" role="status">
      <span className="xd-rj-status-indicator" aria-hidden="true"/>
      <div><strong>Published return journey</strong><span>{from||'Departure area'} → {anywhere?'Anywhere':to||'Destination not specified'}{oldDate?' · Previous departure time':''}</span></div>
    </div>}
    <form className="xd-rj-form" onSubmit={event=>{
      event.preventDefault();setError('');setSuccess('');
      const validArea=/^[A-Za-z0-9 ]{2,120}$/;
      if(!validArea.test(from.trim())||(!anywhere&&!validArea.test(to.trim()))){setError('Enter valid starting and destination areas, or choose Anywhere.');return;}
      if(!start||!Number.isFinite(new Date(start).getTime())||new Date(start).getTime()<=Date.now()){setError('Choose a future departure date and time.');return;}
      if(end&&(!Number.isFinite(new Date(end).getTime())||new Date(end).getTime()<=new Date(start).getTime())){setError('Available until must be later than the departure time.');return;}
      setReview('publish');
    }}>
      <div className="xd-rj-section-heading"><span className="xd-rj-step">01</span><strong>Journey details</strong></div>
      <div className="xd-rj-grid">
        <label className="xd-rj-field"><span>Departure area <em>*</em></span>
          <input value={from} maxLength={120} required onChange={e=>{setFrom(e.target.value);change();}} placeholder="Town or postcode, e.g. BB1"/>
        </label>
        <label className="xd-rj-field"><span>Destination <em>{anywhere?'':'*'}</em></span>
          <input value={anywhere?'':to} maxLength={120} required={!anywhere} disabled={anywhere} onChange={e=>{setTo(e.target.value);change();}} placeholder={anywhere?'Any UK destination':'Town or postcode, e.g. M1'}/>
        </label>
      </div>
      <label className="xd-rj-toggle"><input type="checkbox" checked={anywhere} onChange={e=>{setAnywhere(e.target.checked);change();}}/><span>Available for journeys to <strong>any destination</strong></span></label>
      <div className="xd-rj-section-heading"><span className="xd-rj-step">02</span><strong>Availability window</strong></div>
      <div className="xd-rj-grid">
        <label className="xd-rj-field"><span>Available from <em>*</em></span>
          <input type="datetime-local" value={start} required onChange={e=>{setStart(e.target.value);change();}}/>
        </label>
        <label className="xd-rj-field"><span>Available until <small>Optional</small></span>
          <input type="datetime-local" value={end} onChange={e=>{setEnd(e.target.value);change();}}/>
        </label>
      </div>
      {oldDate&&<p className="xd-rj-notice" role="status">The saved departure time has passed. Choose a future date before republishing.</p>}
      <div className="xd-rj-section-heading"><span className="xd-rj-step">03</span><strong>Vehicle &amp; instructions</strong></div>
      <label className="xd-rj-field"><span>Vehicle type <small>Optional</small></span>
        <input value={vehicle} maxLength={100} onChange={e=>{setVehicle(e.target.value);change();}} placeholder="e.g. Luton van with tail lift"/>
      </label>
      <label className="xd-rj-field"><span>Notes for the network <small>Optional</small></span>
        <textarea rows={3} maxLength={1000} value={notes} onChange={e=>{setNotes(e.target.value);change();}} placeholder="Capacity, preferred routes, working hours or special requirements"/>
      </label>
      <p className="xd-rj-privacy">Only your journey availability is published. No booking is accepted through this form.</p>
      <button className="xd-rj-primary" type="submit" disabled={saving}>{saving?'Saving…':'Review & publish journey'}</button>
    </form>
    {published&&!review&&<button className="xd-rj-withdraw" type="button" disabled={saving} onClick={()=>{setError('');setSuccess('');setReview('clear');}}>Withdraw published journey</button>}
    {review&&<div className="xd-rj-review" role="dialog" aria-modal="false" aria-label="Confirm return journey change">
      <strong>{review==='clear'?'Withdraw your published journey?':'Review before publishing'}</strong>
      <p>{review==='clear'?'This will remove your return availability from the XDrive network.':`${from.trim()} → ${anywhere?'Anywhere':to.trim()} · ${start.replace('T',' ')}`}</p>
      <div className="xd-rj-actions"><button className={review==='clear'?'xd-rj-danger':'xd-rj-primary'} type="button" disabled={saving} onClick={()=>void publish(review)}>{saving?'Saving…':review==='clear'?'Confirm withdrawal':'Confirm publication'}</button>
        <button className="xd-rj-secondary" type="button" disabled={saving} onClick={()=>setReview(null)}>Keep editing</button></div>
    </div>}
    {error&&<p className="xd-rj-error" role="alert">{error}</p>}
    {success&&<p className="xd-rj-success" role="status">{success}</p>}
  </section>;
}
