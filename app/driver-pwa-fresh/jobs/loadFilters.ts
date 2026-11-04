export type MarketplaceLoad = {
  id: string;
  status: string;
  pickup_area: string;
  pickup_postcode_area: string | null;
  delivery_area: string;
  delivery_postcode_area: string | null;
  pickup_datetime: string | null;
  distance_to_pickup_miles: number | null;
  distance_to_delivery_miles?: number | null;
  vehicle_type: string | null;
  requested_vehicle_label: string | null;
  requested_vehicle_type: string | null;
};

export type LoadFilters = {
  from: string;
  to: string;
  vehicle: string;
  bodyType: string;
  collectWithin: string;
  pickupRadius: string;
  destinationRadius?: string;
};

export function canQuoteStillOpenLoad(load: { myBid?: { status: string | null } | null }): boolean {
  if (!load.myBid) return true;
  return ['withdrawn','rejected','unsuccessful','expired','cancelled'].includes(String(load.myBid.status ?? '').toLowerCase());
}

const available = new Set(['posted', 'quoted']);
const label = (town: string, outcode: string | null) => [town, outcode].filter(Boolean).join(', ').toLowerCase();

export function filterMarketplaceLoads<T extends MarketplaceLoad>(loads: T[], filters: LoadFilters, now = Date.now()): T[] {
  return loads.filter(load => {
    if (!available.has(String(load.status).toLowerCase())) return false;
    if (load.pickup_datetime) {
      const pickup = Date.parse(load.pickup_datetime);
      if (!Number.isFinite(pickup)) return false;
      // The server is authoritative for whether a posted load is still open.
      // An overdue collection time is NOT an expired job: keep it visible with
      // an explicit warning while the publisher has not withdrawn the listing.
      if (filters.collectWithin && (pickup < now || pickup > now + Number(filters.collectWithin) * 60_000)) return false;
    } else if (filters.collectWithin) return false;
    if (filters.pickupRadius) {
      const radius = Number(filters.pickupRadius);
      if (!Number.isFinite(radius) || radius < 0) return false;
      // Missing driver GPS is unknown distance, not evidence the job is outside
      // the default 10-mile radius. Never silently hide the entire load board.
      if (load.distance_to_pickup_miles != null &&
          (!Number.isFinite(load.distance_to_pickup_miles) || load.distance_to_pickup_miles > radius)) return false;
    }
    if (filters.destinationRadius) {
      const radius = Number(filters.destinationRadius);
      if (!Number.isFinite(radius) || radius < 0 ||
          load.distance_to_delivery_miles == null || !Number.isFinite(load.distance_to_delivery_miles) ||
          load.distance_to_delivery_miles > radius) return false;
    }
    if (filters.from.trim() && !label(load.pickup_area, load.pickup_postcode_area).includes(filters.from.trim().toLowerCase())) return false;
    if (filters.to.trim() && !label(load.delivery_area, load.delivery_postcode_area).includes(filters.to.trim().toLowerCase())) return false;
    const vehicleLabel = [load.requested_vehicle_label, load.requested_vehicle_type, load.vehicle_type].filter(Boolean).join(' ').toLowerCase();
    if (filters.vehicle.trim() && !vehicleLabel.includes(filters.vehicle.trim().toLowerCase())) return false;
    if (filters.bodyType && !vehicleLabel.includes(filters.bodyType.toLowerCase())) return false;
    return true;
  });
}
