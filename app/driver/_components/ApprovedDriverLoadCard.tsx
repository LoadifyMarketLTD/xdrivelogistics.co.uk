'use client';
import type { ReactNode } from 'react';
import type { CxDateParts } from '../../components/workspace/CxLoadCard';
import CxLoadCard from '../../components/workspace/CxLoadCard';

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
 return <CxLoadCard
  from={from} to={to} pickup={pickup} delivery={delivery} band={band}
  posted={posted} postedAt={postedAt} loadId={loadId} vehicle={vehicle}
  paymentTerms={paymentTerms} footer={footer} expanded={expanded}
  dataState={dataState} className={`xd-approved-live-card ${className}`}
  freight={freight && <div className="xd-approved-freight-list">{freight}</div>}
  commercial={commercial && <div className="xd-approved-freight-list">{commercial}</div>}
  notes={notes && <div className="xd-approved-freight-list">{notes}</div>}
 />;}
