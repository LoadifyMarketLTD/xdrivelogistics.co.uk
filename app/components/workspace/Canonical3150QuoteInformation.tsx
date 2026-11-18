'use client';
import QuoteCompanyProfile from './QuoteCompanyProfile';
import QuotePublicRouteMap from './QuotePublicRouteMap';

/** Original 3150 DemoQuotePanel informational sections, with real authorised fields. */
export type Canonical3150QuoteTab = 'Quote' | 'Load Details' | 'Route & Map' | 'Company';
export const CANONICAL_3150_QUOTE_TABS: Canonical3150QuoteTab[] = ['Quote', 'Load Details', 'Route & Map', 'Company'];

export type Canonical3150QuoteLoad = {
  id: string;
  companyId?: string | null;
  reference?: string;
  memberCode?: string | null;
  stops?: {label:string; area:string; when:string}[];
  distanceMiles?: number | null;
  durationMinutes?: number | null;

  from: string;
  to: string;
  customer: string;
  vehicle: string;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  pickupStart?: string | null;
  deliveryTime?: string | null;
  pallets?: number | null;
  weight?: string | null;
  dimensions?: string | null;
  cargo?: string | null;
  service?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
  hardPod?: string | null;
};

const display = (value: string | number | null | undefined) => value == null || String(value).trim() === '' ? 'Not provided' : String(value);

export default function Canonical3150QuoteInformation({ tab, load, onReturn }: {
  tab: Canonical3150QuoteTab;
  load: Canonical3150QuoteLoad;
  onReturn: () => void;
}) {
  const stops = load.stops?.length ? load.stops : [{label:'Collection',area:load.from,when:display(load.pickupStart)},{label:'Delivery',area:load.to,when:display(load.deliveryTime)}];
  const itinerary = <ol>{stops.map((stop,i)=><li key={i}><b>{stop.label}: {stop.area}</b><p>{stop.when}</p></li>)}</ol>;
  const maps = new URLSearchParams({api:'1',origin:load.from,destination:load.to,travelmode:'driving'});
  if(stops.length>2) maps.set('waypoints',stops.slice(1,-1).map(s=>s.area).join('|'));
  if (tab === 'Quote') return <div className="xd-quote-info">
    <section><h3>Collection</h3><p><b>Location:</b> {load.from}</p><p><b>Date:</b> {display(load.pickupDate)}</p><p><b>Time:</b> {display(load.pickupStart)}</p><p><b>Full address:</b> Available after award to authorised parties</p></section>
    <section><h3>Delivery</h3><p><b>Location:</b> {load.to}</p><p><b>Date:</b> {display(load.deliveryDate)}</p><p><b>Time:</b> {display(load.deliveryTime)}</p><p><b>Full address:</b> Available after award to authorised parties</p></section>
    {stops.length>2 && <section className="xd-quote-wide"><h3>Full itinerary ({stops.length} stops)</h3>{itinerary}</section>}
    <section><h3>Cargo Details</h3><p><b>Packaging:</b> {load.pallets != null ? `${load.pallets} pallets` : display(load.cargo)}</p><p><b>Weight:</b> {display(load.weight)}</p><p><b>Dimensions:</b> {display(load.dimensions)}</p><p><b>Cargo:</b> {display(load.cargo)}</p></section>
    <section><h3>Requirements</h3><p><b>Vehicle:</b> {load.vehicle}</p><p><b>Handling:</b> {display(load.notes)}</p><p><b>Service:</b> {display(load.service)}</p></section>
    <section className="xd-quote-wide"><h3>Additional Information</h3><p>{display(load.notes)}</p></section>
    <section className="xd-quote-wide"><h3>Payment Terms</h3><p><b>{display(load.paymentTerms)}</b></p></section>
  </div>;
  const journey = <ol className="xd-unified-stops">{stops.map((stop,i)=><li key={i}><span className="xd-stop-number">{i+1}</span><div><b>{stop.label}: {stop.area}</b><p>{stop.when}</p></div></li>)}</ol>;
  const back = <button type="button" className="xd-quote-back" onClick={onReturn}>Return to Quote</button>;
  if (tab === 'Load Details') return <div className="xd-quote-tab-content xd-unified-tab"><div className="xd-quote-info">
    <section><h3>Collection</h3><p><b>Location:</b> {load.from}</p><p><b>Schedule:</b> {display(load.pickupStart)}</p><p>Full address available after award to authorised parties.</p></section>
    <section><h3>Delivery</h3><p><b>Location:</b> {load.to}</p><p><b>Date:</b> {display(load.deliveryDate)}</p><p><b>Time:</b> {display(load.deliveryTime)}</p></section>
    <section className="xd-quote-wide"><h3>Full itinerary ({stops.length} stops)</h3>{journey}</section>
    <section><h3>Cargo &amp; Vehicle</h3><p><b>Vehicle:</b> {load.vehicle}</p><p><b>Cargo:</b> {display(load.cargo)}</p><p><b>Pallets:</b> {display(load.pallets)}</p><p><b>Weight:</b> {display(load.weight)}</p><p><b>Dimensions:</b> {display(load.dimensions)}</p></section>
    <section><h3>Transport Requirements</h3><p><b>Service:</b> {display(load.service)}</p><p><b>Public notes:</b> {display(load.notes)}</p></section>
    <section><h3>Commercial Terms</h3><p><b>Payment:</b> {display(load.paymentTerms)}</p><p><b>Hard-copy POD:</b> {display(load.hardPod)}</p></section>
    <section><h3>Journey Distance</h3><p><b>Official job:</b> {display(load.distanceMiles)} miles / {display(load.durationMinutes)} min</p></section>
  </div>{back}</div>;
  if (tab === 'Route & Map') return <div className="xd-quote-tab-content xd-unified-tab"><div className="xd-quote-info xd-unified-route">
    <section><h3>Route &amp; Operational Map</h3><p>Approximate public postcode areas only.</p><div className="xd-unified-map"><a className="xd-quote-back" href={'https://www.google.com/maps/dir/?'+maps.toString()} target="_blank" rel="noopener noreferrer">Open Google Maps</a><QuotePublicRouteMap stops={stops}/></div></section>
    <div className="xd-unified-stack"><section><h3>Journey &amp; Schedule</h3>{journey}</section><section><h3>Official Job Distance</h3><p>{display(load.distanceMiles)} miles / {display(load.durationMinutes)} min</p><p>Map estimates are approximate, not the booked distance.</p></section></div>
  </div>{back}</div>;
  return <div className="xd-quote-tab-content xd-unified-tab"><QuoteCompanyProfile key={load.companyId ?? load.id} companyId={load.companyId} jobTerms={load.paymentTerms}/>{back}</div>;
}
