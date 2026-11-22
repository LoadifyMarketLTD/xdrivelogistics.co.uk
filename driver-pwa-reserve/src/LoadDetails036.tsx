import type { ReactNode } from 'react';
import './LoadDetails036.css';

type Props = {
  reference: string;
  company: string;
  service: string;
  vehicle: string;
  postedAt?: string | null;
  route: ReactNode;
  weightKg: number;
  items?: string | number | null;
  packaging?: string | null;
  terms?: string | null;
  distanceMiles?: number | null;
  pickupRoadMiles?: number | null;
  notes?: string | null;
  customerReference?: string | null;
  quoted: boolean;
  existingQuote?: number | null;
  onBack: () => void;
  onMap: () => void;
  onQuote: () => void;
  onSubmittedQuote: () => void;
};

const price = (n: number) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
const normalise = (v: string) => v.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bLwb\b/g,'LWB');

function Info({label,value}:{label:string;value:string|number}) {
  return <div className="xd036-detail-info"><span>{label}</span><strong>{value}</strong></div>;
}

export default function LoadDetails036(props: Props) {
  const posted = props.postedAt && Number.isFinite(Date.parse(props.postedAt))
    ? new Date(props.postedAt).toLocaleString('en-GB',{
        day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false
      })
    : null;
  const vehicle = normalise(props.vehicle);
  return <div className="xd036-detail">
    <header className="xd036-detail-heading">
      <button type="button" onClick={props.onBack}>← Loads</button>
      <div><h1>{props.reference}</h1><p>Load details · Quotation opportunity</p></div>
    </header>
    <section className="xd036-detail-card">
      <h2 className="xd036-detail-caption">Posted by</h2>
      <div className="xd036-detail-company">{props.company}</div>
      <div className="xd036-detail-pills">
        <span className="xd036-detail-hot">{props.service}</span>
        <span>{vehicle}</span>
        {posted&&<span>Posted {posted}</span>}
      </div>
    </section>
    <section className="xd036-detail-card">
      <h2 className="xd036-detail-caption">Collection & delivery</h2>
      <div className="xd036-detail-route">{props.route}</div>
      <div className="xd036-detail-metrics">
        <div><span>Distance</span><strong>{props.distanceMiles==null?'Not supplied':props.distanceMiles.toFixed(2)+' mi'}</strong></div>
        <div><span>Weight</span><strong>{props.weightKg} kg</strong></div>
        <div><span>Vehicle</span><strong>{vehicle}</strong></div>
      </div>
      {props.pickupRoadMiles!=null&&<p className="xd036-detail-extra-distance">Distance to collection: {props.pickupRoadMiles} mi</p>}
      <button className="xd036-detail-outline" type="button" onClick={props.onMap}>View on Map</button>
    </section>
    <section className="xd036-detail-card">
      <h2 className="xd036-detail-caption">Load requirements</h2>
      <Info label="Vehicle" value={vehicle}/>
      <Info label="Weight" value={props.weightKg+' kg'}/>
      <Info label="Items" value={String(props.items??'Not stated')}/>
      <Info label="Packaging" value={props.packaging||'Not specified'}/>
    </section>
    <section className="xd036-detail-card">
      <h2 className="xd036-detail-caption">Customer & payment</h2>
      <Info label="Customer" value={props.company}/>
      <Info label="Payment terms" value={props.terms||'Not provided'}/>
      <Info label="Your quotation" value={props.quoted&&props.existingQuote!=null?price(props.existingQuote):'Not submitted'}/>
      {props.customerReference&&<Info label="Customer reference" value={props.customerReference}/>}
    </section>
    <section className="xd036-detail-card">
      <h2 className="xd036-detail-caption">Full load instructions</h2>
      <p className="xd036-detail-notes">{props.notes?.trim()||'No additional handling instructions supplied.'}</p>
    </section>
    <div className="xd036-detail-cta">
      {props.quoted
        ? <><p>Your quotation is recorded for this load.</p><button type="button" onClick={props.onSubmittedQuote}>View Submitted Quote</button></>
        : <button type="button" onClick={props.onQuote}>Enter your quote →</button>}
    </div>
  </div>;
}
