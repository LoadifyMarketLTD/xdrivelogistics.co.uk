'use client';
type Detail={id:string;requested_vehicle_label:string|null;vehicle_type:string|null;distance_miles:number|null;weight_kg:number|null;pallets:number|null;cargo_type:string|null;requested_cargo_label:string|null;length_cm:number|null;width_cm:number|null;height_cm:number|null;payment_terms:string|null;public_quote_notes:string|null;member:{name:string;memberId:string|null}|null};
export default function CxLoadFacts({load}:{load:Detail}){
 const vehicle=load.requested_vehicle_label||load.vehicle_type||'Not specified';
 return <section className="cx-load-facts" aria-label="Load information">
  <div className="cx-load-type"><strong>Load details</strong><span>{vehicle}</span></div>
  <div className="cx-fact-lines">
   <div><span>Veh:</span><strong>{vehicle}</strong></div>
   {load.distance_miles!=null&&<div><span>Dist:</span><strong>{load.distance_miles.toFixed(2)} miles</strong></div>}
   {(load.requested_cargo_label||load.cargo_type)&&<div><span>Cargo:</span><strong>{load.requested_cargo_label||load.cargo_type}</strong></div>}
   {load.weight_kg!=null&&<div><span>Weight:</span><strong>{load.weight_kg} kg</strong></div>}
   {load.pallets!=null&&<div><span>Packaging:</span><strong>{load.pallets} pallets</strong></div>}
   {load.length_cm!=null&&load.width_cm!=null&&load.height_cm!=null&&<div><span>Dims:</span><strong>{load.length_cm} × {load.width_cm} × {load.height_cm} cm</strong></div>}
  </div>
  <div className="cx-load-company"><div><span>Cust:</span><strong>{load.member?.name||'Marketplace member'} {load.member?.memberId?'('+load.member.memberId+')':''}</strong></div><div><span>Terms:</span><strong>{load.payment_terms||'Not specified'}</strong></div></div>
  <div className="cx-load-notes"><strong>Notes:</strong><p>{load.public_quote_notes||'No additional collection or delivery instructions.'}</p></div>
 </section>;
}
