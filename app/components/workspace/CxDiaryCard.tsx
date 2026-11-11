'use client';

import type { ReactNode } from 'react';
import Master3150Card from './Master3150Card';

export type CxDiaryDateParts = { primary: ReactNode; meta?: ReactNode };

/** Approved 3150 Diary/Booking card with original POD, invoice and feedback controls. */
export default function CxDiaryCard({
  from, to, pickup, delivery, band, statusLine, statusStamp,
  loadId, vehicle, footer, children, expanded = false,
  expandedMeta, expandedContent, secondaryContent,
  className = '', footerClassName = '', footerRole, footerAriaLabel,
  state, stage, dataState, dataStage, paymentTerms,
}: {
  from: ReactNode;
  to: ReactNode;
  pickup: CxDiaryDateParts;
  delivery: CxDiaryDateParts;
  band: ReactNode;
  statusLine: ReactNode;
  statusStamp?: ReactNode;
  loadId: ReactNode;
  vehicle: string;
  footer: ReactNode;
  children?: ReactNode;
  expanded?: boolean;
  expandedMeta?: ReactNode;
  expandedContent?: ReactNode;
  secondaryContent?: ReactNode;
  className?: string;
  footerClassName?: string;
  footerRole?: string;
  footerAriaLabel?: string;
  state?: string;
  stage?: string;
  dataState?: string;
  dataStage?: string;
  paymentTerms?: ReactNode;
}) {
  return <Master3150Card
    mode="diary"
    className={`workspace-operational-row xdrive-cx-diary-card ${className}`}
    mainClassName="xdrive-cx-diary-card__main"
    routeClassName="cx-diary-route xdrive-cx-diary-card__route"
    timesClassName="xdrive-cx-diary-card__times"
    statusClassName="xdrive-cx-diary-card__status"
    footerClassName={`xdrive-cx-diary-card__footer ${footerClassName}`}
    footerRole={footerRole}
    footerAriaLabel={footerAriaLabel}
    from={from}
    to={to}
    pickup={pickup}
    delivery={delivery}
    band={band}
    posted={statusLine}
    postedAt={statusStamp}
    loadId={loadId}
    vehicle={vehicle}
    footer={footer}
    terms={paymentTerms}
    expanded={expanded}
    expandedContent={<>
      {expandedMeta && <div className="xdrive-cx-diary-card__expanded-meta">{expandedMeta}</div>}
      {expandedContent}
      {secondaryContent}
    </>}
    extra={children}
    state={dataState ?? state}
    stage={dataStage ?? stage}
  />;
}
