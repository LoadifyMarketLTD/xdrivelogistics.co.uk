import { apiRequest } from './client';
import { supabase } from '../auth/supabase';
import type { CanonicalJobStatus, DriverJob, DriverQuoteReadiness, DriverResources } from '../types/driver';

type RawJob = Record<string, unknown>;

export type ReturnIqMeta = {
  active: boolean;
  destinationArea?: string;
  currentJobReference?: string;
  availableAfter?: string | null;
  radiusMiles?: number;
  reason?: string;
};

type AvailableJobsResult = { jobs: DriverJob[]; returnIq: ReturnIqMeta };

export function quoteReadinessMessage(readiness?: DriverQuoteReadiness) {
  if (!readiness || readiness.eligible) return '';
  const combined = [...(readiness.issues ?? []), ...(readiness.blockers ?? [])].join(' ').toLowerCase();
  if (combined.includes('cpccard') || combined.includes('cpc card')) return 'Your CPC Card must be uploaded and approved before you can quote.';
  if (combined.includes('drivinglicence') || combined.includes('driving licence') || combined.includes('drivinglicense')) return 'Your Driving Licence must be uploaded and approved before you can quote.';
  if (combined.includes('vehicle_document_missing_or_invalid:mot') || combined.includes('missing approved vehicle compliance documents: mot')) return 'The assigned vehicle needs a current approved MOT before you can quote.';
  if (combined.includes('insurance')) return 'A current approved insurance document is required before you can quote.';
  if (combined.includes('quote_readiness_unavailable') || combined.includes('could not be verified')) return 'Quote readiness could not be verified. Refresh the app and try again.';
  if (combined.includes('commercial_bidding_not_permitted')) return 'Commercial quoting is not enabled for this driver account.';
  if (combined.includes('canonical_vehicle_missing')) return 'An active assigned vehicle is required before you can quote.';
  return 'Complete and approve the required driver and vehicle compliance before quoting.';
}

