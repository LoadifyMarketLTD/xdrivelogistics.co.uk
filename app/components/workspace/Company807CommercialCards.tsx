'use client';

import type { ComponentProps, ReactNode } from 'react';
import type CxLoadCard from './CxLoadCard';
import type CxQuoteCard from './CxQuoteCard';
import type CxDiaryCard from './CxDiaryCard';
import type { JobRow } from '../../../lib/jobs/jobOperationalContract';
import XDriveTransportOverview from './XDriveTransportOverview';
import './xdrive-role-807-card.css';
import './master3150-record-card.css';

// Company-only adapter of the recovered 807 XDriveLoadCard anatomy.
// No demo provider, network requests, permissions or commercial mutations.
function Card({reference, date, overview, footer, children, className='', state, stage, footerClass='', footerRole, footerAriaLabel}: {
 reference: ReactNode; date?: ReactNode; overview: ReactNode; footer?: ReactNode; children?: ReactNode;
 className?: string; state?: string; stage?: string; footerClass?: string; footerRole?: string; footerAriaLabel?: string;
}) {
 return <article className={'xdrive-role-807-card xd-shared-job-card '+className} data-presentation="xdrive807" data-master-reference="807" data-company-807="true" data-state={state} data-stage={stage}>
  <div className="xd-card-context">{date && <strong>{date}</strong>}<span className="xd-card-context__ref">Ref: {reference}</span></div>
  {overview}
  {footer && <div className={'xd-card-actions master3150-record__full-footer '+footerClass} role={footerRole} aria-label={footerAriaLabel}>{footer}</div>}
  {children}
 </article>;
}
export function Company807LoadCard(p: ComponentProps<typeof CxLoadCard>) {
 return <Card reference={p.loadId} date={p.pickup.meta} className={'xdrive-cx-load-card '+(p.className||'')} state={p.dataState} footer={p.footer} footerClass="xdrive-cx-load-footer" overview={<XDriveTransportOverview tone="load" from={p.from} to={p.to} pickup={p.pickup} delivery={p.delivery} status={p.band} member={p.posted} stamp={p.postedAt} vehicle={p.vehicle} extraRoute={p.routeMeta} details={p.freight} requirements={p.paymentTerms ? <div><span>Payment terms</span><strong>{p.paymentTerms}</strong></div> : undefined}/> }>
  {p.expanded && <div className="xd-card-expanded">{p.commercial && <div className="xdrive-cx-load-card__commercial">{p.commercial}</div>}{p.notes && <div className="xdrive-cx-load-card__notes">{p.notes}</div>}</div>}
 </Card>;
}
export function Company807QuoteCard(p: ComponentProps<typeof CxQuoteCard>) {
 return <Card reference={p.loadId} date={p.pickup.meta} className="xdrive-cx-quote-card" state={p.stage} stage={p.stage} footer={p.footer} footerClass="xdrive-cx-quote-card__footer" overview={<XDriveTransportOverview tone="quote" from={p.routeFrom} to={p.routeTo} pickup={p.pickup} delivery={p.delivery} status={p.sold?'SOLD':p.band} caption={p.stage} member={p.service} stamp={p.postedAt} vehicle={p.vehicle} requirements={p.paymentTerms ? <div><span>Payment terms</span><strong>{p.paymentTerms}</strong></div> : undefined}/> }>
  {p.expanded && <div className="xd-card-expanded xdrive-cx-quote-card__expanded-cx">{p.expandedContent}</div>}
 </Card>;
}
export function Company807DiaryCard(p: ComponentProps<typeof CxDiaryCard>) {
 return <Card reference={p.loadId} date={p.pickup.meta} className={'workspace-operational-row xdrive-cx-diary-card '+(p.className||'')} state={p.dataState??p.state} stage={p.dataStage??p.stage} footer={p.footer} footerClass={'xdrive-cx-diary-card__footer '+(p.footerClassName||'')} footerRole={p.footerRole} footerAriaLabel={p.footerAriaLabel} overview={<XDriveTransportOverview tone="diary" from={p.from} to={p.to} pickup={p.pickup} delivery={p.delivery} status={p.band} member={p.statusLine} stamp={p.statusStamp} vehicle={p.vehicle} requirements={p.paymentTerms ? <div><span>Payment terms</span><strong>{p.paymentTerms}</strong></div> : undefined}/> }>
  {p.expanded && <div className="xd-card-expanded">{p.expandedMeta && <div className="xdrive-cx-diary-card__expanded-meta">{p.expandedMeta}</div>}{p.expandedContent}{p.secondaryContent}</div>}{p.children}
 </Card>;
}
export function Company807BookingCard({enabled,job,driver,legacyClass,children,statusLabel}: {enabled:boolean;job:JobRow;driver:string;legacyClass:string;children:ReactNode;statusLabel:string}) {
 if(!enabled) return <div className={legacyClass} data-testid="jobs-mobile-card">{children}</div>;
 return <Card reference={job.jobRef} date={job.pickup.date} className="company-807-booking-card" state={job.status} overview={<XDriveTransportOverview tone="diary" from={[job.pickup.location,job.pickup.postcode].filter(Boolean).join(' ')} to={[job.delivery.location,job.delivery.postcode].filter(Boolean).join(' ')} pickup={{primary:job.pickup.time||'Not supplied',meta:job.pickup.date}} delivery={{primary:job.delivery.time||'Not supplied',meta:job.delivery.date}} status={statusLabel} member={<>{job.client.name||"Not supplied"}{job.clientPhone && <small> | {job.clientPhone}</small>}</>} caption={driver} vehicle={job.vehicleType||'Not supplied'} details={<><div><span>Cargo</span><strong>{job.cargo?.type ? (job.cargo.quantity>0?job.cargo.quantity+' x ':'')+job.cargo.type : 'Not supplied'}</strong></div><div><span>Distance</span><strong>{job.distanceMiles||'Not supplied'}</strong></div>{job.createdAt && <div><span>Created</span><strong>{job.createdAt}</strong></div>}{job.exchange_visibility && job.exchange_visibility!=='private' && <div><span>Visibility</span><strong>{job.exchange_visibility}</strong></div>}</>} requirements={<div><span>Payment terms</span><strong>{job.paymentTerms||'Not supplied'}</strong></div>}/> }>{children}</Card>;
}