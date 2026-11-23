import {useEffect,useState} from 'react';

type Availability='available'|'busy'|'offline';
const statuses:Availability[]=['available','busy','offline'];
const validStatus=(value:unknown):Availability|null=>statuses.includes(value as Availability)?value as Availability:null;
const name=(status:Availability)=>status.charAt(0).toUpperCase()+status.slice(1);
const endpoint=(import.meta.env.PROD?'/api':'/xdrive-api')+'/driver/availability-profile';

export default function AvailabilityStatusPwa({token}:{token:string}){
  const [current,setCurrent]=useState<Availability|null>(null);
  const [selected,setSelected]=useState<Availability>('offline');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [review,setReview]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');setSuccess('');setCurrent(null);
    void fetch(endpoint,{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json().catch(()=>({})) as {error?:string;driver?:{availability_status?:unknown}};
        if(!response.ok||!data.driver)throw Error(data.error||'Your availability could not be verified.');
        const state=validStatus(data.driver.availability_status);
        if(!state)throw Error('The server returned an unrecognised availability status.');
        if(!controller.signal.aborted){setCurrent(state);setSelected(state);}
      }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Availability unavailable.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[token]);

  const save=async()=>{
    if(saving||loading||current===null)return;
    setSaving(true);setError('');setSuccess('');
    try{
      const response=await fetch(endpoint,{
        method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({availabilityStatus:selected}),
      });
      const data=await response.json().catch(()=>({})) as {error?:string;driver?:{availability_status?:unknown}};
      if(!response.ok||!data.driver)throw Error(data.error||'The server did not confirm your status.');
      const confirmed=validStatus(data.driver.availability_status);
      if(!confirmed||confirmed!==selected)throw Error('The server returned a different availability status. Refresh before retrying.');
      setCurrent(confirmed);setReview(false);setSuccess('Availability confirmed by XDrive: '+name(confirmed)+'.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Availability could not be updated.');}
    finally{setSaving(false);}
  };
  return <div className="xd-native-more-panel" aria-label="Driver availability status">
    <p className="xd-native-more-muted">Your driver status controls whether you can publish vehicle availability. Job GPS tracking remains a separate setting.</p>
    {loading&&<p role="status">Loading your authorised availability…</p>}
    {!loading&&current!==null&&<>
      <p><strong>Current status: {name(current)}</strong></p>
      <label className="xd-native-more-field">Change availability
        <select value={selected} onChange={e=>{setSelected(e.target.value as Availability);setReview(false);setSuccess('');}}>
          <option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option>
        </select>
      </label>
      {selected!==current&&!review&&<button type="button" disabled={saving} onClick={()=>setReview(true)}>Review status change</button>}
      {review&&<section className="xd-native-more-record" aria-label="Confirm availability change">
        <strong>Change status to {name(selected)}?</strong>
        {selected!=='available'&&<span>Any active published vehicle availability will be withdrawn by XDrive.</span>}
        {selected==='available'&&<span>This does not automatically publish your precise location to other members.</span>}
        <div><button type="button" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Confirm status'}</button>
          <button type="button" disabled={saving} onClick={()=>setReview(false)}>Cancel</button></div>
      </section>}
    </>}
    {error&&<p role="alert">{error}</p>}
    {success&&<p role="status">{success}</p>}
  </div>;
}
