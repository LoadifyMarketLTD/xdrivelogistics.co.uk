import type { LiveJob } from './liveApi';
import { routeLabel } from './routeLabel';
import './BookingStatusLayout.css';

const label = (date?:string,time?:string) =>
  [date,time].filter(v=>v&&v!=='Not provided').join(' · ')||'Time not provided';

export default function BookingStatusSummary({job,onMap}:{job:LiveJob;onMap:()=>void}) {
  const podRecorded=Boolean(job.podRecorded||job.status==='POD_SUBMITTED');
  const podPending=job.status==='DELIVERED'&&!podRecorded;
  const acceptance=Boolean(job.acceptanceRequired&&job.offerId);
  const title=podRecorded?'Delivered — signed POD recorded'
    :podPending?'POD pending — delivery not finalised'
    :acceptance?'Booking acceptance required'
    :job.status.replaceAll('_',' ');
  const description=podRecorded
    ?'Signed POD is archived in XDrive. Invoice and email delivery remain separate financial records.'
    :podPending
    ?'Delivery status has advanced but signed POD is not confirmed. This booking must stay Active until POD is verified.'
    :'Review the operational timeline below. Only server-provided event times are displayed.';
  const price=job.quote==null?'Not provided':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(job.quote);
  const reference=job.yourRef||job.customerRef||job.id;
  return <section className={'xb-status-overview'+(podRecorded?' xb-overview-complete':podPending?' xb-overview-pending':'')} aria-label="Current booking status">
    <div className="xb-status-overview-heading">
      <span className="xb-status-overline">XDRIVE TRANSPORT STATUS</span>
      <h2>{title}</h2><p>{description}</p>
    </div>
    <div className="xb-status-route" aria-label="Booking route">
      <div><span>COLLECTION</span><strong>{routeLabel(job.from,job.fromOutcode)}</strong>
        <small>{label(job.pickupDate,job.pickup)}</small></div>
      <span className="xb-status-route-arrow" aria-hidden="true">→</span>
      <div><span>DELIVERY</span><strong>{routeLabel(job.to,job.toOutcode)}</strong>
        <small>{label(job.deliveryDate,job.delivery)}</small></div>
    </div>
    <dl className="xb-status-quickfacts">
      <div><dt>BOOKING REF</dt><dd>{reference}</dd></div>
      <div><dt>AGREED RATE</dt><dd>{price}</dd></div>
      <div><dt>PAYMENT TERMS</dt><dd>{job.terms||'Not provided'}</dd></div>
      <div><dt>POD</dt><dd>{podRecorded?'Recorded':podPending?'Pending verification':'Not recorded'}</dd></div>
    </dl>
    <button type="button" className="xb-status-map-link" onClick={onMap}>View route on map</button>
  </section>;
}
