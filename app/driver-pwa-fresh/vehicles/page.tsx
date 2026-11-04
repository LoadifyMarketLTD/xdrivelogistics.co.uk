'use client';
import {useCallback,useEffect,useState} from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import {useAuth} from '../../components/AuthContext';
import {readRouteAuthAccessToken} from '../../../lib/routeAuthCookie';
import {FreshBottom,FreshHeader} from '../FreshNavigation';

type Van={id:string;type:string|null;reg_plate:string|null;make:string|null;model:string|null;payload_kg:number|null;pallets_capacity:number|null;has_tail_lift:boolean|null};
export default function DriverVan(){
 const {user,isLoading:authLoading}=useAuth();
 const [vehicles,setVehicles]=useState<Van[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setLoading(true);setError('');
  try{
   const token=await readRouteAuthAccessToken();
   if(!token)throw new Error('Sign in to view your van.');
   const response=await fetch('/api/driver/vehicles',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
   const data=await response.json().catch(()=>({})) as {vehicles?:Van[];canonicalVehicleId?:string|null;error?:string};
   if(!response.ok)throw new Error(data.error||'Cannot retrieve your registered vehicle.');
   setVehicles(data.vehicles??[]);setActiveId(data.canonicalVehicleId??null);
  }catch(reason){setError(reason instanceof Error?reason.message:'Unable to load your vehicle.');}
  finally{setLoading(false);}
 },[user?.id]);
 useEffect(()=>{if(!authLoading&&user?.id)void refresh();else if(!authLoading)setLoading(false);},[authLoading,user?.id,refresh]);
 return <ProtectedRoute allowedRoles={['driver']}>
  <FreshHeader title="My Van"/>
  <main className="fresh-content" data-testid="driver-pwa-real-vehicles">
   {loading?<p className="fresh-message" role="status">Loading your registered van...</p>:null}
   {error?<p className="fresh-message" role="alert">{error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>:null}
   {!loading&&!error&&vehicles.length===0?<p className="fresh-message">No van assigned to this Driver account. Ask your company administrator to assign the vehicle.</p>:null}
   {!loading&&!error&&vehicles.map(van=><article className="fresh-card" key={van.id}>
    <section className="fresh-summary"><div className="fresh-summary-top"><strong>{[van.make,van.model].filter(Boolean).join(' ')||van.type||'Registered van'}</strong><span className="fresh-available">{van.id===activeId?'Active van':'Registered'}</span></div><div className="fresh-posted">Registration: {van.reg_plate||'Not recorded'}</div></section>
    <section className="fresh-quick"><p><strong>Vehicle:</strong> {van.type?van.type.split('_').map(segment=>segment.charAt(0).toUpperCase()+segment.slice(1)).join(' '):'Not recorded'}</p><p><strong>Payload:</strong> {van.payload_kg!=null?`${van.payload_kg} kg`:'Not recorded'}</p><p><strong>Pallet capacity:</strong> {van.pallets_capacity??'Not recorded'}</p><p><strong>Tail lift:</strong> {van.has_tail_lift===null?'Not specified':van.has_tail_lift?'Yes':'No'}</p></section>
   </article>)}
  </main>
  <FreshBottom active="jobs"/>
 </ProtectedRoute>;
}
