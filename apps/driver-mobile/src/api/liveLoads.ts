import { apiRequest } from './client';

type ApiLoad = {
  id: string;
  publicReference: string | null;
  poster?: { name: string | null; memberCode: string | null };
  pickup: { addressSummary: string; collectionFrom: string | null; collectionTo?: string | null };
  delivery: { addressSummary: string; deliveryFrom: string | null; deliveryTo?: string | null };
  vehicleType: string | null;
  freightType: string | null;
  publicPrice: { visible: boolean; amount: number | null; currency: string | null };
  canQuote?: boolean;
  pickupCountryCode?: string | null;
  deliveryCountryCode?: string | null;
  serviceMode?: string | null;
  directDeliveryRequired?: boolean;
  destinationPriority?: boolean;
  distanceFromCurrentDeliveryMiles?: number | null;
  quoteWarning?: string | null;
  hasProposedPrice?: boolean;
  proposedPriceGbp?: number | null;
  distanceMiles?: number | null;
  estimatedDrivingMinutes?: number | null;
  weightKg?: number | null;
  dimensions?: string | null;
  palletCount?: number | null;
  adr?: boolean;
  tailLift?: boolean;
  temperatureControlled?: boolean;
  badges?: string[];
};

export type LiveLoadsResponse = {
  jobs: ApiLoad[];
  returnIq?: {
    active: boolean;
    destinationArea?: string;
    currentJobReference?: string;
    availableAfter?: string | null;
    radiusMiles?: number;
    reason?: string;
  };
};

export type LiveLoad = {
  id: string;
  reference: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupTime: string;
  pickupTimeTo?: string;
  deliveryTime: string;
  deliveryTimeTo?: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
  proposedPriceAmount: number | null;
  postingCompanyName?: string;
  postingCompanyMemberCode?: string;
  publicPricePublished: boolean;
  canQuote: boolean;
  quoteWarning?: string;
  pickupCountryCode: string;
  deliveryCountryCode: string;
  serviceMode?: string;
  directDeliveryRequired: boolean;
  destinationPriority: boolean;
  distanceFromCurrentDeliveryMiles?: number;
  hasProposedPrice: boolean;
  proposedPriceGbp?: number;
  distanceMiles?: number;
  estimatedDrivingMinutes?: number;
  weightKg?: number;
  dimensions?: string;
  palletCount?: number;
  adr?: boolean;
  tailLift?: boolean;
  temperatureControlled?: boolean;
  badges?: string[];
};

export type StructuredLiveLoadQuote = {
  totalAmount: number;
  baseAmount: number;
  additionalExtrasGbp: number;
  collectWithinMinutes: number | null;
  message?: string;
};

function money(amount: number | null, currency = 'GBP') {
  if (!amount || amount <= 0) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function mapLiveLoad(load: ApiLoad): LiveLoad {
  const priceVisible = load.publicPrice.visible && Number(load.publicPrice.amount ?? 0) > 0;
  return {
    id: load.id,
    reference: load.publicReference || `XDL-${load.id.slice(0, 8).toUpperCase()}`,
    pickupLocation: load.pickup.addressSummary,
    deliveryLocation: load.delivery.addressSummary,
    pickupTime: load.pickup.collectionFrom || 'Collection time not set',
    deliveryTime: load.delivery.deliveryFrom || 'Delivery time not set',
    cargoType: load.freightType || 'Freight not provided',
    vehicleRequirement: load.vehicleType || 'Vehicle required',
    price: priceVisible ? money(load.publicPrice.amount, load.publicPrice.currency || 'GBP') : '',
    proposedPriceAmount: priceVisible ? (load.publicPrice.amount ?? null) : null,
    postingCompanyName: load.poster?.name || undefined,
    postingCompanyMemberCode: load.poster?.memberCode || undefined,
    publicPricePublished: priceVisible,
    canQuote: load.canQuote !== false,
    quoteWarning: load.quoteWarning || undefined,
    pickupCountryCode: load.pickupCountryCode || 'GB',
    deliveryCountryCode: load.deliveryCountryCode || 'GB',
    serviceMode: load.serviceMode || undefined,
    directDeliveryRequired: load.directDeliveryRequired === true,
    destinationPriority: load.destinationPriority === true,
    distanceFromCurrentDeliveryMiles: load.distanceFromCurrentDeliveryMiles ?? undefined,
    hasProposedPrice: load.hasProposedPrice === true,
    proposedPriceGbp: typeof load.proposedPriceGbp === 'number' ? load.proposedPriceGbp : undefined,
    pickupTimeTo: load.pickup.collectionTo || undefined,
    deliveryTimeTo: load.delivery.deliveryTo || undefined,
    distanceMiles: typeof load.distanceMiles === 'number' ? load.distanceMiles : undefined,
    estimatedDrivingMinutes: typeof load.estimatedDrivingMinutes === 'number' ? load.estimatedDrivingMinutes : undefined,
    weightKg: typeof load.weightKg === 'number' ? load.weightKg : undefined,
    dimensions: load.dimensions || undefined,
    palletCount: typeof load.palletCount === 'number' ? load.palletCount : undefined,
    adr: load.adr === true,
    tailLift: load.tailLift === true,
    temperatureControlled: load.temperatureControlled === true,
    badges: Array.isArray(load.badges) ? load.badges : [],
  };
}

export async function fetchLiveLoads(options: { destinationMode?: boolean; radiusMiles?: 10 | 20 | 30 } = {}) {
  const params = new URLSearchParams();
  if (options.destinationMode) params.set('mode', 'destination');
  if (options.radiusMiles) params.set('radius', String(options.radiusMiles));
  const payload = await apiRequest<LiveLoadsResponse>(`/api/driver/mobile/nearby-jobs?${params.toString()}`);
  return { jobs: (payload.jobs ?? []).map(mapLiveLoad), returnIq: payload.returnIq ?? { active: false } };
}

export async function fetchActiveQuotedJobIds() {
  const payload = await apiRequest<{ activeJobIds?: string[] }>('/api/driver/mobile/bids?scope=active-company');
  return new Set((payload.activeJobIds ?? []).map((jobId) => String(jobId)));
}

export async function submitLiveLoadQuote(jobId: string, quote: StructuredLiveLoadQuote, token?: string | null) {
  await apiRequest<{ success?: boolean; bidId?: string; jobId?: string; idempotent?: boolean }>(
    '/api/driver/mobile/bids',
    {
      method: 'POST',
      token,
      body: {
        jobId,
        amount: quote.totalAmount,
        baseAmount: quote.baseAmount,
        additionalExtrasGbp: quote.additionalExtrasGbp,
        collectWithinMinutes: quote.collectWithinMinutes,
        message: quote.message?.trim() || null,
      },
    },
  );
}
