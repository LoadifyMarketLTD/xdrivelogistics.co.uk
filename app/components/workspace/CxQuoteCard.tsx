'use client';

import type { ReactNode } from 'react';
import type { CxDateParts } from './CxLoadCard';
import Master3150Card from './Master3150Card';

/** Approved 3150 quote card using real quote workflow controls. */
export default function CxQuoteCard({
  routeFrom, routeTo, pickup, delivery, band, sold = false,
  postedAt, service, loadId, vehicle, stage,
  expanded = false, expandedContent, footer, paymentTerms,
}: {
  routeFrom: ReactNode;
  routeTo: ReactNode;
  pickup: CxDateParts;
  delivery: CxDateParts;
  band: ReactNode;
  sold?: boolean;
  postedAt?: ReactNode;
  service: ReactNode;
  loadId: ReactNode;
  vehicle: string;
  stage?: string;
  expanded?: boolean;
  expandedContent?: ReactNode;
  footer: ReactNode;
  paymentTerms?: ReactNode;
}) {
  return <Master3150Card
    mode="quote"
    className="xdrive-cx-quote-card"
    mainClassName="xdrive-cx-quote-card__main"
    routeClassName="xdrive-cx-quote-card__route"
    timesClassName="xdrive-cx-quote-card__times"
    statusClassName="xdrive-cx-quote-card__status"
    footerClassName="xdrive-cx-quote-card__footer"
    from={routeFrom}
    to={routeTo}
    pickup={pickup}
    delivery={delivery}
    band={sold ? 'SOLD' : band}
    sold={sold}
    posted={service}
    postedAt={postedAt}
    loadId={loadId}
    vehicle={vehicle}
    terms={paymentTerms}
    state={stage}
    stage={stage}
    footer={footer}
    expanded={expanded}
    expandedContent={<div className="xdrive-cx-quote-card__expanded-cx">{expandedContent}</div>}
  />;
}
