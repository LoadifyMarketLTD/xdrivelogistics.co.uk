export const CANONICAL_DRIVER_OPERATIONAL_STATUSES = [
  'posted',
  'quoted',
  'awarded',
  'allocated',
  'accepted',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'delivered',
] as const;

const DRIVER_STATUS_ALIASES: Record<string, (typeof CANONICAL_DRIVER_OPERATIONAL_STATUSES)[number]> = {
  posted: 'posted',
  quoted: 'quoted',
  awarded: 'awarded',
  allocated: 'allocated',
  assigned: 'allocated',
  accepted: 'accepted',
  on_my_way_to_pickup: 'on_my_way_to_pickup',
  on_my_way: 'on_my_way_to_pickup',
  on_site_pickup: 'on_site_pickup',
  arrived_pickup: 'on_site_pickup',
  loaded: 'loaded',
  collected: 'loaded',
  on_my_way_to_delivery: 'on_my_way_to_delivery',
  in_transit: 'on_my_way_to_delivery',
  on_route_delivery: 'on_my_way_to_delivery',
  on_site_delivery: 'on_site_delivery',
  arrived_delivery: 'on_site_delivery',
  delivered: 'delivered',
  completed: 'delivered',
  invoiced: 'delivered',
  paid: 'delivered',
};

export function normalizeDriverOperationalStatus(value: unknown): (typeof CANONICAL_DRIVER_OPERATIONAL_STATUSES)[number] | null {
  const raw = String(value ?? '').toLowerCase().trim();
  return DRIVER_STATUS_ALIASES[raw] ?? null;
}

export function mobileOperationalStatus(currentStatus: unknown, marketplaceStatus: unknown) {
  return normalizeDriverOperationalStatus(currentStatus)
    ?? normalizeDriverOperationalStatus(marketplaceStatus)
    ?? 'awarded';
}
