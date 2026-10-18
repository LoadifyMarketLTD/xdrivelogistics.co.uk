'use client';

import type { ReactNode } from 'react';
import { recoverWorkspaceVehicleImage, workspaceVehicleImageSrc } from './vehiclePresentation';

export type CxDiaryDateParts = { primary: ReactNode; meta?: ReactNode };

export default function CxDiaryCard({
  from,
  to,
  pickup,
  delivery,
  band,
  statusLine,
  statusStamp,
  loadId,
  vehicle,
  footer,
  children,
  expanded = false,
  expandedMeta,
  expandedContent,
  secondaryContent,
  className = '',
  footerClassName = '',
  footerRole,
  footerAriaLabel,
  state,
  stage,
  dataState,
  dataStage,
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
}) {
  return (
    <article className={`workspace-operational-row xdrive-cx-diary-card${className ? ` ${className}` : ''}`} data-state={dataState ?? state} data-stage={dataStage ?? stage}>
      <div className="xdrive-cx-diary-card__main">
        <section className="cx-diary-route xdrive-cx-diary-card__route">
          <div><span>From:</span><strong>{from}</strong></div>
          <div><span>To:</span><strong>{to}</strong></div>
        </section>
        <section className="xdrive-cx-diary-card__times">
          <div><span>Pickup:</span><span className="cx-diary-datetime"><strong>{pickup.primary}</strong>{pickup.meta ? <span>{pickup.meta}</span> : null}</span></div>
          <div><span>Deliver:</span><span className="cx-diary-datetime"><strong>{delivery.primary}</strong>{delivery.meta ? <span>{delivery.meta}</span> : null}</span></div>
        </section>
        <section className="xdrive-cx-diary-card__status">
          <div className="xdrive-cx-diary-card__band">{band}</div>
          <div className="xdrive-cx-diary-card__status-line">{statusLine}</div>
          {statusStamp ? <div className="xdrive-cx-diary-card__status-stamp">{statusStamp}</div> : null}
          <div className="xdrive-cx-diary-card__status-meta">
            <span>Load ID: {loadId}</span>
            <span className="xdrive-cx-load-card__vehicle xdrive-cx-diary-card__vehicle">
              <img className="xdrive-cx-load-card__vehicle-image xdrive-cx-diary-card__vehicle-image" src={workspaceVehicleImageSrc(vehicle)} onError={(event) => recoverWorkspaceVehicleImage(event.currentTarget)} alt="" aria-hidden="true" />
              <strong>{vehicle}</strong>
            </span>
          </div>
        </section>
      </div>
      <div className={`xdrive-cx-diary-card__footer${footerClassName ? ` ${footerClassName}` : ''}`} role={footerRole} aria-label={footerAriaLabel}>{footer}</div>
      {expanded && expandedMeta ? <div className="xdrive-cx-diary-card__expanded-meta">{expandedMeta}</div> : null}
      {expanded && expandedContent ? expandedContent : null}
      {expanded && secondaryContent ? secondaryContent : null}
      {children}
    </article>
  );
}
