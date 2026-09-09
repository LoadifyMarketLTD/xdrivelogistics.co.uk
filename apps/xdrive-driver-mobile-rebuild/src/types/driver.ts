export type CanonicalJobStatus =
  | 'available'
  | 'awarded'
  | 'on_my_way_pickup'
  | 'arrived_pickup'
  | 'loaded'
  | 'on_my_way_delivery'
  | 'arrived_delivery'
  | 'delivered'
  | 'cancelled';

export type DriverJob = {
  id: string;
  reference: string;
  postingCompanyName?: string;
  postingCompanyMemberCode?: string;
  postedAt?: string;
  notesSummary?: string;
  distanceToPickupMiles?: number;
  journeyDistanceMiles?: number;
  estimatedJourneyMinutes?: number;
  serviceMode?: string;
  directDeliveryRequired?: boolean;
  expiresAt?: string;
  canQuote?: boolean;
  quoteWarning?: string;
  status: CanonicalJobStatus;
  pickupLocation: string;
  deliveryLocation: string;
  pickupTime: string;
  deliveryTime: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
  podRequired: boolean;
  contactAllowed: boolean;
  contactName?: string;
  contactPhone?: string;
  pickupNote?: string;
  deliveryNote?: string;
};


export type DriverQuoteReadiness = {
  eligible: boolean;
  blockers: string[];
  issues: string[];
  checks?: Record<string, boolean> | null;
  canonicalVehicleId?: string | null;
};

export type DriverResources = {
  email: string;
  name?: string;
  phone?: string;
  role?: string;
  driver?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  vehicle?: Record<string, unknown> | null;
  documents: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  quotes: Record<string, unknown>[];
  quoteReadiness?: DriverQuoteReadiness;
};