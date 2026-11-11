'use client';

/** Original 3150 DemoQuotePanel informational sections, with real authorised fields. */
export type Canonical3150QuoteTab = 'Quote' | 'Load Details' | 'Route & Map' | 'Company';
export const CANONICAL_3150_QUOTE_TABS: Canonical3150QuoteTab[] = ['Quote', 'Load Details', 'Route & Map', 'Company'];

export type Canonical3150QuoteLoad = {
  id: string;
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
  if (tab === 'Quote') return <div className="xd-quote-info">
    <section><h3>Collection</h3><p><b>Location:</b> {load.from}</p><p><b>Date:</b> {display(load.pickupDate)}</p><p><b>Time:</b> {display(load.pickupStart)}</p><p><b>Full address:</b> Available after award to authorised parties</p></section>
    <section><h3>Delivery</h3><p><b>Location:</b> {load.to}</p><p><b>Date:</b> {display(load.deliveryDate)}</p><p><b>Time:</b> {display(load.deliveryTime)}</p><p><b>Full address:</b> Available after award to authorised parties</p></section>
    <section><h3>Cargo Details</h3><p><b>Packaging:</b> {load.pallets != null ? `${load.pallets} pallets` : display(load.cargo)}</p><p><b>Weight:</b> {display(load.weight)}</p><p><b>Dimensions:</b> {display(load.dimensions)}</p><p><b>Cargo:</b> {display(load.cargo)}</p></section>
    <section><h3>Requirements</h3><p><b>Vehicle:</b> {load.vehicle}</p><p><b>Handling:</b> {display(load.notes)}</p><p><b>Service:</b> {display(load.service)}</p></section>
    <section className="xd-quote-wide"><h3>Additional Information</h3><p>{display(load.notes)}</p></section>
    <section className="xd-quote-wide"><h3>Payment Terms</h3><p><b>{display(load.paymentTerms)}</b></p></section>
  </div>;
  if (tab === 'Load Details') return <div className="xd-quote-tab-content"><h3>Complete Load Information</h3><div className="xd-quote-tab-cards">
    <section><h4>Collection</h4><p>{load.from}</p><p>Date: {display(load.pickupDate)}</p><p>Time: {display(load.pickupStart)}</p><p>Full address and contact are disclosed after award.</p></section>
    <section><h4>Delivery</h4><p>{load.to}</p><p>Date: {display(load.deliveryDate)}</p><p>Time: {display(load.deliveryTime)}</p><p>Full address and contact are disclosed after award.</p></section>
    <section><h4>Cargo and Vehicle</h4><p>Vehicle: {load.vehicle}</p><p>Cargo: {load.pallets != null ? `${load.pallets} pallets` : display(load.cargo)}</p><p>Weight: {display(load.weight)}</p><p>Dimensions: {display(load.dimensions)}</p></section>
    <section><h4>Terms and Instructions</h4><p>Service: {display(load.service)}</p><p>Payment terms: {display(load.paymentTerms)}</p><p>Handling / Notes: {display(load.notes)}</p><p>POD requirements: {display(load.hardPod)}</p></section>
  </div><button type="button" className="xd-quote-back" onClick={onReturn}>Return to Quote</button></div>;
  if (tab === 'Route & Map') return <div className="xd-quote-tab-content"><h3>Collection and Delivery Route</h3><div className="xd-quote-route-summary"><strong>{load.from}</strong><span aria-hidden="true">→</span><strong>{load.to}</strong></div><p>Pickup: {display(load.pickupDate)} / Delivery: {display(load.deliveryDate)}</p><p>Public town/outcode locations only. Exact collection and delivery addresses become available after award.</p><div className="xd-quote-map-panel"><div className="xd-quote-map-line"><span>Collection: {load.from}</span><span>Delivery: {load.to}</span></div><p>Route preview / approximate endpoints</p></div><a className="xd-quote-map-link" href={'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(load.from+', UK')+'&destination='+encodeURIComponent(load.to+', UK')} target="_blank" rel="noopener noreferrer">Open route in Google Maps</a><button type="button" className="xd-quote-back" onClick={onReturn}>Return to Quote</button></div>;
  return <div className="xd-quote-tab-content"><h3>Posting Company</h3><div className="xd-quote-company-card"><div className="xd-quote-company-avatar">XD</div><div><h4>{display(load.customer)}</h4><p>Transport posting organisation</p><p>Load reference: {load.id}</p><p>Payment terms: {display(load.paymentTerms)}</p><p>Company contact details are available to authorised parties according to booking permissions.</p></div></div><button type="button" className="xd-quote-back" onClick={onReturn}>Return to Quote</button></div>;
}