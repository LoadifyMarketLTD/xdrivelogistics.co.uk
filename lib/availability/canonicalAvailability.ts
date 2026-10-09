export type AvailabilityWorkspaceRole =
  | 'carrier'
  | 'fleet_manager'
  | 'dispatcher'
  | 'owner_driver'
  | 'driver';

export type AvailabilityTab = 'live' | 'future' | 'nearby';

export type CanonicalAvailabilityPosition = {
  scope: 'fleet' | 'exchange';
  company_id?: string | null;
  member_name?: string | null;
  member_code?: string | null;
  member_type?: string | null;
  vehicle_type?: string | null;
  body_type?: string | null;
  payload_kg?: number | null;
  pallets_capacity?: number | null;
  has_tail_lift?: boolean | null;
  available_until?: string | null;
  recorded_at?: string | null;
  distance_miles?: number | null;
};

export type AvailabilityFilters = {
  search: string;
  scope: 'all' | 'fleet' | 'exchange';
  vehicleType: string;
  bodyType: string;
  minPayloadKg: number | null;
  minPallets: number | null;
  tailLiftOnly: boolean;
};

export const AVAILABILITY_TABS_BY_ROLE: Record<AvailabilityWorkspaceRole, AvailabilityTab[]> = {
  carrier: ['live', 'future', 'nearby'],
  fleet_manager: ['live', 'future', 'nearby'],
  dispatcher: ['live', 'future', 'nearby'],
  owner_driver: ['live', 'future', 'nearby'],
  driver: ['live', 'future', 'nearby'],
};

export const DEFAULT_AVAILABILITY_FILTERS: AvailabilityFilters = {
  search: '',
  scope: 'all',
  vehicleType: 'all',
  bodyType: 'all',
  minPayloadKg: null,
  minPallets: null,
  tailLiftOnly: false,
};

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function matchesAvailabilityFilters(
  position: CanonicalAvailabilityPosition,
  filters: AvailabilityFilters,
) {
  if (filters.scope !== 'all' && position.scope !== filters.scope) return false;
  if (filters.vehicleType !== 'all' && normalise(position.vehicle_type) !== normalise(filters.vehicleType)) return false;
  if (filters.bodyType !== 'all' && normalise(position.body_type) !== normalise(filters.bodyType)) return false;
  if (filters.minPayloadKg != null && Number(position.payload_kg ?? 0) < filters.minPayloadKg) return false;
  if (filters.minPallets != null && Number(position.pallets_capacity ?? 0) < filters.minPallets) return false;
  if (filters.tailLiftOnly && position.has_tail_lift !== true) return false;

  const needle = normalise(filters.search);
  if (!needle) return true;

  return [
    position.member_name,
    position.member_code,
    position.member_type,
    position.vehicle_type,
    position.body_type,
  ].some((value) => normalise(value).includes(needle));
}

export function availabilityFreshness(
  recordedAt: string | null | undefined,
  nowMs = Date.now(),
  freshWindowMs = 20 * 60_000,
): 'live' | 'stale' | 'missing' {
  if (!recordedAt) return 'missing';
  const timestamp = new Date(recordedAt).getTime();
  if (!Number.isFinite(timestamp)) return 'stale';
  return nowMs - timestamp <= freshWindowMs ? 'live' : 'stale';
}
