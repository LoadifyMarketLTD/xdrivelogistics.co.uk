'use client';

import type { ReactNode } from 'react';
import { recoverWorkspaceVehicleImage, workspaceVehicleImageSrc } from './vehiclePresentation';

/**
 * Owner Driver operational overview, visually independent of Courier Exchange.
 * Source fields and action handlers are supplied by existing operational cards.
 * Designed as a journey + schedule + operational context, not three CX-style table cells.
 */
export default function XDriveTransportOverview({
  from, to, pickup, delivery, status, caption, member, stamp,
  postedAt, vehicle, details, requirements, extraRoute,
  tone = 'load',
}: {
  from: ReactNode;
  to: ReactNode;
  pickup: { primary: ReactNode; meta?: ReactNode };
  delivery: { primary: ReactNode; meta?: ReactNode };
  status: ReactNode;
  caption?: ReactNode;
  member?: ReactNode;
  stamp?: ReactNode;
  postedAt?: ReactNode;
  vehicle: string;
  details?: ReactNode;
  requirements?: ReactNode;
  extraRoute?: ReactNode;
  tone?: 'load'|'quote'|'diary';
}) {
  return (
    <div className={`xd3-journey xd3-journey--${tone}`}>
      <section className="xd3-journey__route" aria-label="Transport route">
        <div className="xd3-journey__eyebrow">Journey</div>
        <div className="xd3-route-line">
          <span className="xd3-route-line__track" aria-hidden="true"><i/><b/><i/></span>
          <div className="xd3-route-line__places">
            <div><small>Collection</small><strong>{from}</strong></div>
            <div><small>Destination</small><strong>{to}</strong></div>
          </div>
        </div>
        {extraRoute ? <div className="xd3-journey__supplement">{extraRoute}</div> : null}
      </section>
      <section className="xd3-journey__schedule" aria-label="Collection and delivery schedule">
        <div className="xd3-journey__eyebrow">Schedule</div>
        <div className="xd3-schedule-row"><span>Pickup</span><strong>{pickup.primary}</strong>{pickup.meta ? <small>{pickup.meta}</small> : null}</div>
        <div className="xd3-schedule-row"><span>Delivery</span><strong>{delivery.primary}</strong>{delivery.meta ? <small>{delivery.meta}</small> : null}</div>
        {details ? <div className="xd3-journey__details">{details}</div> : null}
      </section>
      <section className="xd3-journey__context" aria-label="Transport information">
        <div className="xd3-journey__eyebrow">Transport information</div>
        <div className="xd3-journey__state"><span className="xd3-journey__state-label">{status}</span>{caption ? <div className="xd3-journey__caption">{caption}</div> : null}</div>
        {member ? <div className="xd3-journey__member">{member}</div> : null}
        {stamp ? <div className="xd3-journey__stamp">{stamp}</div> : null}
        <div className="xd3-journey__bottom">
          <span className="xd3-journey__vehicle">
            <img src={workspaceVehicleImageSrc(vehicle)} onError={(event)=>recoverWorkspaceVehicleImage(event.currentTarget)} alt="" aria-hidden="true" />
            <strong>{vehicle}</strong>
          </span>
          {postedAt ? <small className="xd3-journey__posted">{postedAt}</small> : null}
        </div>
        {requirements ? <div className="xd3-journey__requirements">{requirements}</div> : null}
      </section>
    </div>
  );
}
