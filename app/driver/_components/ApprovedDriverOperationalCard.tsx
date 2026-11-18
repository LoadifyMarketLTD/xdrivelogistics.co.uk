'use client';
import type { ReactNode } from 'react';
import type { CxDateParts } from '../../components/workspace/CxLoadCard';
import Master3150Card, { type Master3150CardMode } from '../../components/workspace/Master3150Card';

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
  mode?: Master3150CardMode;
};

/**
 * Authenticated Driver workspace adapter to the same approved 3150 card used
 * by Company, Customer and Broker. Operational handlers are supplied by the
 * caller and are never simulated or copied from preview components.
 */
export default function ApprovedDriverOperationalCard({
  from, to, pickup, delivery, band, loadId, vehicle, member, footer,
  expanded, expandedContent, facts, paymentTerms, postedAt, className='', state,
  children, mode='load',
}: ApprovedDriverCardProps) {
  return <Master3150Card
    mode={mode}
    className={`xd-approved-live-card ${className}`}
    mainClassName="xd-card-main"
    statusClassName="xd-card-company"
    footerClassName="xd-approved-live-footer"
    from={from}
    to={to}
    pickup={pickup}
    delivery={delivery}
    band={band}
    loadId={loadId}
    vehicle={vehicle}
    posted={member}
    postedAt={postedAt}
    facts={facts}
    terms={paymentTerms ?? 'See booking details'}
    footer={footer}
    expanded={expanded}
    expandedContent={expandedContent ? <div className="xd-approved-live-details">{expandedContent}</div> : null}
    extra={children}
    state={state}
  />;
}
