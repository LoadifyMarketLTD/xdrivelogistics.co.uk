import { apiRequest } from './client';
import type { CanonicalJobStatus, DriverJob, DriverResources } from '../types/driver';

type RawJob = Record<string, unknown>;

function text(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function status(value: unknown): CanonicalJobStatus {
  const raw = text(value, 'awarded').toLowerCase();
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
    status: status(row.status ?? row.current_status),
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

export async function fetchAvailableJobs() {
  const payload = await apiRequest<{ jobs: RawJob[] }>('/api/driver/mobile/nearby-jobs');
  return (payload.jobs ?? []).map((row) => {
    const pickup = row.pickup as Record<string, unknown> | undefined;
    const delivery = row.delivery as Record<string, unknown> | undefined;
    const publicPrice = row.publicPrice as Record<string, unknown> | undefined;
    return mapJob({
      ...row,
      status: 'available',
      pickupLocation: pickup?.addressSummary,
      deliveryLocation: delivery?.addressSummary,
      pickupTime: pickup?.collectionFrom,
      deliveryTime: delivery?.deliveryFrom,
      price: publicPrice?.visible === true && publicPrice.amount != null
        ? `£${Number(publicPrice.amount).toFixed(2)}`
        : '',
    });
  });
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

export async function postJobStatus(jobId: string, endpoint: string) {
  return apiRequest(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST' });
}
