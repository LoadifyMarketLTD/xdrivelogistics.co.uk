import type {ReactNode} from "react";
import XDriveTransportOverview from "../../components/workspace/XDriveTransportOverview";
import "../../components/workspace/xdrive-role-807-card.css";

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
 return <article className="xdrive-role-807-card xd-shared-job-card" data-presentation="xdrive807" data-master-reference="807">
  <div className="xd-card-context"><strong>{day} {date}</strong><span className="xd-card-context__ref">Ref: {data.id}</span></div>
  <XDriveTransportOverview
   tone="load" from={data.from} to={data.to}
   pickup={{primary:data.collection||data.date||"TBC"}} delivery={{primary:data.delivery||"ASAP"}}
   status={data.status} member={data.company||undefined} vehicle={data.vehicle}
   stamp={data.memberId?"Member ID: "+data.memberId:undefined}
   details={<><div><span>Cargo</span><strong>{data.cargo}</strong></div><div><span>Weight</span><strong>{data.weight}</strong></div><div><span>Packaging</span><strong>{data.packaging||"General Freight"}</strong></div></>}
   requirements={<><div><span>Payment terms</span><strong>{data.paymentTerms||"See booking details"}</strong></div>{data.equipment&&<div><span>Equipment</span><strong>{data.equipment}</strong></div>}{data.dimensions&&<div><span>Dimensions</span><strong>{data.dimensions}</strong></div>}</>}
  />
  <div className="xd-card-actions master3150-record__full-footer">
   <button onClick={onDetails}>View Details</button>{actions}
  </div>
  {extra}
 </article>;
}
