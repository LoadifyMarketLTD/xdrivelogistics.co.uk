'use client';
import Link from 'next/link';
export type Load = {
  id: string; status: string; pickup_area: string; pickup_postcode_area: string | null;
  delivery_area: string; delivery_postcode_area: string | null;
  pickup_datetime: string | null; delivery_datetime: string | null;
  pickup_time_slot: string | null; delivery_time_slot: string | null;
  vehicle_type: string | null; requested_vehicle_label: string | null; requested_vehicle_type: string | null;
  service_mode: string | null; public_quote_notes: string | null;
  distance_to_pickup_miles: number | null; distance_to_delivery_miles: number | null;
  distance_miles: number | null; weight_kg: number | null; pallets: number | null;
  payment_terms: string | null; exchange_posted_at: string | null;
  member: { name: string; postedBy: string | null } | null;
  myBid?: { id?: string; status: string | null; amount: number | null } | null;
};
const place = (town: string, outcode: string | null) => [town, outcode].filter(Boolean).join(' | ').toUpperCase();
const time = (value: string | null) => {
  if (!value) return 'Time not confirmed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time not confirmed' : date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const shortTime = (value: string | null) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not specified' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
export default function FreshJobCard({load,mode="jobs",actions}:{load:Load;mode?:"jobs"|"quotes"|"bookings"|"preview";actions?:React.ReactNode}) {
return <article className="fresh-card" data-testid="load-card">
          <section className="fresh-summary" data-testid="load-summary"><div className="fresh-summary-top"><strong>{(load.member?.postedBy || load.member?.name || 'Company not provided').toUpperCase()}</strong><span className="fresh-available">{mode === "quotes" ? "Submitted" : mode === "bookings" ? "Booking" : "Available"}</span></div><div className="fresh-posted">Posted {shortTime(load.exchange_posted_at)}</div><div className="fresh-summary-meta"><span className="fresh-service">{load.service_mode || 'DIRECT'}</span><span>{load.requested_vehicle_label || load.vehicle_type || 'Vehicle unspecified'}</span></div></section>
          <section className="fresh-route" data-testid="load-route"><div className="fresh-route-line" aria-hidden="true"><span className="fresh-pickup-dot"/><span className="fresh-connector"/><span className="fresh-delivery-dot">&#9679;</span></div><div className="fresh-route-places"><div><strong>{place(load.pickup_area, load.pickup_postcode_area)}</strong><p>Collection - {time(load.pickup_datetime)}{load.pickup_time_slot ? ` - ${load.pickup_time_slot}` : ''}</p></div><div><strong>{place(load.delivery_area, load.delivery_postcode_area)}</strong><p>Delivery - {time(load.delivery_datetime)}{load.delivery_time_slot ? ` - ${load.delivery_time_slot}` : ''}</p></div></div></section>
          {load.public_quote_notes ? <section className="fresh-notes" data-testid="load-notes"><strong>Notes:</strong> {load.public_quote_notes}</section> : null}
          {load.distance_miles != null || load.weight_kg != null || load.pallets != null ? <section className="fresh-quick">{[load.distance_miles != null ? `${load.distance_miles} miles` : null, load.weight_kg != null ? `${load.weight_kg} kg` : null, load.pallets != null ? `${load.pallets} pallets` : null].filter(Boolean).join(' | ')}</section> : null}
          <div className="fresh-actions">{actions ? actions : (mode === "jobs" || mode === "preview") ? <><Link className="quote-now" href={mode === "preview" ? `/driver-pwa-fresh/visual-preview/quote?load=${encodeURIComponent(load.id)}` : `/driver-pwa-fresh/jobs/${encodeURIComponent(load.id)}#quote`}>Quote Now</Link><Link className="fresh-detail" href={mode === "preview" ? `/driver-pwa-fresh/visual-preview/details?load=${encodeURIComponent(load.id)}` : `/driver-pwa-fresh/jobs/${encodeURIComponent(load.id)}`}>View Details</Link></> : actions}</div>
        </article>;
}
