import { useState, type FormEvent } from 'react';
import { driverPost, renewSession, type LiveJob, type LiveSession } from './liveApi';

type Props = {
  job: LiveJob;
  session: LiveSession;
  onSession: (session: LiveSession) => void;
  onDone: (available: boolean) => void;
  onCancel: () => void;
};

function localDatetime(date: Date) {
  return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16);
}

/** CX-inspired post-POD advertisement; never publishes without explicit confirmation. */
export default function PostPodAdvertise({job,session,onSession,onDone,onCancel}:Props) {
  const [origin,setOrigin]=useState(job.toOutcode||job.to||'');
  const [destination,setDestination]=useState('');
  const [anywhere,setAnywhere]=useState(true);
  const [vehicle,setVehicle]=useState(job.vehicle||'');
  const [availableFrom,setAvailableFrom]=useState(()=>localDatetime(new Date(Date.now()+15*60_000)));
  const [availableTo,setAvailableTo]=useState('');
  const [notes,setNotes]=useState('');
  const [markAvailable,setMarkAvailable]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [published,setPublished]=useState(false);
  const [availabilityWarning,setAvailabilityWarning]=useState('');

  async function submit(event:FormEvent) {
    event.preventDefault();
    if(busy||published)return;
    setError('');
    const fromDate=new Date(availableFrom);
    const toDate=availableTo?new Date(availableTo):null;
    if(!origin.trim()||!vehicle.trim()||!Number.isFinite(fromDate.getTime())||
       fromDate.getTime()<Date.now()-60_000||(toDate&&(!Number.isFinite(toDate.getTime())||toDate<=fromDate))) {
      setError('Enter an origin, vehicle and valid future availability dates.');return;
    }
    if(!anywhere&&!destination.trim()){setError('Enter a destination or select Anywhere.');return;}
    setBusy(true);
    try {
      const fresh=await renewSession(session);
      onSession(fresh);
      const result=await driverPost('/return-journeys',fresh.token,{
        from:origin.trim(),to:anywhere?'':destination.trim(),goAnywhere:anywhere,
        vehicleType:vehicle.trim(),availableFrom:fromDate.toISOString(),
        availableTo:toDate?toDate.toISOString():'',journeyKind:'ad_hoc',notes:notes.trim(),
      });
      const journey=result.journey&&typeof result.journey==='object'?result.journey as {id?:unknown}:null;
      if(typeof journey?.id!=='string'||!journey.id)throw new Error('XDrive did not confirm the published journey.');
      setPublished(true);
      if(markAvailable) {
        try {
          const endpoint=(import.meta.env.PROD?'/api/driver':'/xdrive-api/driver')+'/availability-profile';
          const response=await fetch(endpoint,{
            method:'PUT',headers:{Authorization:'Bearer '+fresh.token,'Content-Type':'application/json'},
            body:JSON.stringify({availabilityStatus:'available'}),
          });
          if(!response.ok)throw new Error('Availability profile update was not confirmed.');
        } catch {
          setAvailabilityWarning('The journey was published, but the availability status was not updated. Open Availability to update it separately.');
          return;
        }
      }
    } catch(reason) {
      setError(reason instanceof Error?reason.message:'Could not advertise this journey.');
    } finally {setBusy(false);}
  }

  return <section className="rv-availability-overlay" role="dialog" aria-modal="true" aria-label="Advertise for new loads">
    <div className="rv-availability-dialog rv-advertise-form">
      <h2>Advertise for</h2>
      <p>Your signed POD is complete. Advertise your availability for the next load.</p>
      {published?<div role="status" className="rv-success">
        Return journey advertised successfully.
        {availabilityWarning&&<p className="rv-warning">{availabilityWarning}</p>}
        <button type="button" className="rv-primary rv-wide" onClick={()=>onDone(markAvailable&&!availabilityWarning)}>Back to completed booking</button>
      </div>:<form onSubmit={event=>void submit(event)}>
        <label>Available from location<input required value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Town or postcode"/></label>
        <label>Destination<input value={destination} disabled={anywhere} onChange={e=>setDestination(e.target.value)} placeholder="Town or postcode"/></label>
        <label className="rv-advertise-check"><input type="checkbox" checked={anywhere} onChange={e=>setAnywhere(e.target.checked)}/> Anywhere</label>
        <label>Vehicle<input required value={vehicle} onChange={e=>setVehicle(e.target.value)} /></label>
        <label>Available from<input type="datetime-local" required value={availableFrom} onChange={e=>setAvailableFrom(e.target.value)}/></label>
        <label>Available until (optional)<input type="datetime-local" value={availableTo} onChange={e=>setAvailableTo(e.target.value)}/></label>
        <label>Notes (optional)<textarea rows={2} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <label className="rv-advertise-check"><input type="checkbox" checked={markAvailable} onChange={e=>setMarkAvailable(e.target.checked)}/> Mark me available for new loads</label>
        {error&&<p role="alert" className="rv-error">{error}</p>}
        <div className="rv-actions"><button type="button" className="rv-outline" onClick={onCancel} disabled={busy}>Not now</button>
          <button type="submit" className="rv-primary" disabled={busy}>{busy?'Publishing...':'Publish availability'}</button></div>
      </form>}
    </div>
  </section>;
}
