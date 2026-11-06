import type { AssignedJob, DriverBid, DriverJobSheet, MarketplaceJob, RealDriverSnapshot } from './realApi';

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
  service?: string; freightType?: string; yourRef?: string; customerRef?: string; pickupCompany?: string; deliveryCompany?: string; pickupAddress?: string; deliveryAddress?: string; pickupContactName?: string; pickupContactPhone?: string; deliveryContactName?: string; deliveryContactPhone?: string; pickupInstructions?: string; deliveryInstructions?: string; terms?: string; items?: number; packages?: number; cargoLength?: number; cargoWidth?: number; cargoHeight?: number; hardCopyPodRequired?: boolean; postedAt?: string; jobDescription?: string;

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
    ...(job.exchange_posted_at && !Number.isNaN(Date.parse(job.exchange_posted_at)) ? {postedAt:new Date(job.exchange_posted_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}:{}),
    ...(job.journeyDistanceMiles != null ? {distanceMiles:job.journeyDistanceMiles}:{}),
    ...(job.requested_cargo_label || job.cargo_type ? {freightType:job.requested_cargo_label || job.cargo_type || undefined}:{}),
    ...(job.pallets != null ? {items:job.pallets}:{}),
    ...(job.service_mode ? {service:job.service_mode}:{}),
  };
}
export function mapAssignedJob(job: AssignedJob, sheet?: DriverJobSheet): DriverCard {
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
    company: sheet?.bookedBy || job.postingCompanyName || 'Customer not provided', quoteOutcome: 'AWARDED',
    ...(job.createdAt && !Number.isNaN(new Date(job.createdAt).getTime()) ? {postedAt:new Date(job.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}:{}),
    ...(sheet?.pickupCompany ? {pickupCompany:sheet.pickupCompany}:{}),
    ...(sheet?.deliveryCompany ? {deliveryCompany:sheet.deliveryCompany}:{}),
    ...(sheet?.reference ? {yourRef:sheet.reference}:{}),
    ...(sheet?.customerReference ? {customerRef:sheet.customerReference}:{}),
    ...(sheet?.pickup?.address ? {pickupAddress:[sheet.pickup.address,sheet.pickup.postcode].filter(Boolean).join(', ')}:{}),
    ...(sheet?.delivery?.address ? {deliveryAddress:[sheet.delivery.address,sheet.delivery.postcode].filter(Boolean).join(', ')}:{}),
    ...(sheet?.pickup?.contactName ? {pickupContactName:sheet.pickup.contactName}:{}),
    ...(sheet?.pickup?.contactPhone ? {pickupContactPhone:sheet.pickup.contactPhone}:{}),
    ...(sheet?.delivery?.contactName ? {deliveryContactName:sheet.delivery.contactName}:{}),
    ...(sheet?.delivery?.contactPhone ? {deliveryContactPhone:sheet.delivery.contactPhone}:{}),
    ...(sheet?.pickup?.notes ? {pickupInstructions:sheet.pickup.notes}:{}),
    ...(sheet?.delivery?.notes ? {deliveryInstructions:sheet.delivery.notes}:{}),
    ...(sheet?.executionInstructions ? {notes:sheet.executionInstructions,jobDescription:sheet.executionInstructions}:{}),
    ...(sheet?.paymentDueDays ? {terms:`${sheet.paymentDueDays} days`}:sheet?.paymentTerms ? {terms:sheet.paymentTerms}:{}),
    ...(sheet?.cargo?.weightKg != null ? {weight:sheet.cargo.weightKg}:{}),
    ...(sheet?.cargo?.pallets != null ? {items:sheet.cargo.pallets}:{}),
    ...(sheet?.cargo?.lengthCm != null ? {cargoLength:sheet.cargo.lengthCm}:{}),
    ...(sheet?.cargo?.widthCm != null ? {cargoWidth:sheet.cargo.widthCm}:{}),
    ...(sheet?.cargo?.heightCm != null ? {cargoHeight:sheet.cargo.heightCm}:{}),
    ...(sheet?.hardCopyPod ? {hardCopyPodRequired:/required/i.test(sheet.hardCopyPod)}:{}),
    ...(sheet?.requestedVehicle ? {vehicle:sheet.requestedVehicle}:{}),
    ...(sheet?.pickup?.dateTime ? {pickup:time(sheet.pickup.dateTime)}:{}),
    ...(sheet?.delivery?.dateTime ? {delivery:time(sheet.delivery.dateTime)}:{}),
    ...(sheet?.agreedRate != null ? { quote: sheet.agreedRate } : job.agreedRateAmount != null ? { quote: job.agreedRateAmount } : {}),
    ...(job.jobDistanceMiles != null ? { distanceMiles: job.jobDistanceMiles } : {}),
  };
}
export function mapDriverSnapshot(snapshot: RealDriverSnapshot): DriverCard[] {
  const bookings = snapshot.bookings.map(job=>mapAssignedJob(job,snapshot.sheets?.[job.id]));
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





