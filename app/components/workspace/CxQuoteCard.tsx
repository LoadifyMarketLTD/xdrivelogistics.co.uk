'use client';

import type { ReactNode } from 'react';
import type { CxDateParts } from './CxLoadCard';
import { workspaceVehicleImageSrc } from './vehiclePresentation';

export default function CxQuoteCard({
  routeFrom,
  routeTo,
  pickup,
  delivery,
  band,
  sold = false,
  postedAt,
  service,
  loadId,
  vehicle,
  stage,
  expanded = false,
  expandedContent,
  footer,
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
}) {
  return (
    <article className="xdrive-cx-quote-card" data-quote-stage={stage}>
      <div className="xdrive-cx-quote-card__main">
        <section className="xdrive-cx-quote-card__route">
          <div><span>From:</span><strong>{routeFrom}</strong></div>
          <div><span>To:</span><strong>{routeTo}</strong></div>
        </section>
        <section className="xdrive-cx-quote-card__times">
          <div><span>Pickup:</span><span className="cx-quote-datetime"><strong>{pickup.primary}</strong>{pickup.meta ? <span>{pickup.meta}</span> : null}</span></div>
          <div><span>Deliver:</span><span className="cx-quote-datetime"><strong>{delivery.primary}</strong>{delivery.meta ? <span>{delivery.meta}</span> : null}</span></div>
        </section>
        <section className="xdrive-cx-quote-card__status">
          <div className={`xdrive-cx-quote-card__band${sold ? ' xdrive-cx-quote-card__band--sold' : ''}`}>{sold ? 'SOLD' : band}</div>
          {postedAt ? <div className="xdrive-cx-quote-card__posted">{postedAt}</div> : null}
          <div className="xdrive-cx-quote-card__service">{service}</div>
          <div className="xdrive-cx-quote-card__status-meta">
            <span>Load ID: {loadId}</span>
            <span className="xdrive-cx-quote-card__vehicle">
              <img className="xdrive-cx-quote-card__vehicle-image" src={workspaceVehicleImageSrc(vehicle)} alt="" aria-hidden="true" />
              <strong>{vehicle}</strong>
            </span>
          </div>
        </section>
      </div>
      {expanded && expandedContent ? <div className="xdrive-cx-quote-card__expanded-cx">{expandedContent}</div> : null}
      <div className="xdrive-cx-quote-card__footer">{footer}</div>
    </article>
  );
}
