export type CanonicalJobStatus =
  | 'awarded'
  | 'on_my_way_pickup'
  | 'arrived_pickup'
  | 'loaded'
  | 'on_my_way_delivery'
  | 'arrived_delivery'
  | 'delivered';

export type JobScope = 'active' | 'upcoming' | 'completed';

export type DriverJob = {
  id: string;
  reference: string;
  status: CanonicalJobStatus;
  pickupLocation: string;
  deliveryLocation: string;
  pickupTime: string;
  deliveryTime: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
  priority: 'normal' | 'high';
  podRequired: boolean;
  contactAllowed: boolean;
  contactName?: string;
  contactPhone?: string;
  postingCompanyName?: string;
  postingCompanyMemberCode?: string;
  publicPricePublished?: boolean;
  pricePublished?: boolean;
  isPricePublic?: boolean;
  budgetPublished?: boolean;
  canViewPrice?: boolean;
  canUpdateLifecycle?: boolean;
  privateDetailsRevealed?: boolean;
  canQuote?: boolean;
  quoteWarning?: string;
  serviceMode?: string;
  directDeliveryRequired?: boolean;
  pickupCountryCode?: string;
  deliveryCountryCode?: string;
  distanceFromCurrentDeliveryMiles?: number;
  internationalEligibilityRequired?: boolean;
  destinationPriority?: boolean;
};

export type QueuedActionStatus = 'pending' | 'synced' | 'failed';
