import type {ReactNode} from "react";

export type XDriveCardData = {
 id:string;from:string;to:string;date:string;status:string;vehicle:string;
 cargo:string;weight:string;packaging?:string;paymentTerms?:string;
 collection?:string;delivery?:string;company?:string;memberId?:string;
 equipment?:string;dimensions?:string;
};
export default function XDriveLoadCard({data,onDetails,actions,extra}:{data:XDriveCardData;onDetails:()=>void;actions?:ReactNode;extra?:ReactNode}){
 const d=new Date(data.date+"T12:00:00Z");
 const day=Number.isNaN(d.getTime())?"--":d.toLocaleDateString("en-GB",{weekday:"short",timeZone:"UTC"});
 const date=Number.isNaN(d.getTime())?"TBC":d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",timeZone:"UTC"});
 return <article className="xd-board-card xd-shared-job-card">
  <div className="xd-card-date"><span>{day}</span><strong>{date}</strong><em className={/next|allocated|progress/i.test(data.status)?"blue":"green"}>{data.status}</em></div>
  <div className="xd-card-main">
   <h3><span>📍 {data.from.toUpperCase()}</span><i>→</i><span>📍 {data.to.toUpperCase()}</span></h3>
   <p className="xd-card-distance">Collection: {data.collection||data.date} | Delivery: {data.delivery||"ASAP"}</p>
   <div className="xd-card-facts"><span>🚚 {data.vehicle}</span><span>▣ {data.cargo}</span><span>⚖ {data.weight}</span><span>▣ {data.packaging||"General Freight"}</span></div>
   {(data.equipment||data.dimensions)&&<p className="xd-card-distance">{data.equipment&&<>Required: {data.equipment}</>}{data.dimensions&&<> | Dimensions: {data.dimensions}</>}</p>}
   <p className="xd-card-terms">▤ Ref: {data.id} | <b>Payment Terms:</b> {data.paymentTerms||"See booking details"}</p>
  </div>
  <div className="xd-card-company"><small>{data.company?"Posted by":"Booking status"}</small><strong>{data.company||data.status}</strong>{data.memberId&&<span>Member ID: {data.memberId}</span>}<div className="xd-card-actions"><button onClick={onDetails}>View Details</button>{actions}</div>{extra}</div>
 </article>;
}
