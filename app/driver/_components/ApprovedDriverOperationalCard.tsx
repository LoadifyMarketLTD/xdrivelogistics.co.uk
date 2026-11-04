'use client';
import type { ReactNode } from 'react';
import type { CxDateParts } from '../../components/workspace/CxLoadCard';

export type ApprovedDriverCardProps = {
  from: ReactNode;
  to: ReactNode;
  pickup: CxDateParts;
  delivery: CxDateParts;
  band: ReactNode;
  loadId: ReactNode;
  vehicle: string;
  member: ReactNode;
  footer: ReactNode;
  expanded?: boolean;
  expandedContent?: ReactNode;
  facts?: ReactNode;
  paymentTerms?: ReactNode;
  postedAt?: ReactNode;
  className?: string;
  state?: string;
  children?: ReactNode;
};

export default function ApprovedDriverOperationalCard({
  from, to, pickup, delivery, band, loadId, vehicle, member, footer,
  expanded, expandedContent, facts, paymentTerms, postedAt, className='', state, children,
}: ApprovedDriverCardProps) {
  return <article className={`xd-board-card xd-shared-job-card xd-approved-live-card ${className}`} data-state={state}>
    <div className="xd-card-date">
      <span>COLLECT</span>
      <strong>{pickup.primary}</strong>
      <small>{pickup.meta}</small>
      <em>{band}</em>
    </div>
    <div className="xd-card-main">
      <h3><span>{from}</span><i aria-hidden="true">→</i><span>{to}</span></h3>
      <p className="xd-card-distance"><strong>Collection:</strong> {pickup.primary} {pickup.meta} <b className="xd-card-divider">|</b> <strong>Delivery:</strong> {delivery.primary} {delivery.meta}</p>
      <div className="xd-card-facts"><span>{vehicle}</span>{facts}</div>
      <p className="xd-card-terms"><b>Ref:</b> {loadId} <b className="xd-card-divider">|</b> <b>Payment Terms:</b> {paymentTerms ?? 'See booking details'}</p>
    </div>
    <div className="xd-card-company">
      <small>Booking / member</small>
      <strong>{member}</strong>
      {postedAt && <small>{postedAt}</small>}
    </div>
    <div className="xd-approved-live-footer">{footer}</div>
    {expanded && expandedContent && <div className="xd-approved-live-details">{expandedContent}</div>}
    {children}
  </article>;
}
