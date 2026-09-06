import { apiRequest } from './client';

type ApiLoad = {
  id: string;
  publicReference: string | null;
  poster?: { name: string | null; memberCode: string | null };
  pickup: { addressSummary: string; collectionFrom: string | null };
  delivery: { addressSummary: string; deliveryFrom: string | null };
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
  deliveryTime: string;
  cargoType: string;
  vehicleRequirement: string;
  price: string;
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
  };
}

async function loadActiveQuotedJobIds() {
  const payload = await apiRequest<{ activeJobIds?: string[] }>('/api/driver/mobile/bids?scope=active-company');
  return new Set((payload.activeJobIds ?? []).map(String));
}

export async function fetchLiveLoads(options: { destinationMode?: boolean; radiusMiles?: 10 | 20 | 30 } = {}) {
  const params = new URLSearchParams();
  if (options.destinationMode) params.set('mode', 'destination');
  if (options.radiusMiles) params.set('radius', String(options.radiusMiles));
  const suffix = params.toString();

  const payload = await apiRequest<LiveLoadsResponse>(`/api/driver/mobile/nearby-jobs${suffix ? `?${suffix}` : ''}`);

  // Quote-state enrichment must never make a valid marketplace response disappear.
  // Keep already-quoted loads on the board so Quotes can still edit/open the related
  // load, but prevent a second quote from being submitted for the same company/job.
  let quotedJobIds = new Set<string>();
  try {
    quotedJobIds = await loadActiveQuotedJobIds();
  } catch {
    quotedJobIds = new Set<string>();
  }

  const jobs = (payload.jobs ?? []).map(mapLiveLoad).map((job) => quotedJobIds.has(job.id)
    ? {
        ...job,
        canQuote: false,
        quoteWarning: 'An active quote already exists for this load. Manage it from Quotes.',
      }
    : job);

  return { jobs, returnIq: payload.returnIq ?? { active: false } };
}

export async function fetchActiveQuotedJobIds() {
  // Compatibility shim for recovered screens that historically removed quoted
  // loads from the marketplace. V2 keeps them visible and marks them non-quotable
  // inside fetchLiveLoads so quote edit/navigation retains the source load.
  return new Set<string>();
}

export async function submitLiveLoadQuote(jobId: string, amount: number, message?: string) {
  await apiRequest('/api/driver/mobile/bids', {
    method: 'POST',
    body: { jobId, amount, message: message?.trim() || null },
  });
}