function text(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function companyName(value: unknown) {
  const normalized = text(value, '');
  return normalized && !normalized.includes('@') ? normalized : '';
}

function status(value: unknown): CanonicalJobStatus {
  const raw = text(value, 'awarded').toLowerCase();
  if (['cancelled', 'canceled'].includes(raw)) return 'cancelled';
  if (['available', 'posted', 'open'].includes(raw)) return 'available';
  if (['awarded', 'allocated', 'accepted', 'assigned'].includes(raw)) return 'awarded';
  if (['on_my_way', 'on_my_way_to_pickup', 'on_my_way_pickup'].includes(raw)) return 'on_my_way_pickup';
  if (['on_site_pickup', 'arrived_pickup'].includes(raw)) return 'arrived_pickup';
  if (['loaded', 'collected'].includes(raw)) return 'loaded';
  if (['in_transit', 'on_route_delivery', 'on_my_way_to_delivery', 'on_my_way_delivery'].includes(raw)) return 'on_my_way_delivery';
  if (['on_site_delivery', 'arrived_delivery'].includes(raw)) return 'arrived_delivery';
  if (['delivered', 'completed', 'invoiced', 'paid'].includes(raw)) return 'delivered';
  return 'awarded';
}

function mapJob(row: RawJob): DriverJob {
  const id = text(row.id);
  const rawPrice = text(row.price ?? row.publicPrice, '');
  const price = ['price tbc', 'tbc', 'not published', 'not available', 'n/a'].includes(rawPrice.toLowerCase()) ? '' : rawPrice;
  return {
    id,
    reference: text(row.reference ?? row.publicReference, id ? `XDL-${id.slice(0, 8).toUpperCase()}` : 'XDL'),
    postingCompanyName: companyName(row.postingCompanyName ?? row.posting_company_name ?? (row.poster as Record<string, unknown> | undefined)?.name) || undefined,
    postingCompanyMemberCode: text(row.postingCompanyMemberCode ?? row.posting_company_member_code ?? (row.poster as Record<string, unknown> | undefined)?.memberCode, '') || undefined,
    postedAt: text(row.postedAt ?? row.exchange_posted_at ?? row.created_at, '') || undefined,
    status: status(row.current_status ?? row.status),
    notesSummary: text(row.notesSummary ?? row.load_details, '') || undefined,
    distanceToPickupMiles: row.distanceToPickupMiles != null ? Number(row.distanceToPickupMiles) : row.distance_to_pickup_miles != null ? Number(row.distance_to_pickup_miles) : undefined,
    journeyDistanceMiles: row.journeyDistanceMiles != null ? Number(row.journeyDistanceMiles) : row.job_distance_miles != null ? Number(row.job_distance_miles) : undefined,
    estimatedJourneyMinutes: row.estimatedJourneyMinutes != null ? Number(row.estimatedJourneyMinutes) : row.job_distance_minutes != null ? Number(row.job_distance_minutes) : undefined,
    serviceMode: text(row.serviceMode ?? row.service_mode, '') || undefined,
    directDeliveryRequired: row.directDeliveryRequired === true || row.direct_delivery_required === true,
    expiresAt: text(row.expiresAt ?? row.exchange_expires_at, '') || undefined,
    canQuote: row.canQuote !== false,
    quoteWarning: text(row.quoteWarning, '') || undefined,
    pickupLocation: text(row.pickupLocation ?? row.pickup_location ?? row.pickup?.toString(), 'Pickup location'),
    deliveryLocation: text(row.deliveryLocation ?? row.delivery_location ?? row.delivery?.toString(), 'Delivery location'),
    pickupTime: text(row.pickupTime ?? row.pickup_datetime ?? row.collectionFrom, 'Collection time'),
    deliveryTime: text(row.deliveryTime ?? row.delivery_datetime ?? row.deliveryFrom, 'Delivery time'),
    cargoType: text(row.cargoType ?? row.cargo_type ?? row.freightType, 'Freight'),
    vehicleRequirement: text(row.vehicleRequirement ?? row.vehicle_type ?? row.vehicleType, 'Vehicle'),
    price,
    podRequired: row.podRequired !== false,
    contactAllowed: row.contactAllowed === true,
    contactName: text(row.contactName ?? row.delivery_contact_name, '') || undefined,
    contactPhone: text(row.contactPhone ?? row.delivery_contact_phone, '') || undefined,
    pickupNote: text(row.pickupNote ?? row.pickup_note ?? row.special_requirements, '') || undefined,
    deliveryNote: text(row.deliveryNote ?? row.delivery_note ?? row.access_restrictions, '') || undefined,
  };
}
export async function fetchResources() {
  const payload = await apiRequest<{ resources: DriverResources }>('/api/driver/mobile/resources');
  return payload.resources;
}

export async function fetchJobs(scope: 'active' | 'upcoming' | 'completed') {
  const payload = await apiRequest<{ jobs: RawJob[] }>(`/api/driver/mobile/jobs?scope=${scope}`);
  return (payload.jobs ?? []).map(mapJob);
}

export async function fetchAvailableJobs(options: { destinationMode?: boolean; radiusMiles?: 10 | 20 | 30 } = {}): Promise<AvailableJobsResult> {
  const params = new URLSearchParams();
  if (options.destinationMode) params.set('mode', 'destination');
  if (options.radiusMiles) params.set('radius', String(options.radiusMiles));
  const query = params.toString();
  const payload = await apiRequest<{ jobs: RawJob[]; returnIq?: ReturnIqMeta }>(`/api/driver/mobile/nearby-jobs${query ? `?${query}` : ''}`);
  const jobs = (payload.jobs ?? []).map((row) => {
    const pickup = row.pickup as Record<string, unknown> | undefined;
    const delivery = row.delivery as Record<string, unknown> | undefined;
    const publicPrice = row.publicPrice as Record<string, unknown> | undefined;
    const poster = row.poster as Record<string, unknown> | undefined;
    const freight = text(row.freightType, '');
    const pallets = row.pallets != null ? `${Number(row.pallets)} pallet${Number(row.pallets) === 1 ? '' : 's'}` : '';
    const weight = row.weightKg != null ? `${Number(row.weightKg)} kg` : '';
    return mapJob({
      ...row,
      status: 'available',
      pickupLocation: pickup?.addressSummary,
      deliveryLocation: delivery?.addressSummary,
      pickupTime: pickup?.collectionFrom,
      deliveryTime: delivery?.deliveryFrom,
      notesSummary: row.notesSummary,
      distanceToPickupMiles: row.distanceToPickupMiles,
      journeyDistanceMiles: row.journeyDistanceMiles,
      estimatedJourneyMinutes: row.estimatedJourneyMinutes,
      serviceMode: row.serviceMode,
      directDeliveryRequired: row.directDeliveryRequired,
      expiresAt: row.expiresAt,
      cargoType: [freight, pallets, weight].filter(Boolean).join(' | '),
      vehicleRequirement: row.vehicleType,
      postingCompanyName: poster?.name,
      postingCompanyMemberCode: poster?.memberCode,
      price: publicPrice?.visible === true && publicPrice.amount != null
        ? `\u00A3${Number(publicPrice.amount).toFixed(2)}`
        : '',
    });
  });
  return { jobs: jobs.filter((job) => isQuoteWindowOpen(job)), returnIq: payload.returnIq ?? { active: false } };
}

export function isQuoteWindowOpen(job: DriverJob, nowMs = Date.now()) {
  const pickupMs = Date.parse(job.pickupTime);
  const expiryMs = job.expiresAt ? Date.parse(job.expiresAt) : Number.NaN;
  return (Number.isNaN(pickupMs) || pickupMs > nowMs)
    && (Number.isNaN(expiryMs) || expiryMs > nowMs);
}

export async function updateDestinationPreferences(enabled: boolean, radiusMiles: 10 | 20 | 30) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Driver session not found.');
  const { data, error } = await supabase
    .from('drivers')
    .update({ destination_priority_enabled: enabled, destination_radius_miles: radiusMiles })
    .eq('user_id', auth.user.id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Destination preferences could not be updated for this account.');
  return { ok: true as const };
}

export async function fetchJob(jobId: string) {
  const payload = await apiRequest<{ job: RawJob }>(`/api/driver/mobile/jobs/${jobId}`);
  return mapJob(payload.job);
}

export async function submitQuote(jobId: string, amount: number, message = '') {
  return apiRequest('/api/driver/mobile/bids', {
    method: 'POST',
    body: { jobId, amount, message: message.trim() },
  });
}

export async function uploadDriverDocument(input: { docType: string; fileName: string; mimeType: string; base64: string }) {
  return apiRequest('/api/driver/mobile/resources', {
    method: 'POST',
    body: { action: 'upload_document', ...input },
  });
}

export async function postJobStatus(jobId: string, endpoint: string) {
  return apiRequest(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST' });
}
