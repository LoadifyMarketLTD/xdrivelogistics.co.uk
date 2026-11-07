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

const available = new Set(['posted', 'quoted']);
const label = (town: string, outcode: string | null) => [town, outcode].filter(Boolean).join(', ').toLowerCase();

export function filterMarketplaceLoads<T extends MarketplaceLoad>(loads: T[], filters: LoadFilters, now = Date.now()): T[] {
  return loads.filter(load => {
    if (!available.has(String(load.status).toLowerCase())) return false;
    if (load.pickup_datetime) {
      const pickup = Date.parse(load.pickup_datetime);
      if (!Number.isFinite(pickup) || pickup < now) return false;
      if (filters.collectWithin && pickup > now + Number(filters.collectWithin) * 60_000) return false;
    } else if (filters.collectWithin) return false;
    if (filters.pickupRadius) {
      const radius = Number(filters.pickupRadius);
      // A missing or stale Driver GPS position produces a null distance in the API.
      // Do not hide an otherwise eligible marketplace job just because its proximity
      // cannot be measured. Only apply the radius to a known, finite distance.
      if (!Number.isFinite(radius) || radius < 0) return false;
      if (load.distance_to_pickup_miles != null &&
          (!Number.isFinite(load.distance_to_pickup_miles) || load.distance_to_pickup_miles > radius)) return false;
    }
    if (filters.destinationRadius) {
      const radius = Number(filters.destinationRadius);
      if (!Number.isFinite(radius) || radius < 0) return false;
      if (load.distance_to_delivery_miles != null &&
          (!Number.isFinite(load.distance_to_delivery_miles) || load.distance_to_delivery_miles > radius)) return false;
    }
    if (filters.from.trim() && !label(load.pickup_area, load.pickup_postcode_area).includes(filters.from.trim().toLowerCase())) return false;
    if (filters.to.trim() && !label(load.delivery_area, load.delivery_postcode_area).includes(filters.to.trim().toLowerCase())) return false;
    const vehicleLabel = [load.requested_vehicle_label, load.requested_vehicle_type, load.vehicle_type].filter(Boolean).join(' ').toLowerCase();
    if (filters.vehicle.trim() && !vehicleLabel.includes(filters.vehicle.trim().toLowerCase())) return false;
    if (filters.bodyType && !vehicleLabel.includes(filters.bodyType.toLowerCase())) return false;
    return true;
  });
}
