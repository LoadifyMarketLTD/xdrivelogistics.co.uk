'use client';
import type { ReactNode } from 'react';
import type { CxDateParts } from '../../components/workspace/CxLoadCard';
import ApprovedDriverOperationalCard from './ApprovedDriverOperationalCard';

export default function ApprovedDriverLoadCard({
  from,to,pickup,delivery,band,posted,postedAt,loadId,vehicle,
  expanded=false,freight,commercial,notes,footer,className='',dataState,paymentTerms,
}:{
  from:ReactNode;to:ReactNode;routeMeta?:ReactNode;
  pickup:CxDateParts;delivery:CxDateParts;band:ReactNode;
  posted:ReactNode;postedAt?:ReactNode;loadId:ReactNode;vehicle:string;
  expanded?:boolean;freight?:ReactNode;commercial?:ReactNode;notes?:ReactNode;
  footer:ReactNode;className?:string;dataState?:string;paymentTerms?:ReactNode;
}) {
 return <ApprovedDriverOperationalCard
  from={from} to={to} pickup={pickup} delivery={delivery} band={band}
  member={posted} postedAt={postedAt} loadId={loadId} vehicle={vehicle}
  paymentTerms={paymentTerms} footer={footer} expanded={expanded}
  state={dataState} className={className}
  facts={<span>Live exchange load</span>}
  expandedContent={<div className="xd-approved-freight-details">
    {freight && <div className="xd-approved-freight-list">{freight}</div>}
    {commercial && <div className="xd-approved-freight-list">{commercial}</div>}
    {notes && <div className="xd-approved-freight-list">{notes}</div>}
  </div>}
 />;
}
