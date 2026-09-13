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

export type DriverJobStop = {
  id?: string;
  sequence: number;
  type?: string;
  address: string;
  company?: string;
  contactPerson?: string;
  telephone?: string;
  timeWindowFrom?: string;
  timeWindowTo?: string;
  status?: string;
  notes?: string;
  arrivedAt?: string;
  completedAt?: string;
};

export type DriverJobAttachment = {
  id?: string | null;
  type?: string | null;
  fileName?: string | null;
  createdAt?: string | null;
  signedUrl?: string | null;
  url?: string | null;
};

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
  pickupTiming?: string;
  deliveryTiming?: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
  podRequired: boolean;
  contactAllowed: boolean;
  contactName?: string;
  contactPhone?: string;
  pickupNote?: string;
  deliveryNote?: string;
  client?: string;
  distance?: string;
  eta?: string;
  weight?: string;
  dimensions?: string;
  palletCount?: number;
  adr?: boolean;
  tailLift?: boolean;
  temperatureControlled?: boolean;
  badges?: string[];
  customerNotes?: string;
  specialInstructions?: string;
  customerReference?: string;
  internalReference?: string;
  stops?: DriverJobStop[];
  attachments?: DriverJobAttachment[];
  auditTrail?: Array<Record<string, unknown>>;
  pod?: Record<string, unknown> | null;
  podCompleted?: boolean;
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