'use client';
import type {ReactNode} from 'react';
import type {CxDateParts} from '../../components/workspace/CxLoadCard';
import CxQuoteCard from '../../components/workspace/CxQuoteCard';

export default function ApprovedDriverQuoteCard({
 routeFrom,routeTo,pickup,delivery,band,sold=false,postedAt,service,loadId,vehicle,stage,
 expanded=false,expandedContent,footer,paymentTerms,
}:{
 routeFrom:ReactNode;routeTo:ReactNode;pickup:CxDateParts;delivery:CxDateParts;
 band:ReactNode;sold?:boolean;postedAt?:ReactNode;service:ReactNode;
 loadId:ReactNode;vehicle:string;stage?:string;expanded?:boolean;
 expandedContent?:ReactNode;footer:ReactNode;paymentTerms?:ReactNode;
}) {
 return <CxQuoteCard
  routeFrom={routeFrom} routeTo={routeTo} pickup={pickup} delivery={delivery}
  band={band} sold={sold} postedAt={postedAt} service={service}
  loadId={loadId} vehicle={vehicle} stage={stage} expanded={expanded}
  expandedContent={expandedContent} footer={footer} paymentTerms={paymentTerms}
 />;}
