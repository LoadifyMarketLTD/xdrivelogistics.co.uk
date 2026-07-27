import { supabase } from '../auth/supabase';
import { getApiBaseUrl } from './client';

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
  hasProposedPrice?: boolean;
  proposedPriceGbp?: number | null;
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
  };
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) throw new Error('Your session has expired. Please log in again.');
  return token;
}

export async function fetchLiveLoads(options: { destinationMode?: boolean; radiusMiles?: 10 | 20 | 30; search?: string } = {}) {
  const token = await accessToken();
  const params = new URLSearchParams();
  if (options.destinationMode) params.set('mode', 'destination');
  if (options.radiusMiles) params.set('radius', String(options.radiusMiles));
  if (options.search?.trim()) params.set('search', options.search.trim());
  const response = await fetch(`${getApiBaseUrl()}/api/driver/mobile/nearby-jobs?${params.toString()}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({})) as LiveLoadsResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Unable to load jobs (HTTP ${response.status}).`);
  return { jobs: (payload.jobs ?? []).map(mapLiveLoad), returnIq: payload.returnIq ?? { active: false } };
}

export async function fetchActiveQuotedJobIds() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Your session has expired. Please log in again.');
  const { data, error } = await supabase
    .from('job_bids')
    .select('job_id')
    .eq('bidder_user_id', auth.user.id)
    .in('status', ['submitted', 'accepted']);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row: { job_id: string }) => String(row.job_id)));
}

export async function submitLiveLoadQuote(jobId: string, amount: number | null, message?: string, idempotencyKey?: string) {
  const token = await accessToken();
  const response = await fetch(`${getApiBaseUrl()}/api/driver/mobile/bids`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId, amount, message: message?.trim() || null, idempotencyKey }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || `Unable to submit quote (HTTP ${response.status}).`);
}
