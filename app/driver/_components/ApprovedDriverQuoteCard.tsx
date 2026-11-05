'use client';
import type {ReactNode} from 'react';
import type {CxDateParts} from '../../components/workspace/CxLoadCard';
import ApprovedDriverOperationalCard from './ApprovedDriverOperationalCard';

export default function ApprovedDriverQuoteCard({
 routeFrom,routeTo,pickup,delivery,band,sold=false,postedAt,service,loadId,vehicle,stage,
 expanded=false,expandedContent,footer,paymentTerms,
}:{
 routeFrom:ReactNode;routeTo:ReactNode;pickup:CxDateParts;delivery:CxDateParts;
 band:ReactNode;sold?:boolean;postedAt?:ReactNode;service:ReactNode;
 loadId:ReactNode;vehicle:string;stage?:string;expanded?:boolean;
 expandedContent?:ReactNode;footer:ReactNode;paymentTerms?:ReactNode;
}) {
 return <ApprovedDriverOperationalCard
  from={routeFrom} to={routeTo} pickup={pickup} delivery={delivery}
  band={sold?'SOLD':band} member={service} postedAt={postedAt}
  loadId={loadId} vehicle={vehicle} paymentTerms={paymentTerms}
  facts={<span>Quote: {stage??'Submitted'}</span>} state={stage}
  footer={footer} expanded={expanded} expandedContent={expandedContent}
  className="xd-approved-quote-card"
 />;
}
