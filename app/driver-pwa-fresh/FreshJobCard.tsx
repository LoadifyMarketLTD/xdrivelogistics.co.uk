'use client';
import Link from 'next/link';

export type Load = {
  id:string; status:string; pickup_area:string; pickup_postcode_area:string|null;
  delivery_area:string; delivery_postcode_area:string|null;
  pickup_datetime:string|null; delivery_datetime:string|null;
  pickup_time_slot:string|null; delivery_time_slot:string|null;
  vehicle_type:string|null; requested_vehicle_label:string|null; requested_vehicle_type:string|null;
  service_mode:string|null; public_quote_notes:string|null;
  distance_to_pickup_miles:number|null; distance_to_delivery_miles:number|null;
  distance_miles:number|null; weight_kg:number|null; pallets:number|null;
  payment_terms:string|null; exchange_posted_at:string|null;
  member:{name:string;postedBy:string|null}|null;
  myBid?:{id?:string;status:string|null;amount:number|null}|null;
};
const locationLabel=(town:string,outcode:string|null)=>{
 const t=(town||'').trim(),p=(outcode||'').trim();
 return t&&p&&!t.toUpperCase().includes(p.toUpperCase())?t+' '+p:t||p||'Location not supplied';
};
const when=(raw:string|null,slot:string|null)=>{
 let value='Time not specified';
 if(raw){const d=new Date(raw);if(!Number.isNaN(d.getTime()))value=d.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
 return slot?[value,slot].filter(Boolean).join(' · '):value;
};
export default function FreshJobCard({load,mode='jobs',actions,headerOnly=false}:{load:Load;mode?:'jobs'|'quotes'|'bookings'|'preview';actions?:React.ReactNode;headerOnly?:boolean}){
 const title=load.member?.postedBy||load.member?.name||'Company unavailable';
 const quote=mode==='quotes',service=load.service_mode||'Courier';
 const details=mode==='preview'?'/driver-pwa-fresh/visual-preview/details?load='+encodeURIComponent(load.id):'/driver-pwa-fresh/jobs/'+encodeURIComponent(load.id);
 const quoteHref=mode==='preview'?'/driver-pwa-fresh/visual-preview/quote?load='+encodeURIComponent(load.id):details+'#quote';
 return <article className="fresh-card fresh-exchange-card" data-testid="load-card">
  <section className="fresh-exchange-top" data-testid="load-summary">
   <div className="fresh-exchange-company"><small>{quote?'QUOTED TO':'POSTED BY'}</small><strong>{title}</strong>{load.exchange_posted_at&&<span>Posted {when(load.exchange_posted_at,null)}</span>}</div>
   <span className="fresh-exchange-badge">{quote?(load.myBid?.status||'Submitted'):service}</span>
  </section>
  <section className="fresh-exchange-route" data-testid="load-route">
   <div><small>COLLECTION</small><strong>{locationLabel(load.pickup_area,load.pickup_postcode_area)}</strong><span>{when(load.pickup_datetime,load.pickup_time_slot)}</span></div>
   <span className="fresh-exchange-arrow" aria-hidden="true">→</span>
   <div><small>DELIVERY</small><strong>{locationLabel(load.delivery_area,load.delivery_postcode_area)}</strong><span>{when(load.delivery_datetime,load.delivery_time_slot)}</span></div>
  </section>
  {!headerOnly&&<>
   <section className="fresh-exchange-quick">
    {(load.requested_vehicle_label||load.vehicle_type||load.requested_vehicle_type)&&<span>{load.requested_vehicle_label||load.vehicle_type||load.requested_vehicle_type}</span>}
    {load.pallets!=null&&<span>{load.pallets} pallets</span>}
    {load.weight_kg!=null&&<span>{load.weight_kg} kg</span>}
    {load.distance_miles!=null&&<span>{load.distance_miles} miles</span>}
   </section>
   {load.public_quote_notes&&<p className="fresh-exchange-notes" data-testid="load-notes">{load.public_quote_notes}</p>}
   {load.payment_terms&&<div className="fresh-exchange-payment"><span>Payment Terms</span><strong>{load.payment_terms}</strong></div>}
   <div className="fresh-exchange-actions">{actions??((mode==='jobs'||mode==='preview')?<><Link className="quote-now" href={quoteHref}>Quote Now</Link><Link className="fresh-detail" href={details}>View Details</Link></>:null)}</div>
  </>}
 </article>;
}
