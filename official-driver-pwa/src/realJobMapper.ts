import type { AssignedJob, DriverBid, MarketplaceJob, RealDriverSnapshot } from './realApi';

/** Maps server-authorised, public marketplace fields to approved driver-card fields. */
export type DriverCard = {
  id: string;
  from: string;
  to: string;
  pickup: string;
  delivery: string;
  vehicle: string;
  weight: number | null;
  notes: string;
  status: 'OPEN' | 'ALLOCATED' | 'ON_WAY_TO_PICKUP' | 'ON_SITE_PICKUP' | 'LOADED' | 'ON_WAY_TO_DELIVERY' | 'ON_SITE_DELIVERY' | 'POD_SUBMITTED' | 'DELIVERED';
  company: string;
  distanceMiles?: number;
  quote?: number;
  quoteOutcome?: 'AWARDED' | 'UNSUCCESSFUL' | 'CANCELLED';
};
const area = (value: string | null | undefined) => value?.trim() || 'Area not provided';
const time = (value: string | null | undefined) => {
  if (!value) return 'Time to be confirmed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time to be confirmed' : date.toLocaleString('en-GB');
};
export function mapMarketplaceJob(job: MarketplaceJob): DriverCard {
  if (!job.id || job.id.startsWith('TEST-')) throw new Error('Invalid live job identifier');
  return {
    id: job.id,
    from: area(job.pickup_location), to: area(job.delivery_location),
    pickup: time(job.pickup_datetime), delivery: time(job.delivery_datetime),
    vehicle: job.requested_vehicle_label || job.vehicle_type || 'Vehicle not specified',
    weight: job.weight_kg ?? null, notes: job.load_details || '',
    status: 'OPEN', company: job.posterName || 'Marketplace member',
  };
}
export function mapAssignedJob(job: AssignedJob): DriverCard {
  if (!job.id || job.id.startsWith('TEST-')) throw new Error('Invalid live booking identifier');
  const canonical = String(job.canonicalStatus || '').toLowerCase();
  const lifecycle = String(job.lifecycleGroup || '').toLowerCase();
  return {
    id: job.id, from: area(job.pickupLocation), to: area(job.deliveryLocation),
    pickup: time(job.pickupTime), delivery: 'Time to be confirmed',
    vehicle: job.vehicleType || 'Vehicle not specified', weight: null, notes: '',
    status: ['delivered', 'completed', 'complete', 'invoiced', 'paid'].includes(canonical) || lifecycle.includes('complete') ? 'DELIVERED'
      : canonical.includes('pod') ? 'POD_SUBMITTED'
      : canonical.includes('arrived_delivery') || canonical.includes('on_site_delivery') ? 'ON_SITE_DELIVERY'
      : canonical.includes('on_way_delivery') || canonical.includes('in_transit') ? 'ON_WAY_TO_DELIVERY'
      : canonical.includes('loaded') || canonical.includes('collected') ? 'LOADED'
      : canonical.includes('arrived_pickup') || canonical.includes('on_site_pickup') ? 'ON_SITE_PICKUP'
      : canonical === 'on_my_way' || canonical.includes('on_way_pickup') || canonical.includes('en_route_pickup') ? 'ON_WAY_TO_PICKUP' : 'ALLOCATED',
    company: job.postingCompanyName || 'Customer not provided', quoteOutcome: 'AWARDED',
    ...(job.agreedRateAmount != null ? { quote: job.agreedRateAmount } : {}),
    ...(job.jobDistanceMiles != null ? { distanceMiles: job.jobDistanceMiles } : {}),
  };
}
export function mapDriverSnapshot(snapshot: RealDriverSnapshot): DriverCard[] {
  const bookings = snapshot.bookings.map(mapAssignedJob);
  const booked = new Set(bookings.map(job => job.id));
  const marketIds = new Set(snapshot.marketplace.map(job => job.id));
  const bids = new Map<string, DriverBid>();
  for (const bid of snapshot.bids) if (bid.jobId && !bids.has(bid.jobId)) bids.set(bid.jobId, bid);
  return [
    ...bookings,
    ...snapshot.bids.filter(bid => bid.jobId && !booked.has(bid.jobId) && !marketIds.has(bid.jobId) && !bid.jobId.startsWith('TEST-')).map(bid => ({
      id: bid.jobId, from: area(bid.pickupLocation), to: area(bid.deliveryLocation),
      pickup: 'Time to be confirmed', delivery: 'Time to be confirmed',
      vehicle: 'Vehicle not specified', weight: null, notes: bid.message || '',
      status: 'OPEN' as const, company: 'Marketplace member', quote: bid.amount ?? undefined,
      quoteOutcome: bid.status?.toLowerCase() === 'rejected' ? 'UNSUCCESSFUL' as const : ['cancelled', 'withdrawn'].includes(bid.status?.toLowerCase()) ? 'CANCELLED' as const : bid.status?.toLowerCase() === 'accepted' ? 'AWARDED' as const : undefined,
    })),
    ...snapshot.marketplace.filter(job => !booked.has(job.id)).map(job => {
      const card = mapMarketplaceJob(job);
      const bid = bids.get(job.id);
      if (bid && bid.amount != null) card.quote = bid.amount;
      if (bid && bid.status?.toLowerCase() === 'rejected') card.quoteOutcome = 'UNSUCCESSFUL';
      if (bid && ['cancelled', 'withdrawn'].includes(bid.status?.toLowerCase())) card.quoteOutcome = 'CANCELLED';
      if (bid && bid.status?.toLowerCase() === 'accepted') card.quoteOutcome = 'AWARDED';
      return card;
    }),
  ];
}





