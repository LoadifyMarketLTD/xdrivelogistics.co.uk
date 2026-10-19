'use client';

import type { ReactNode } from 'react';
import { recoverWorkspaceVehicleImage, workspaceVehicleImageSrc } from './vehiclePresentation';

export type CxDateParts = { primary: ReactNode; meta?: ReactNode };

export function cxDateParts(value: string | null | undefined, fallback = 'ASAP'): CxDateParts {
  if (!value) return { primary: fallback, meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: 'Not set', meta: '' };
  const zone = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return {
    primary: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    meta: `${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}`,
  };
}

export default function CxLoadCard({
  from,
  to,
  routeMeta,
  pickup,
  delivery,
  band,
  posted,
  postedAt,
  loadId,
  vehicle,
  expanded = false,
  freight,
  commercial,
  notes,
  footer,
  className = '',
  dataState,
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
}) {
  return (
    <article className={`xdrive-cx-load-card${className ? ` ${className}` : ''}`} data-state={dataState}>
      <div className="xdrive-cx-load-card__main">
        <section className="xdrive-cx-load-card__route">
          <div><span>From:</span><strong>{from}</strong></div>
          <div><span>To:</span><strong>{to}</strong></div>
          {routeMeta}
        </section>
        <section className="xdrive-cx-load-card__times">
          <div><span>Pickup:</span><span className="cx-load-datetime"><strong>{pickup.primary}</strong>{pickup.meta ? <span>{pickup.meta}</span> : null}</span></div>
          <div><span>Deliver:</span><span className="cx-load-datetime"><strong>{delivery.primary}</strong>{delivery.meta ? <span>{delivery.meta}</span> : null}</span></div>
          {expanded && freight ? <div className="xdrive-cx-load-card__freight">{freight}</div> : null}
        </section>
        <section className="xdrive-cx-load-card__status">
          <div className="xdrive-cx-load-card__band">{band}</div>
          <div className="xdrive-cx-load-card__posted"><strong>{posted}</strong></div>
          {postedAt ? <div className="xdrive-cx-load-card__posted-at">{postedAt}</div> : null}
          <div className="xdrive-cx-load-card__status-meta">
            <span>Load ID: {loadId}</span>
            <span className="xdrive-cx-load-card__vehicle">
              <img className="xdrive-cx-load-card__vehicle-image" src={workspaceVehicleImageSrc(vehicle)} onError={(event) => recoverWorkspaceVehicleImage(event.currentTarget)} alt="" aria-hidden="true" />
              <strong>{vehicle}</strong>
            </span>
          </div>
          {expanded && commercial ? <div className="xdrive-cx-load-card__commercial">{commercial}</div> : null}
        </section>
      </div>
      {expanded && notes ? <div className="xdrive-cx-load-card__notes">{notes}</div> : null}
      <div className="xdrive-cx-load-footer">{footer}</div>
    </article>
  );
}
