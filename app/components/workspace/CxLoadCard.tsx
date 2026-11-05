'use client';

import type { ReactNode } from 'react';
import Master3150Card from './Master3150Card';

export type CxDateParts = { primary: ReactNode; meta?: ReactNode };
export function cxDateParts(value: string | null | undefined, fallback = 'ASAP'): CxDateParts {
  if (!value) return { primary: fallback, meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: 'Not set', meta: '' };
  const zone = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' })
    .formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return {
    primary: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    meta: `${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}`,
  };
}

/**
 * The approved 3150 shared card for all authenticated Loads.
 * Retains every real operational handler passed through footer and details.
 */
export default function CxLoadCard({
  from, to, routeMeta, pickup, delivery, band, posted, postedAt,
  loadId, vehicle, expanded = false, freight, commercial, notes,
  footer, className = '', dataState, paymentTerms,
}: {
  from: ReactNode;
  to: ReactNode;
  routeMeta?: ReactNode;
  pickup: CxDateParts;
  delivery: CxDateParts;
  band: ReactNode;
  posted: ReactNode;
  postedAt?: ReactNode;
  loadId: ReactNode;
  vehicle: string;
  expanded?: boolean;
  freight?: ReactNode;
  commercial?: ReactNode;
  notes?: ReactNode;
  footer: ReactNode;
  className?: string;
  dataState?: string;
  paymentTerms?: ReactNode;
}) {
  return <Master3150Card
    mode="load"
    className={`xdrive-cx-load-card ${className}`}
    mainClassName="xdrive-cx-load-card__main"
    routeClassName="xdrive-cx-load-card__route"
    timesClassName="xdrive-cx-load-card__times"
    statusClassName="xdrive-cx-load-card__status"
    footerClassName="xdrive-cx-load-footer"
    from={from}
    to={to}
    routeMeta={routeMeta}
    pickup={pickup}
    delivery={delivery}
    band={band}
    posted={posted}
    postedAt={postedAt}
    loadId={loadId}
    vehicle={vehicle}
    facts={freight && <div className="xdrive-cx-load-card__freight">{freight}</div>}
    terms={paymentTerms}
    statusMeta={null}
    footer={footer}
    expanded={expanded}
    expandedContent={<>
      {commercial && <div className="xdrive-cx-load-card__commercial">{commercial}</div>}
      {notes && <div className="xdrive-cx-load-card__notes">{notes}</div>}
    </>}
    state={dataState}
  />;
}
