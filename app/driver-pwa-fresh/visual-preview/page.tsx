import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import LoadsClient from '../jobs/LoadsClient';

export default async function LocalVisualPreview() {
  const host = (await headers()).get('host') ?? '';
  const isReviewHost = /^deploy-preview-706--xdrivelogistics\.netlify\.app$/i.test(host);
  if (process.env.NODE_ENV !== 'development' && !isReviewHost) notFound();
  const now = Date.now();
  const sample = (id: string, pickup: string, pickupCode: string, delivery: string, deliveryCode: string, notes: string, minutes: number) => ({
    id, status: 'posted', pickup_area: pickup, pickup_postcode_area: pickupCode,
    delivery_area: delivery, delivery_postcode_area: deliveryCode,
    pickup_datetime: new Date(now + minutes * 60_000).toISOString(),
    delivery_datetime: new Date(now + (minutes + 900) * 60_000).toISOString(),
    pickup_time_slot: 'At', delivery_time_slot: 'By',
    vehicle_type: 'LWB Van', requested_vehicle_label: 'LWB Van', requested_vehicle_type: 'LWB Van',
    service_mode: 'TIMED_DIRECT', public_quote_notes: notes,
    distance_to_pickup_miles: 8, distance_to_delivery_miles: 22,
    distance_miles: 252.8, weight_kg: 375, pallets: 1, payment_terms: '30 days',
    exchange_posted_at: new Date(now - 15 * 60_000).toISOString(),
    member: { name: 'XDRIVE LOGISTICS LTD', postedBy: 'XDRIVE LOGISTICS LTD' },
  });
  return <LoadsClient previewLoads={[
    sample('visual-1','Erith','DA8','Blackburn','BB1','LIVE SYSTEM TEST - DO NOT QUOTE OR BOOK. No transport is required. Reverse route of test load XDL-290239CA.', 60),
    sample('visual-2','Blackburn','BB1','Erith','DA8','Collection and delivery reference. Handle with care.', 180),
    sample('visual-3','London','SE1','Luton','LU1','Driver visual reference only. Not a real load.', 240),
  ]} />;
}

