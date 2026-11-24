import {useEffect,useState} from 'react';
import './OriginalMorePwa.css';

type Member = { name?:unknown; memberId?:unknown; memberType?:unknown; city?:unknown; vehicleTypes?:unknown };
type Position = { scope?:unknown; member_name?:unknown; member_code?:unknown; member_type?:unknown; vehicle_type?:unknown; available_until?:unknown; distance_miles?:unknown };
const safeText=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim().slice(0,120):null;
const safeMemberId=(value:unknown)=>{const id=safeText(value);return id&&!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)?id:null;};
const apiPath=(suffix:string)=>(import.meta.env.PROD?'/api':'/xdrive-api')+suffix;

export default function MemberDiscoveryPwa({token,mode}:{token:string;mode:'nearby'|'directory'}) {
  const [rows,setRows]=useState<Array<{name:string;code:string|null;detail:string}>>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [partial,setPartial]=useState(false);
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');setRows([]);setPartial(false);
    const endpoint=mode==='directory'?'/directory':'/availability/nearby?scope=exchange';
    void fetch(apiPath(endpoint),{
      method:'GET',headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store',
    }).then(async(response)=>{
      const data=await response.json().catch(()=>({})) as Record<string,unknown>;
      if(!response.ok)throw Error(safeText(data.error)||'Member information is unavailable (HTTP '+response.status+').');
      if(mode==='directory'){
        if(!Array.isArray(data.companies))throw Error('Directory response could not be verified.');
        const companies=data.companies as Member[];
        setRows(companies.slice(0,100).flatMap(member=>{
          const name=safeText(member.name);
          if(!name)return [];
          const type=safeText(member.memberType)||'Member';
          const city=safeText(member.city);
          return [{name,code:safeMemberId(member.memberId),detail:[type,city].filter(Boolean).join(' · ')}];
        }));
        setPartial(data.partial===true||companies.length>100);
      }else{
        if(!Array.isArray(data.positions))throw Error('Live availability response could not be verified.');
        const positions=data.positions as Position[];
        setRows(positions.filter(p=>p.scope==='exchange').slice(0,100).flatMap(position=>{
          const name=safeText(position.member_name);
          if(!name)return [];
          const vehicle=safeText(position.vehicle_type)||'Vehicle not specified';
          const type=safeText(position.member_type);
          const miles=typeof position.distance_miles==='number'&&Number.isFinite(position.distance_miles)?position.distance_miles.toFixed(1)+' mi':'';
          return [{name,code:safeMemberId(position.member_code),detail:[type,vehicle,miles].filter(Boolean).join(' · ')}];
        }));
        setPartial(positions.length>100);
      }
    }).catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Could not load authorised member information.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[token,mode,refresh]);

  return <div className="xd-native-more-panel" aria-label={mode==='directory'?'Member directory':'Nearby available members'}>
    <p className="xd-native-more-muted">{mode==='directory'?'Active XDrive trading members.':'Available Exchange members; precise vehicle locations remain private.'}</p>
    <button type="button" className="xd-native-more-back" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh</button>
    {loading&&<p role="status">Loading authorised members…</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!error&&rows.length===0&&<p>No members are currently returned for your authorised view.</p>}
    {!loading&&!error&&rows.map((member,index)=><div className="xd-native-more-record" key={member.code||member.name+'-'+index}>
      <strong>{member.name}</strong>
      {member.code&&<span>Member ID: {member.code}</span>}
      <span>{member.detail}</span>
    </div>)}
    {!loading&&!error&&partial&&<p className="xd-native-more-muted">More members may be available; results are limited.</p>}
  </div>;
}
