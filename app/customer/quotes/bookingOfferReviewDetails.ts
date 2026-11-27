import type { BookingConfirmationDetails } from './BookingConfirmationFullPage';

type Job = {
  id: string; pickup_postcode?: string | null; pickup_location?: string | null;
  delivery_postcode?: string | null; delivery_location?: string | null;
  pickup_datetime?: string | null; delivery_datetime?: string | null;
  vehicle_type?: string | null; requested_vehicle_label?: string | null;
  pallets?: number | null; weight_kg?: number | null; payment_terms?: string | null;
};
type Bid = {
  bid_price_gbp?: number | string | null; amount?: number | string | null;
  currency?: string | null; message?: string | null;
  company_id?: string | null; bidder_driver_id?: string | null;
  companies?: { name?: string | null } | null;
};
type Identity = {
  displayName?: string | null; personName?: string | null;
  companyName?: string | null; memberId?: string | null;
  businessPhone?: string | null; driverAvailability?: string | null;
  driverVehicleType?: string | null; driverVehiclePallets?: number | null;
  driverVehicleTailLift?: boolean | null; driverType?: string | null; companyType?: string | null;
  memberSince?: string | null;
  completedJobs?: number | null;
  customerRating?: number | null;
  documentStatuses?: Array<{ name: string; status: string; expiryDate: string | null }>;
  verificationUnavailable?: boolean;

};
export function bookingOfferReviewDetails(job: Job, bid: Bid, identity?: Identity | null): BookingConfirmationDetails {
  const amount = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
  return {
    jobId: job.id,
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    currency: bid.currency || 'GBP',
    pickup: job.pickup_postcode || job.pickup_location || 'Collection not supplied',
    delivery: job.delivery_postcode || job.delivery_location || 'Delivery not supplied',
    pickupDate: job.pickup_datetime || null,
    deliveryDate: job.delivery_datetime || null,
    vehicle: (identity?.driverVehicleType || job.requested_vehicle_label || job.vehicle_type || 'Vehicle not supplied').replaceAll('_',' '),
    pallets: job.pallets ?? null,
    vehicleCapacityPallets: identity?.driverVehiclePallets ?? null,
    loadWeightKg: job.weight_kg ?? null,
    tailLift: identity?.driverVehicleTailLift === true,
    paymentTerms: job.payment_terms || null,
    carrierName: identity?.personName || identity?.displayName || identity?.companyName || bid.companies?.name || 'Carrier identity unavailable',
    companyName: identity?.companyName || bid.companies?.name || null,
    memberId: identity?.memberId || null,
    phone: identity?.businessPhone || null,
    availability: identity?.driverAvailability || null,
    memberSince: identity?.memberSince ?? null,
    completedJobs: identity?.completedJobs ?? null,
    customerRating: identity?.customerRating ?? null,
    documentStatuses: identity?.documentStatuses ?? [],
    verificationUnavailable: identity?.verificationUnavailable ?? false,
    ownerDriver: identity?.driverType === 'owner_driver' || identity?.companyType === 'owner_driver' || (!bid.company_id && Boolean(bid.bidder_driver_id)),
    message: bid.message || null,
  };
}
