'use client';
import type { ReactNode } from 'react';
import CxDiaryCard from '../../components/workspace/CxDiaryCard';

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
 return <CxDiaryCard
   from={from} to={to} pickup={pickup} delivery={delivery}
   band={band} statusLine={statusLine} statusStamp={statusStamp}
   vehicle={vehicle} loadId={loadId}
   state={dataState??state??stage} stage={stage}
   className={`xd-approved-diary-card ${className}`}
   expanded={expanded}
   footerRole={footerRole} footerAriaLabel={footerAriaLabel}
   footer={<div className="xd-approved-diary-footer" role="toolbar" aria-label={footerAriaLabel}>
     <button type="button" className="xd-approved-view-details" onClick={onDetails}
       aria-expanded={expanded}>{expanded?'Hide Details':'View Details'}</button>
     {footer}
   </div>}
   expandedMeta={expandedMeta}
   expandedContent={expandedContent}
   secondaryContent={secondaryContent}
 >{children}</CxDiaryCard>;}
