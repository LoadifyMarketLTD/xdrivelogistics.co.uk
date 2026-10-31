import DemoActions from './DemoActions';
import FreshJobCard from '../../FreshJobCard';
import { FreshHeader } from '../../FreshNavigation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

type Sample = { from: string; to: string; vehicle: string; weight: string; cargo: string; dimensions: string; packaging: string; terms: string; pickup: string; delivery: string; notes: string; customer: string; distance: string; };
const samples: Record<string, Sample> = {
  'visual-1': { from: 'BLACKBURN BB1', to: 'MANCHESTER M1', vehicle: 'LWB Van', weight: '375 kg', cargo: 'Box', dimensions: '218 L x 138 W x 139 H cm', packaging: '1 crate', terms: '30 days (from invoice)', pickup: '26 Oct 2026, 10:00', delivery: '2 Nov 2026, 10:00', notes: 'LIVE SYSTEM TEST - DO NOT QUOTE OR BOOK. No transport is required. This is a test placeholder only.', customer: 'XDRIVE LOGISTICS LTD', distance: 'Not available' },
  'visual-2': { from: 'DARWEN BB3', to: 'LEEDS LS14', vehicle: 'LWB Van', weight: '375 kg', cargo: 'Box', dimensions: '218 L x 138 W x 139 H cm', packaging: '1 crate', terms: '30 days (from invoice)', pickup: '26 Oct 2026, 10:00', delivery: '2 Nov 2026, 10:00', notes: 'Collection and delivery reference. Handle with care.', customer: 'XDRIVE LOGISTICS LTD', distance: 'Not available' },
  'visual-3': { from: 'LONDON SE1', to: 'LUTON LU1', vehicle: 'LWB Van', weight: '375 kg', cargo: 'Box', dimensions: 'Not specified', packaging: 'Not specified', terms: '30 days (from invoice)', pickup: 'ASAP', delivery: 'Not specified', notes: 'Driver visual reference only. Not a real load.', customer: 'XDRIVE LOGISTICS LTD', distance: 'Not available' },
};
export default async function DetailsVisualPreview({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const host = (await headers()).get('host') ?? '';
  if (process.env.NODE_ENV !== 'development' && !/^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host)) notFound();
  const { load } = await searchParams;
  const item = samples[load || ''];
  if (!item) notFound();
  return <>
    <FreshHeader title="Load Details" />
    <main className="fresh-content fresh-preview-details">
      <FreshJobCard headerOnly mode="preview" load={{id:load || 'visual-1',status:'posted',pickup_area:item.from.split(' ')[0],pickup_postcode_area:item.from.split(' ').at(-1) || null,delivery_area:item.to.split(' ')[0],delivery_postcode_area:item.to.split(' ').at(-1) || null,pickup_datetime:'2026-10-27T20:55:00Z',delivery_datetime:'2026-10-28T11:55:00Z',pickup_time_slot:'At',delivery_time_slot:'By',vehicle_type:item.vehicle,requested_vehicle_label:item.vehicle,requested_vehicle_type:item.vehicle,service_mode:'TIMED_DIRECT',public_quote_notes:null,distance_to_pickup_miles:null,distance_to_delivery_miles:null,distance_miles:null,weight_kg:null,pallets:null,payment_terms:item.terms,exchange_posted_at:'2026-10-27T18:40:00Z',member:{name:item.customer,postedBy:item.customer}}}/>
      <article className="fresh-card">
        <section className="fresh-preview-data"><dl><dt>Veh:</dt><dd>{item.vehicle}</dd><dt>Dist:</dt><dd>{item.distance}</dd><dt>Load:</dt><dd>{item.cargo}</dd><dt>Weight:</dt><dd>{item.weight}</dd><dt>Packaging:</dt><dd>{item.packaging}</dd><dt>Dims:</dt><dd>{item.dimensions}</dd></dl></section>
        <section className="fresh-preview-customer"><div><strong>Customer</strong><p>{item.customer}</p></div><div><strong>Terms:</strong><p>{item.terms}</p></div><div><strong>Tel:</strong><p>Not available in sample</p></div></section>
        <section className="fresh-preview-notes"><strong>Notes:</strong><p>{item.notes}</p></section>
        <section className="fresh-preview-feedback"><strong>Feedback (past 90 days)</strong><p>Not available in sample</p></section>
        <section className="fresh-actions"><Link className="quote-now" href={`/driver-pwa-fresh/visual-preview/quote?load=${encodeURIComponent(load || '')}`}>Quote Now</Link><DemoActions/></section>
      </article>
    </main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><Link href="/driver-pwa-fresh/visual-preview/workflow?tab=jobs">Jobs</Link><Link href="/driver-pwa-fresh/visual-preview/workflow?tab=quotes">Quotes</Link><Link href="/driver-pwa-fresh/visual-preview/workflow?tab=bookings">Bookings</Link></nav>
  </>;
}
