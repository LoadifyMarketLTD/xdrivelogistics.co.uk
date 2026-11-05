'use client';
import type { ReactNode } from 'react';
import ApprovedDriverOperationalCard from '../_components/ApprovedDriverOperationalCard';

type DateParts={primary:ReactNode;meta?:ReactNode};
export default function ApprovedDriverDiaryCard({
 from,to,pickup,delivery,band,statusLine,statusStamp,loadId,vehicle,footer,
 expanded=false,expandedMeta,expandedContent,secondaryContent,children,className='',
 state,stage,dataState,footerRole,footerAriaLabel,onDetails,
}:{
 from:ReactNode;to:ReactNode;pickup:DateParts;delivery:DateParts;band:ReactNode;
 statusLine:ReactNode;statusStamp?:ReactNode;loadId:ReactNode;vehicle:string;
 footer:ReactNode;expanded?:boolean;expandedMeta?:ReactNode;
 expandedContent?:ReactNode;secondaryContent?:ReactNode;children?:ReactNode;
 className?:string;state?:string;stage?:string;dataState?:string;dataStage?:string;
 footerRole?:string;footerAriaLabel?:string;footerClassName?:string;
 onDetails:()=>void;
}){
 return <ApprovedDriverOperationalCard mode="diary" from={from} to={to} pickup={pickup} delivery={delivery}
   band={band} member={statusLine} vehicle={vehicle} loadId={loadId}
   state={dataState??state??stage} className={`xd-approved-diary-card ${className}`}
   facts={<span>{statusStamp}</span>} expanded={expanded}
   footer={<div className="xd-approved-diary-footer" role={footerRole} aria-label={footerAriaLabel}>
     <button type="button" className="xd-approved-view-details" onClick={onDetails}
       aria-expanded={expanded}>{expanded?'Hide Details':'View Details'}</button>
     {footer}
   </div>}
   expandedContent={<>{expandedMeta}{expandedContent}{secondaryContent}</>}
 >{children}</ApprovedDriverOperationalCard>;
}
